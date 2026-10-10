import { addDays } from './dates';
import { COMPLETIONS_PER_LIFE, MAX_LIVES } from './types';

/**
 * Lives protect a streak. They never block reciting.
 *
 * The streak starts the first day the goal is met. Until then, missed days
 * do nothing. After that:
 * - meeting the goal adds one day to the streak
 * - a missed day spends one life and the streak stays
 * - a missed day with no lives left ends the streak
 * - meeting the goal with no lives left lights one life
 * - every three goals met lights one life, up to three
 */

export type MemberState = {
  lives: number;
  streak: number;
  bestStreak: number;
  lifeProgress: number;
  streakAnchor: string | null;
  processedThrough: string | null;
  started: boolean;
  totalSalawat: number;
  createdOn: string;
};

export type DayLog = {
  date: string;
  count: number;
  goal: number;
  completed: boolean;
};

export type CatchEvent =
  | { type: 'protected'; days: number; livesLeft: number }
  | { type: 'streak_lost'; streakLost: number }
  | { type: 'life_earned'; lives: number };

export type CatchResult = {
  state: MemberState;
  writes: DayLog[];
  notice: string | null;
  events: CatchEvent[];
  changed: boolean;
};

export type AddResult = CatchResult & {
  justCompleted: boolean;
  lifeEarned: boolean;
  appliedAmount: number;
};

export function newMemberState(createdOn: string): MemberState {
  return {
    lives: MAX_LIVES,
    streak: 0,
    bestStreak: 0,
    lifeProgress: 0,
    streakAnchor: null,
    processedThrough: addDays(createdOn, -1),
    started: false,
    totalSalawat: 0,
    createdOn,
  };
}

export function describeCatchUp(events: CatchEvent[]): string | null {
  const lost = events.find((event) => event.type === 'streak_lost');
  const protectedMiss = events.find((event) => event.type === 'protected');
  const life = events.find((event) => event.type === 'life_earned');
  const parts: string[] = [];

  if (lost?.type === 'streak_lost' && protectedMiss?.type === 'protected') {
    parts.push(
      `Missed days used up your lives, and ${streakPhrase(lost.streakLost)} ended. Today can start a new one.`,
    );
  } else if (lost?.type === 'streak_lost') {
    parts.push(`A missed day ended ${streakPhrase(lost.streakLost)}. Today can start a new one.`);
  } else if (protectedMiss?.type === 'protected') {
    const dayWord = protectedMiss.days === 1 ? 'day' : 'days';
    const spent = protectedMiss.days === 1 ? 'A life' : `${protectedMiss.days} lives`;
    const left =
      protectedMiss.livesLeft === 0
        ? 'None are left'
        : protectedMiss.livesLeft === 1
          ? '1 life is left'
          : `${protectedMiss.livesLeft} lives are left`;
    parts.push(`You missed ${protectedMiss.days} ${dayWord}. ${spent} kept your streak. ${left}.`);
  }

  if (life?.type === 'life_earned') {
    parts.push(
      life.lives === 1 ? 'A life came back. You have 1 now.' : `A life came back. You have ${life.lives} now.`,
    );
  }

  return parts.length ? parts.join(' ') : null;
}

export function catchUpMember(
  input: MemberState,
  days: DayLog[],
  today: string,
  defaultGoal: number,
): CatchResult {
  const state = structuredClone(input);
  const yesterday = addDays(today, -1);
  const earliest = addDays(state.createdOn, -1);
  let cursor = state.processedThrough ?? earliest;
  if (cursor < earliest) cursor = earliest;

  if (cursor >= yesterday) {
    return { state, writes: [], notice: null, events: [], changed: false };
  }

  if (!state.started) {
    state.processedThrough = yesterday;
    return { state, writes: [], notice: null, events: [], changed: true };
  }

  const byDate = new Map(days.map((day) => [day.date, day]));
  const writes: DayLog[] = [];
  const livesAtStart = state.lives;
  let protectedDays = 0;
  let streakLost = 0;

  for (let day = addDays(cursor, 1); day <= yesterday; day = addDays(day, 1)) {
    const log = byDate.get(day);
    const dayGoal = log?.goal ?? defaultGoal;
    const count = log?.count ?? 0;

    if (count >= dayGoal) {
      if (!log?.completed) {
        applyCompletion(state, day);
        writes.push({ date: day, count, goal: dayGoal, completed: true });
      }
      continue;
    }

    if (state.streak > 0) {
      if (state.lives > 0) {
        state.lives -= 1;
        state.streakAnchor = day;
        protectedDays += 1;
      } else {
        streakLost = state.streak;
        state.streak = 0;
        state.streakAnchor = null;
        state.lifeProgress = 0;
      }
    }
  }

  state.processedThrough = yesterday;

  const events: CatchEvent[] = [];
  if (streakLost > 0) events.push({ type: 'streak_lost', streakLost });
  if (protectedDays > 0) events.push({ type: 'protected', days: protectedDays, livesLeft: state.lives });
  if (!streakLost && state.lives > livesAtStart) {
    events.push({ type: 'life_earned', lives: state.lives });
  }

  return {
    state,
    writes,
    notice: describeCatchUp(events),
    events,
    changed: true,
  };
}

export function addSalawat(
  input: MemberState,
  days: DayLog[],
  today: string,
  defaultGoal: number,
  amount: number,
): AddResult {
  const caught = catchUpMember(input, days, today, defaultGoal);
  const map = new Map<string, DayLog>();
  for (const day of days) map.set(day.date, { ...day });
  for (const day of caught.writes) map.set(day.date, { ...day });

  const existing = map.get(today);
  const goal = existing?.goal ?? defaultGoal;
  const count = existing?.count ?? 0;
  const completed = existing?.completed ?? false;
  const floor = completed ? goal : 0;
  const next = Math.max(floor, count + amount);
  const applied = next - count;
  const state = caught.state;
  state.totalSalawat = Math.max(0, state.totalSalawat + applied);

  let justCompleted = false;
  let lifeEarned = false;
  let nowCompleted = completed;
  if (!completed && next >= goal && goal > 0) {
    lifeEarned = applyCompletion(state, today);
    justCompleted = true;
    nowCompleted = true;
  }

  const writes = [...caught.writes];
  if (applied !== 0 || justCompleted) {
    writes.push({ date: today, count: next, goal, completed: nowCompleted });
  }

  return {
    state,
    writes,
    notice: caught.notice,
    events: caught.events,
    changed: caught.changed || applied !== 0 || justCompleted,
    justCompleted,
    lifeEarned,
    appliedAmount: applied,
  };
}

function applyCompletion(state: MemberState, day: string): boolean {
  if (state.streak > 0 && state.streakAnchor !== addDays(day, -1)) {
    state.streak = 0;
    state.lifeProgress = 0;
  }

  const livesBefore = state.lives;
  state.streak += 1;
  state.streakAnchor = day;
  if (state.streak > state.bestStreak) state.bestStreak = state.streak;
  state.started = true;
  state.lifeProgress += 1;

  if (state.lives === 0) {
    state.lives = 1;
    if (state.lifeProgress >= COMPLETIONS_PER_LIFE) state.lifeProgress = 0;
  } else if (state.lifeProgress >= COMPLETIONS_PER_LIFE) {
    state.lifeProgress = 0;
    if (state.lives < MAX_LIVES) state.lives += 1;
  }

  if (state.lives > MAX_LIVES) state.lives = MAX_LIVES;
  return state.lives > livesBefore;
}

function streakPhrase(days: number): string {
  return days === 1 ? 'a 1-day streak' : `a ${days}-day streak`;
}
