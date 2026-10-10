import type { MeResponse, PublicMember } from './types';

export type PendingTap = {
  id: string;
  memberId: string;
  amount: number;
  at: number;
};

export function overlay(base: MeResponse, pending: PendingTap[], selectedId: string | null): MeResponse {
  const extras = new Map<string, number>();
  for (const item of pending) extras.set(item.memberId, (extras.get(item.memberId) ?? 0) + item.amount);

  let familyDelta = 0;
  const members = base.members.map((member) => {
    const extra = extras.get(member.id) ?? 0;
    if (extra === 0) return member;
    const floor = member.todayCount >= member.todayGoal ? member.todayGoal : 0;
    const todayCount = Math.max(floor, member.todayCount + extra);
    const delta = todayCount - member.todayCount;
    familyDelta += delta;
    return {
      ...member,
      todayCount,
      totalSalawat: Math.max(0, member.totalSalawat + delta),
      todayDone: todayCount >= member.todayGoal,
    };
  });

  const activeMemberId =
    selectedId && members.some((member) => member.id === selectedId) ? selectedId : base.activeMemberId;

  return {
    ...base,
    members,
    activeMemberId,
    familyToday: base.familyToday + familyDelta,
    allDone: members.length > 0 && members.every((member) => member.todayCount >= member.todayGoal),
  };
}

export function crossedGoal(before: PublicMember | undefined, after: PublicMember | undefined): boolean {
  if (!before || !after) return false;
  return before.todayCount < before.todayGoal && after.todayCount >= after.todayGoal;
}
