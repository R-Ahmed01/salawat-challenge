import { randomBytes, randomUUID } from 'node:crypto';
import { addDays, todayInTimeZone } from './dates';
import { dbAll, dbGet, dbRun, withTx } from './db';
import { HttpError } from './errors';
import { addSalawat, catchUpMember, type DayLog, type MemberState } from './game';
import { hashSecret, verifySecret } from './password';
import { hashToken, newSessionToken } from './session';
import {
  DEFAULT_DAILY_GOAL,
  DEFAULT_HOUSEHOLD_GOAL,
  MAX_LIVES,
  type MeResponse,
  type MemberColor,
  type MonthResponse,
  type PublicMember,
  type PublicPhrase,
} from './types';

const MEMBER_CAP = 20;

type FamilyRow = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  timezone: string;
  daily_goal: number;
  household_goal: number;
  household_count: number;
  join_code: string | null;
};

type MemberRow = {
  id: string;
  family_id: string;
  name: string;
  color: string;
  pin_hash: string | null;
  lives: number;
  streak: number;
  best_streak: number;
  life_progress: number;
  streak_anchor: string | null;
  processed_through: string | null;
  started: number;
  total_salawat: number;
  pending_notice: string | null;
  daily_goal: number | null;
  kids: number;
  created_on: string;
  created_at: string;
};

type DayRow = {
  date: string;
  count: number;
  goal: number;
  completed: number;
};

let dummyHash: string | null = null;

