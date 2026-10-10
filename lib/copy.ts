import { COMPLETIONS_PER_LIFE, MAX_LIVES, type MeResponse, type PublicMember } from './types';

export const PHRASES = [
  {
    id: 'short',
    label: 'Short',
    arabic: 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ',
    latin: "Allahumma salli 'ala Muhammad",
  },
  {
    id: 'long',
    label: 'Longer',
    arabic: 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ',
    latin: "Allahumma salli 'ala Muhammad wa 'ala ali Muhammad",
  },
] as const;

export const RULES = [
  {
    title: 'One group, many profiles',
    body: 'The group shares one login, on a phone, a tablet, or a computer. Each person has a profile, with a PIN if you want their count to stay theirs.',
  },
  {
    title: 'A shared daily goal',
    body: 'Everyone aims for the same number. Each tap is one salawat. Meet the goal and the streak grows by a day.',
  },
  {
    title: 'Lives protect the streak',
    body: 'You start with three lives. The streak begins the first day you meet the goal. After that, a missed day spends a life and the streak continues. A miss with no lives left ends it.',
  },
  {
    title: 'Lives come back',
    body: 'Finish the goal with none left and one life returns. Every three finished days brings one back too, up to three. The counter never locks.',
  },
] as const;

export function lifeHint(member: PublicMember): string {
  if (member.streak === 0 && member.lives === 0) {
    return 'Finish today to start a streak and light a life.';
  }
  if (member.streak === 0 && member.lives === MAX_LIVES) {
    return 'Meet the goal to start a streak.';
  }
  if (member.streak === 0) {
    return 'Meet the goal to start again. Your lives are still here.';
  }
  if (member.lives === 0) {
    return 'No lives left. Finish today to light one. A miss ends the streak.';
  }
  if (member.lives < MAX_LIVES) {
    const left = Math.max(1, COMPLETIONS_PER_LIFE - member.lifeProgress);
    return `${left} more goal ${left === 1 ? 'day' : 'days'} to light another life.`;
  }
  return 'Three lives protect the streak. A miss spends one.';
}

export function completionMessage(me: MeResponse, lifeEarned: boolean): string {
  const member = me.members.find((item) => item.id === me.activeMemberId);
  if (!member) return 'Today is complete.';
  if (member.streak === 1 && member.bestStreak === 1) {
    return 'Streak started. A miss spends a life and keeps it going.';
  }
  if (lifeEarned) {
    return `Today is complete. Day ${member.streak} of the streak, and a life came back.`;
  }
  return `Today is complete. Day ${member.streak} of the streak.`;
}
