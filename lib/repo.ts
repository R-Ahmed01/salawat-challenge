import { randomUUID } from 'node:crypto';
import { addDays, todayInTimeZone } from './dates';
import { dbAll, dbGet, dbRun, withTx } from './db';
import { HttpError } from './errors';
import { addSalawat, catchUpMember, type DayLog, type MemberState } from './game';
import { hashSecret, verifySecret } from './password';
import { hashToken, newSessionToken } from './session';
import {
  DEFAULT_DAILY_GOAL,
  MAX_LIVES,
  type MeResponse,
  type MemberColor,
  type PublicMember,
} from './types';

const MEMBER_CAP = 20;

type FamilyRow = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  timezone: string;
  daily_goal: number;
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
  const token = newSessionToken();
  const now = new Date().toISOString();

  try {
    await withTx(async () => {
      await dbRun(
        `INSERT INTO families (id, name, email, password_hash, timezone, daily_goal, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, input.name, input.email, passwordHash, input.timezone, DEFAULT_DAILY_GOAL, now],
      );
      await dbRun('INSERT INTO sessions (token_hash, family_id, expires_at) VALUES (?, ?, ?)', [
        hashToken(token),
        id,
        expiresInDays(30),
      ]);
    });
  } catch (error) {
    if (isUnique(error)) throw new HttpError(409, 'That email already has a group. Log in instead.');
    throw error;
  }

  return token;
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

export async function logoutFamily(token: string): Promise<void> {
  await dbRun('DELETE FROM sessions WHERE token_hash = ?', [hashToken(token)]);
}

export async function getMe(familyId: string, activeMemberId: string | null): Promise<MeResponse> {
  return withTx(async () => {
    const family = await mustFamily(familyId);
    const today = todayInTimeZone(family.timezone);
    for (const member of await listMembers(familyId)) await syncMember(member, today, family.daily_goal);
    return readMe(familyId, activeMemberId, today);
  });
}

export async function createMember(
  familyId: string,
  input: { name: string; color: MemberColor; pin: string | null },
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
        streak_anchor, processed_through, started, total_salawat, pending_notice, created_on, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, NULL, ?, 0, 0, NULL, ?, ?)`,
      [id, familyId, input.name, input.color, pinHash, MAX_LIVES, addDays(today, -1), today, new Date().toISOString()],
    );
    return id;
  });
}

export async function updateMember(
  familyId: string,
  memberId: string,
  patch: { name?: string; color?: MemberColor; pin?: string | null; clearPin?: boolean },
): Promise<void> {
  const pinHash = patch.pin ? await hashSecret(patch.pin) : null;
  await withTx(async () => {
    const row = await mustMember(familyId, memberId);
    const members = await listMembers(familyId);
    if (patch.name) assertUniqueName(members, patch.name, row.id);
    const name = patch.name ?? row.name;
    const color = patch.color ?? row.color;
    let nextPin = row.pin_hash;
    if (patch.pin) nextPin = pinHash;
    else if (patch.clearPin) nextPin = null;
    await dbRun('UPDATE members SET name = ?, color = ?, pin_hash = ? WHERE id = ? AND family_id = ?', [
      name,
      color,
      nextPin,
      memberId,
      familyId,
    ]);
  });
}

export async function deleteMember(familyId: string, memberId: string): Promise<void> {
  await withTx(async () => {
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
  patch: { name?: string; timezone?: string; dailyGoal?: number },
): Promise<void> {
  await withTx(async () => {
    const family = await mustFamily(familyId);
    const name = patch.name ?? family.name;
    const timezone = patch.timezone ?? family.timezone;
    const dailyGoal = patch.dailyGoal ?? family.daily_goal;
    await dbRun('UPDATE families SET name = ?, timezone = ?, daily_goal = ? WHERE id = ?', [
      name,
      timezone,
      dailyGoal,
      familyId,
    ]);

    const today = todayInTimeZone(timezone);
    if (patch.dailyGoal && patch.dailyGoal !== family.daily_goal) {
      await dbRun(
        `UPDATE days SET goal = ?
         WHERE completed = 0 AND date = ? AND member_id IN (SELECT id FROM members WHERE family_id = ?)`,
        [patch.dailyGoal, today, familyId],
      );
      for (const member of await listMembers(familyId)) {
        const fresh = await mustMember(familyId, member.id);
        await persistAdd(fresh, today, patch.dailyGoal, 0);
      }
    } else {
      for (const member of await listMembers(familyId)) await syncMember(member, today, dailyGoal);
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
): Promise<{ me: MeResponse; justCompleted: boolean; lifeEarned: boolean }> {
  return withTx(async () => {
    const family = await mustFamily(familyId);
    const today = todayInTimeZone(family.timezone);
    if (opId && (await dbGet('SELECT id FROM play_ops WHERE id = ?', [opId]))) {
      return { me: await readMe(familyId, memberId, today), justCompleted: false, lifeEarned: false };
    }
    const member = await mustMember(familyId, memberId);
    const result = await persistAdd(member, today, family.daily_goal, amount);
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
      await syncMember(other, today, family.daily_goal);
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
    const todayGoal = day?.goal ?? family.daily_goal;
    const todayCount = day?.count ?? 0;
    const todayDone = Boolean(day && (day.completed === 1 || day.count >= day.goal));
    publicMembers.push({
      id: member.id,
      name: member.name,
      color: member.color as MemberColor,
      pinSet: Boolean(member.pin_hash),
      lives: member.lives,
      streak: member.streak,
      bestStreak: member.best_streak,
      lifeProgress: member.life_progress,
      totalSalawat: member.total_salawat,
      todayCount,
      todayGoal,
      todayDone,
      notice: member.pending_notice,
    });
  }

  const familyToday = publicMembers.reduce((sum, member) => sum + member.todayCount, 0);
  const familyTarget = publicMembers.reduce((sum, member) => sum + member.todayGoal, 0);

  return {
    family: {
      id: family.id,
      name: family.name,
      email: family.email,
      timezone: family.timezone,
      dailyGoal: family.daily_goal,
    },
    members: publicMembers,
    activeMemberId: active,
    familyToday,
    familyTarget,
    allDone: publicMembers.length > 0 && publicMembers.every((member) => member.todayDone),
  };
}

function listMembers(familyId: string): Promise<MemberRow[]> {
  return dbAll<MemberRow>('SELECT * FROM members WHERE family_id = ? ORDER BY created_at ASC, id ASC', [familyId]);
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
