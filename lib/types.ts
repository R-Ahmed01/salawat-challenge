export const MEMBER_COLORS = ['emerald', 'gold', 'teal', 'rose', 'indigo', 'amber'] as const;

export type MemberColor = (typeof MEMBER_COLORS)[number];

export const MAX_LIVES = 3;
export const COMPLETIONS_PER_LIFE = 3;
export const DEFAULT_DAILY_GOAL = 100;
export const GOAL_PRESETS = [33, 100, 300, 500, 1000] as const;

export type PublicMember = {
  id: string;
  name: string;
  color: MemberColor;
  pinSet: boolean;
  lives: number;
  streak: number;
  bestStreak: number;
  lifeProgress: number;
  totalSalawat: number;
  todayCount: number;
  todayGoal: number;
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
  };
  members: PublicMember[];
  activeMemberId: string | null;
  familyToday: number;
  familyTarget: number;
  allDone: boolean;
};

export type PlayResponse = MeResponse & {
  justCompleted?: boolean;
  lifeEarned?: boolean;
};