export async function createFamily(input: {
  name: string;
  email: string;
  password: string;
  timezone: string;
}): Promise<string> {
  const existing = await dbGet('SELECT id FROM families WHERE email = ?', [input.email]);
  if (existing) throw new HttpError(409, 'That email already has a group. Log in instead.');

  const id = randomUUID();
  const passwordHash = await hashSecret(input.password);
  const now = new Date().toISOString();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = newSessionToken();
    try {
      await withTx(async () => {
        await dbRun(
          `INSERT INTO families (id, name, email, password_hash, timezone, daily_goal, join_code, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, input.name, input.email, passwordHash, input.timezone, DEFAULT_DAILY_GOAL, newJoinCode(), now],
        );
        await dbRun('INSERT INTO sessions (token_hash, family_id, expires_at) VALUES (?, ?, ?)', [
          hashToken(token),
          id,
          expiresInDays(30),
        ]);
      });
      return token;
    } catch (error) {
      if (!isUnique(error)) throw error;
      const existing = await dbGet('SELECT id FROM families WHERE email = ?', [input.email]);
      if (existing) throw new HttpError(409, 'That email already has a group. Log in instead.');
    }
  }

  throw new HttpError(500, 'Could not start that group. Try again.');
}

export async function loginFamily(email: string, password: string): Promise<string | null> {
  await dbRun('DELETE FROM sessions WHERE expires_at < ?', [new Date().toISOString()]);
  const family = await dbGet<{ id: string; password_hash: string }>(
    'SELECT id, password_hash FROM families WHERE email = ?',
    [email],
  );
  const hash = family?.password_hash ?? (await getDummyHash());
  const ok = await verifySecret(password, hash);
  if (!family || !ok) return null;

  const token = newSessionToken();
  await dbRun('INSERT INTO sessions (token_hash, family_id, expires_at) VALUES (?, ?, ?)', [
    hashToken(token),
    family.id,
    expiresInDays(30),
  ]);
  return token;
}

export async function joinFamily(code: string): Promise<string | null> {
  const family = await dbGet<{ id: string }>('SELECT id FROM families WHERE join_code = ?', [code]);
  if (!family) return null;
  const token = newSessionToken();
  await dbRun('INSERT INTO sessions (token_hash, family_id, expires_at) VALUES (?, ?, ?)', [
    hashToken(token),
    family.id,
    expiresInDays(30),
  ]);
  return token;
}

export async function randomHadith(): Promise<{ id: string; arabic: string; english: string; source: string } | null> {
  const row = await dbGet<{ id: string; arabic: string; english: string; source: string }>(
    'SELECT id, arabic, english, source FROM hadiths ORDER BY RANDOM() LIMIT 1',
  );
  return row ?? null;
}

export async function logoutFamily(token: string): Promise<void> {
  await dbRun('DELETE FROM sessions WHERE token_hash = ?', [hashToken(token)]);
}

export async function getMe(familyId: string, activeMemberId: string | null): Promise<MeResponse> {
  return withTx(async () => {
    await ensureJoinCode(familyId);
    const family = await mustFamily(familyId);
    const today = todayInTimeZone(family.timezone);
    for (const member of await listMembers(familyId)) await syncMember(member, today, goalFor(member, family.daily_goal));
    return readMe(familyId, activeMemberId, today);
  });
}

export async function createMember(
  familyId: string,
  input: { name: string; color: MemberColor; pin: string | null; dailyGoal?: number | null; kids?: boolean },
): Promise<string> {
  const pinHash = input.pin ? await hashSecret(input.pin) : null;
  return withTx(async () => {
    const family = await mustFamily(familyId);
    const members = await listMembers(familyId);
    if (members.length >= MEMBER_CAP) {
      throw new HttpError(400, 'This group already has 20 profiles.');
    }
    assertUniqueName(members, input.name);
    const today = todayInTimeZone(family.timezone);
    const id = randomUUID();
    await dbRun(
      `INSERT INTO members (
        id, family_id, name, color, pin_hash, lives, streak, best_streak, life_progress,
        streak_anchor, processed_through, started, total_salawat, pending_notice, daily_goal, kids,
        created_on, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, NULL, ?, 0, 0, NULL, ?, ?, ?, ?)`,
      [
        id,
        familyId,
        input.name,
        input.color,
        pinHash,
        MAX_LIVES,
        addDays(today, -1),
        input.dailyGoal ?? null,
        input.kids ? 1 : 0,
        today,
        new Date().toISOString(),
      ],
    );
    return id;
  });
}

export async function updateMember(
  familyId: string,
  memberId: string,
  patch: {
    name?: string;
    color?: MemberColor;
    pin?: string | null;
    clearPin?: boolean;
    dailyGoal?: number | null;
    kids?: boolean;
  },
): Promise<void> {
  const pinHash = patch.pin ? await hashSecret(patch.pin) : null;
  await withTx(async () => {
    const family = await mustFamily(familyId);
    const row = await mustMember(familyId, memberId);
    const members = await listMembers(familyId);
    if (patch.name) assertUniqueName(members, patch.name, row.id);
    const name = patch.name ?? row.name;
    const color = patch.color ?? row.color;
    let nextPin = row.pin_hash;
    if (patch.pin) nextPin = pinHash;
    else if (patch.clearPin) nextPin = null;
    const dailyGoal = patch.dailyGoal === undefined ? row.daily_goal : patch.dailyGoal;
    const kids = patch.kids === undefined ? row.kids : patch.kids ? 1 : 0;
    await dbRun(
      'UPDATE members SET name = ?, color = ?, pin_hash = ?, daily_goal = ?, kids = ? WHERE id = ? AND family_id = ?',
      [name, color, nextPin, dailyGoal, kids, memberId, familyId],
    );

    if (patch.dailyGoal !== undefined && patch.dailyGoal !== row.daily_goal) {
      const today = todayInTimeZone(family.timezone);
      const goal = dailyGoal ?? family.daily_goal;
      await dbRun('UPDATE days SET goal = ? WHERE member_id = ? AND date = ? AND completed = 0', [
        goal,
        memberId,
        today,
      ]);
      const fresh = await mustMember(familyId, memberId);
      await persistAdd(fresh, today, goalFor(fresh, family.daily_goal), 0);
    }
  });
}

export async function deleteMember(familyId: string, memberId: string): Promise<void> {
  await withTx(async () => {
    await dbRun('DELETE FROM dedications WHERE member_id = ?', [memberId]);
    await dbRun('DELETE FROM days WHERE member_id = ?', [memberId]);
    const result = await dbRun('DELETE FROM members WHERE id = ? AND family_id = ?', [memberId, familyId]);
    if (result.changes === 0) throw new HttpError(404, 'That profile was not found.');
  });
}

export async function dismissNotice(familyId: string, memberId: string): Promise<void> {
  const result = await dbRun('UPDATE members SET pending_notice = NULL WHERE id = ? AND family_id = ?', [
    memberId,
    familyId,
  ]);
  if (result.changes === 0) throw new HttpError(404, 'That profile was not found.');
}

export async function updateFamily(
  familyId: string,
  patch: { name?: string; timezone?: string; dailyGoal?: number; householdGoal?: number; resetHousehold?: boolean },
): Promise<void> {
  await withTx(async () => {
    const family = await mustFamily(familyId);
    const name = patch.name ?? family.name;
    const timezone = patch.timezone ?? family.timezone;
    const dailyGoal = patch.dailyGoal ?? family.daily_goal;
    const householdGoal = patch.householdGoal ?? family.household_goal ?? DEFAULT_HOUSEHOLD_GOAL;
    const householdCount = patch.resetHousehold ? 0 : family.household_count;
    await dbRun(
      'UPDATE families SET name = ?, timezone = ?, daily_goal = ?, household_goal = ?, household_count = ? WHERE id = ?',
      [name, timezone, dailyGoal, householdGoal, householdCount, familyId],
    );

    const today = todayInTimeZone(timezone);
    if (patch.dailyGoal && patch.dailyGoal !== family.daily_goal) {
      await dbRun(
        `UPDATE days SET goal = ?
         WHERE completed = 0 AND date = ? AND member_id IN (
           SELECT id FROM members WHERE family_id = ? AND daily_goal IS NULL
         )`,
        [patch.dailyGoal, today, familyId],
      );
      for (const member of await listMembers(familyId)) {
        if (member.daily_goal != null) continue;
        const fresh = await mustMember(familyId, member.id);
        await persistAdd(fresh, today, goalFor(fresh, patch.dailyGoal), 0);
      }
    } else {
      for (const member of await listMembers(familyId)) await syncMember(member, today, goalFor(member, dailyGoal));
    }
  });
}

export async function changePassword(familyId: string, current: string, next: string): Promise<void> {
  const family = await mustFamily(familyId);
  const ok = await verifySecret(current, family.password_hash);
  if (!ok) throw new HttpError(400, 'The current password does not match.');
  const passwordHash = await hashSecret(next);
  await dbRun('UPDATE families SET password_hash = ? WHERE id = ?', [passwordHash, familyId]);
}

export async function memberInFamily(familyId: string, memberId: string): Promise<boolean> {
  const row = await dbGet('SELECT id FROM members WHERE id = ? AND family_id = ?', [memberId, familyId]);
  return Boolean(row);
}

export async function memberNeedsPin(familyId: string, memberId: string): Promise<boolean> {
  const row = await mustMember(familyId, memberId);
  return Boolean(row.pin_hash);
}

export async function pinMatches(familyId: string, memberId: string, pin: string): Promise<boolean> {
  const row = await mustMember(familyId, memberId);
  if (!row.pin_hash) return true;
  return verifySecret(pin, row.pin_hash);
}

export async function addForMember(
  familyId: string,
  memberId: string,
  amount: number,
  opId?: string | null,
  dedication?: string | null,
): Promise<{ me: MeResponse; justCompleted: boolean; lifeEarned: boolean }> {
  return withTx(async () => {
    const family = await mustFamily(familyId);
    const today = todayInTimeZone(family.timezone);
    if (opId && (await dbGet('SELECT id FROM play_ops WHERE id = ?', [opId]))) {
      return { me: await readMe(familyId, memberId, today), justCompleted: false, lifeEarned: false };
    }
    const member = await mustMember(familyId, memberId);
    const goal = goalFor(member, family.daily_goal);
    const result = await persistAdd(member, today, goal, amount);
    if (result.appliedAmount !== 0) {
      await dbRun('UPDATE families SET household_count = MAX(0, household_count + ?) WHERE id = ?', [
        result.appliedAmount,
        familyId,
      ]);
      if (dedication) await addDedication(familyId, memberId, today, dedication, result.appliedAmount);
    }
    if (opId) {
      await dbRun('INSERT INTO play_ops (id, family_id, member_id, amount, created_at) VALUES (?, ?, ?, ?, ?)', [
        opId,
        familyId,
        memberId,
        amount,
        new Date().toISOString(),
      ]);
    }
    for (const other of await listMembers(familyId)) {
      if (other.id === memberId) continue;
      await syncMember(other, today, goalFor(other, family.daily_goal));
    }
    return {
      me: await readMe(familyId, memberId, today),
      justCompleted: result.justCompleted,
      lifeEarned: result.lifeEarned,
    };
  });
}

async function persistAdd(row: MemberRow, today: string, goal: number, amount: number) {
  const days = await loadDays(row.id, row.processed_through ?? '0000-01-01', today);
  const result = addSalawat(toState(row), days, today, goal, amount);
  if (result.changed) {
    await saveState(row.id, result.state, result.notice ?? row.pending_notice);
    await writeDays(row.id, result.writes);
  }
  return result;
}

async function syncMember(row: MemberRow, today: string, goal: number): Promise<void> {
  const days = await loadDays(row.id, row.processed_through ?? '0000-01-01', today);
  const result = catchUpMember(toState(row), days, today, goal);
  if (!result.changed) return;
  await saveState(row.id, result.state, result.notice ?? row.pending_notice);
  await writeDays(row.id, result.writes);
}

async function readMe(familyId: string, activeMemberId: string | null, today: string): Promise<MeResponse> {
  const family = await mustFamily(familyId);
  const members = await listMembers(familyId);
  const active = activeMemberId && members.some((member) => member.id === activeMemberId) ? activeMemberId : null;

  const publicMembers: PublicMember[] = [];
  for (const member of members) {
    const day = await dbGet<DayRow>('SELECT count, goal, completed FROM days WHERE member_id = ? AND date = ?', [
      member.id,
      today,
    ]);
    const todayGoal = day?.goal ?? goalFor(member, family.daily_goal);
    const todayCount = day?.count ?? 0;
    const todayDone = Boolean(day && (day.completed === 1 || day.count >= day.goal));
    publicMembers.push({
      id: member.id,
      name: member.name,
      color: member.color as MemberColor,
      pinSet: Boolean(member.pin_hash),
      kids: member.kids === 1,
      lives: member.lives,
      streak: member.streak,
      bestStreak: member.best_streak,
      lifeProgress: member.life_progress,
      totalSalawat: member.total_salawat,
      todayCount,
      todayGoal,
      personalGoal: member.daily_goal,
      todayDone,
      notice: member.pending_notice,
    });
  }

  const familyToday = publicMembers.reduce((sum, member) => sum + member.todayCount, 0);
  const familyTarget = publicMembers.reduce((sum, member) => sum + member.todayGoal, 0);
  const phrases = await dbAll<PublicPhrase>(
    'SELECT id, label, arabic, latin FROM phrases WHERE family_id = ? ORDER BY created_at ASC, id ASC',
    [familyId],
  );

  return {
    family: {
      id: family.id,
      name: family.name,
      email: family.email,
      timezone: family.timezone,
      dailyGoal: family.daily_goal,
      householdGoal: family.household_goal ?? DEFAULT_HOUSEHOLD_GOAL,
      householdCount: family.household_count ?? 0,
      joinCode: family.join_code ?? '',
    },
    phrases,
    members: publicMembers,
    activeMemberId: active,
    familyToday,
    familyTarget,
    allDone: publicMembers.length > 0 && publicMembers.every((member) => member.todayDone),
  };
}

function goalFor(member: MemberRow, familyGoal: number): number {
  return member.daily_goal ?? familyGoal;
}

async function addDedication(
  familyId: string,
  memberId: string,
  date: string,
  name: string,
  amount: number,
): Promise<void> {
  if (amount < 0) {
    await dbRun(
      'UPDATE dedications SET count = MAX(0, count + ?) WHERE member_id = ? AND date = ? AND name = ?',
      [amount, memberId, date, name],
    );
    return;
  }
  await dbRun(
    `INSERT INTO dedications (id, family_id, member_id, date, name, count, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(member_id, date, name) DO UPDATE SET count = count + excluded.count`,
    [randomUUID(), familyId, memberId, date, name, amount, new Date().toISOString()],
  );
}

const PHRASE_CAP = 12;

export async function createPhrase(
  familyId: string,
  input: { label: string; arabic: string; latin: string },
): Promise<void> {
  await withTx(async () => {
    const count = await dbGet<{ n: number }>('SELECT COUNT(*) AS n FROM phrases WHERE family_id = ?', [familyId]);
    if ((count?.n ?? 0) >= PHRASE_CAP) throw new HttpError(400, 'This group already has 12 salawat.');
    await dbRun(
      'INSERT INTO phrases (id, family_id, label, arabic, latin, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [randomUUID(), familyId, input.label, input.arabic, input.latin, new Date().toISOString()],
    );
  });
}

export async function deletePhrase(familyId: string, phraseId: string): Promise<void> {
  const result = await dbRun('DELETE FROM phrases WHERE id = ? AND family_id = ?', [phraseId, familyId]);
  if (result.changes === 0) throw new HttpError(404, 'That salawat was not found.');
}

export async function getMonth(familyId: string, month: string): Promise<MonthResponse> {
  const family = await mustFamily(familyId);
  const members = await listMembers(familyId);
  const start = `${month}-01`;
  const [yearText, monthText] = month.split('-');
  const year = Number(yearText);
  const monthNumber = Number(monthText);
  const next =
    monthNumber === 12 ? `${year + 1}-01-01` : `${year}-${String(monthNumber + 1).padStart(2, '0')}-01`;
  const empty: MonthResponse = {
    month,
    householdCount: family.household_count ?? 0,
    householdGoal: family.household_goal ?? DEFAULT_HOUSEHOLD_GOAL,
    recited: 0,
    days: [],
    showedUp: [],
    dedications: [],
  };
  if (members.length === 0) return empty;

  const ids = members.map((member) => member.id);
  const marks = ids.map(() => '?').join(', ');
  const dayRows = await dbAll<{ member_id: string; date: string; count: number }>(
    `SELECT member_id, date, count FROM days
     WHERE date >= ? AND date < ? AND count > 0 AND member_id IN (${marks})
     ORDER BY date ASC`,
    [start, next, ...ids],
  );
  const dedicationRows = await dbAll<{ date: string; name: string; count: number; member_id: string }>(
    `SELECT date, name, count, member_id FROM dedications
     WHERE family_id = ? AND date >= ? AND date < ? AND count > 0
     ORDER BY date ASC, created_at ASC`,
    [familyId, start, next],
  );

  const byDate = new Map<string, { id: string; name: string; color: MemberColor; count: number }[]>();
  const daysPresent = new Map<string, number>();
  for (const row of dayRows) {
    const member = members.find((item) => item.id === row.member_id);
    if (!member) continue;
    const people = byDate.get(row.date) ?? [];
    people.push({
      id: member.id,
      name: member.name,
      color: member.color as MemberColor,
      count: row.count,
    });
    byDate.set(row.date, people);
    daysPresent.set(member.id, (daysPresent.get(member.id) ?? 0) + 1);
  }

  return {
    ...empty,
    recited: dayRows.reduce((sum, row) => sum + row.count, 0),
    days: [...byDate.entries()].map(([date, people]) => ({
      date,
      total: people.reduce((sum, person) => sum + person.count, 0),
      people: members
        .filter((member) => people.some((person) => person.id === member.id))
        .map((member) => people.find((person) => person.id === member.id)!),
    })),
    showedUp: members
      .filter((member) => (daysPresent.get(member.id) ?? 0) > 0)
      .map((member) => ({
        id: member.id,
        name: member.name,
        color: member.color as MemberColor,
        days: daysPresent.get(member.id) ?? 0,
      })),
    dedications: dedicationRows.flatMap((row) => {
      const member = members.find((item) => item.id === row.member_id);
      if (!member) return [];
      return [{ date: row.date, name: row.name, count: row.count, memberName: member.name }];
    }),
  };
}

function listMembers(familyId: string): Promise<MemberRow[]> {
  return dbAll<MemberRow>('SELECT * FROM members WHERE family_id = ? ORDER BY created_at ASC, id ASC', [familyId]);
}

const JOIN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function newJoinCode(): string {
  const bytes = randomBytes(8);
  return Array.from(bytes, (byte) => JOIN_ALPHABET[byte % JOIN_ALPHABET.length]).join('');
}

async function ensureJoinCode(familyId: string): Promise<void> {
  const family = await mustFamily(familyId);
  if (family.join_code) return;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const result = await dbRun('UPDATE families SET join_code = ? WHERE id = ? AND join_code IS NULL', [
        newJoinCode(),
        familyId,
      ]);
      if (result.changes === 1) return;
      const fresh = await mustFamily(familyId);
      if (fresh.join_code) return;
    } catch (error) {
      if (!isUnique(error)) throw error;
    }
  }
  throw new HttpError(500, 'Could not prepare this group.');
}

function mustFamily(familyId: string): Promise<FamilyRow> {
  return dbGet<FamilyRow>('SELECT * FROM families WHERE id = ?', [familyId]).then((family) => {
    if (!family) throw new HttpError(401, 'Please log in again.');
    return family;
  });
}

function mustMember(familyId: string, memberId: string): Promise<MemberRow> {
  return dbGet<MemberRow>('SELECT * FROM members WHERE id = ? AND family_id = ?', [memberId, familyId]).then(
    (member) => {
      if (!member) throw new HttpError(404, 'That profile was not found.');
      return member;
    },
  );
}

function assertUniqueName(members: MemberRow[], name: string, ignoreId?: string): void {
  const taken = members.some(
    (member) => member.id !== ignoreId && member.name.localeCompare(name, undefined, { sensitivity: 'accent' }) === 0,
  );
  if (taken) throw new HttpError(409, 'Someone in the group already uses that name.');
}

async function loadDays(memberId: string, after: string, through: string): Promise<DayLog[]> {
  const rows = await dbAll<DayRow>(
    'SELECT date, count, goal, completed FROM days WHERE member_id = ? AND date > ? AND date <= ?',
    [memberId, after, through],
  );
  return rows.map((row) => ({
    date: row.date,
    count: row.count,
    goal: row.goal,
    completed: row.completed === 1,
  }));
}

async function saveState(memberId: string, state: MemberState, notice: string | null): Promise<void> {
  await dbRun(
    `UPDATE members SET
      lives = ?, streak = ?, best_streak = ?, life_progress = ?, streak_anchor = ?,
      processed_through = ?, started = ?, total_salawat = ?, pending_notice = ?
     WHERE id = ?`,
    [
      state.lives,
      state.streak,
      state.bestStreak,
      state.lifeProgress,
      state.streakAnchor,
      state.processedThrough,
      state.started ? 1 : 0,
      state.totalSalawat,
      notice,
      memberId,
    ],
  );
}

async function writeDays(memberId: string, days: DayLog[]): Promise<void> {
  for (const day of days) {
    await dbRun(
      `INSERT INTO days (member_id, date, count, goal, completed)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(member_id, date) DO UPDATE SET
         count = excluded.count,
         goal = excluded.goal,
         completed = excluded.completed`,
      [memberId, day.date, day.count, day.goal, day.completed ? 1 : 0],
    );
  }
}

function toState(row: MemberRow): MemberState {
  return {
    lives: row.lives,
    streak: row.streak,
    bestStreak: row.best_streak,
    lifeProgress: row.life_progress,
    streakAnchor: row.streak_anchor,
    processedThrough: row.processed_through,
    started: row.started === 1,
    totalSalawat: row.total_salawat,
    createdOn: row.created_on,
  };
}

function expiresInDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function isUnique(error: unknown): boolean {
  return error instanceof Error && error.message.includes('UNIQUE');
}

async function getDummyHash(): Promise<string> {
  if (!dummyHash) dummyHash = await hashSecret('salawat-challenge-dummy-password');
  return dummyHash;
}
