export const MEMBER_COLORS = ['emerald', 'gold', 'teal', 'rose', 'indigo', 'amber'] as const;

export type MemberColor = (typeof MEMBER_COLORS)[number];

export const MAX_LIVES = 3;
export const COMPLETIONS_PER_LIFE = 3;
export const DEFAULT_DAILY_GOAL = 100;
export const GOAL_PRESETS = [33, 100, 300, 500, 1000] as const;
export const DEFAULT_HOUSEHOLD_GOAL = 10000;
export const HOUSEHOLD_PRESETS = [10000, 100000] as const;

export type PublicPhrase = {
  id: string;
  label: string;
  arabic: string;
  latin: string;
};

export type PublicMember = {
  id: string;
  name: string;
  color: MemberColor;
  pinSet: boolean;
  kids: boolean;
  lives: number;
  streak: number;
  bestStreak: number;
  lifeProgress: number;
  totalSalawat: number;
  todayCount: number;
  todayGoal: number;
  personalGoal: number | null;
  todayDone: boolean;
  notice: string | null;
};

export type MeResponse = {
  family: {
    id: string;
    name: string;
    email: string;
    timezone: string;
    dailyGoal: number;
    householdGoal: number;
    householdCount: number;
    joinCode: string;
  };
  phrases: PublicPhrase[];
  members: PublicMember[];
  activeMemberId: string | null;
  familyToday: number;
  familyTarget: number;
  allDone: boolean;
};

export function formatJoinCode(code: string | null | undefined): string {
  const clean = (code ?? '').replace(/[^a-z0-9]/gi, '').toUpperCase();
  return clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
}

export type MonthPerson = {
  id: string;
  name: string;
  color: MemberColor;
  count: number;
};

export type MonthResponse = {
  month: string;
  householdCount: number;
  householdGoal: number;
  recited: number;
  days: { date: string; total: number; people: MonthPerson[] }[];
  showedUp: { id: string; name: string; color: MemberColor; days: number }[];
  dedications: { date: string; name: string; count: number; memberName: string }[];
};

export type PlayResponse = MeResponse & {
  justCompleted?: boolean;
  lifeEarned?: boolean;
};
