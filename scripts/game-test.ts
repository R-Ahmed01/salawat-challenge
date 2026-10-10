import assert from 'node:assert/strict';
import { addDays, todayInTimeZone } from '../lib/dates';
import {
  addSalawat,
  catchUpMember,
  describeCatchUp,
  newMemberState,
  type DayLog,
  type MemberState,
} from '../lib/game';
import { overlay } from '../lib/offline';
import type { MeResponse } from '../lib/types';

const goal = 10;

function check(name: string, fn: () => void) {
  fn();
  console.log('ok', name);
}

function play(state: MemberState, logs: Map<string, DayLog>, today: string, amount: number) {
  const result = addSalawat(state, [...logs.values()], today, goal, amount);
  for (const day of result.writes) logs.set(day.date, day);
  return result;
}

check('calendar dates ignore the clock', () => {
  assert.equal(addDays('2026-01-31', 1), '2026-02-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2024-02-28', 1), '2024-02-29');
  assert.equal(todayInTimeZone('America/New_York', new Date('2026-01-01T00:30:00Z')), '2025-12-31');
  assert.equal(todayInTimeZone('Asia/Riyadh', new Date('2026-01-01T00:30:00Z')), '2026-01-01');
});

check('the first finished day starts the streak', () => {
  const logs = new Map<string, DayLog>();
  const state = newMemberState('2026-10-01');
  const missed = catchUpMember(state, [], '2026-10-04', goal);
  assert.equal(missed.state.lives, 3);
  assert.equal(missed.state.streak, 0);
  assert.equal(missed.state.started, false);

  const done = play(missed.state, logs, '2026-10-04', 10);
  assert.equal(done.justCompleted, true);
  assert.equal(done.state.streak, 1);
  assert.equal(done.state.bestStreak, 1);
  assert.equal(done.state.lives, 3);
  assert.equal(done.state.totalSalawat, 10);
  assert.equal(done.lifeEarned, false);
});

check('a miss spends a life and the next finish continues', () => {
  const logs = new Map<string, DayLog>();
  let state = newMemberState('2026-10-01');
  state = play(state, logs, '2026-10-01', 10).state;
  assert.equal(state.streak, 1);

  const opened = catchUpMember(state, [...logs.values()], '2026-10-03', goal);
  assert.equal(opened.state.lives, 2);
  assert.equal(opened.state.streak, 1);
  assert.equal(opened.state.streakAnchor, '2026-10-02');
  assert.match(opened.notice ?? '', /1 day/);
  assert.match(opened.notice ?? '', /2 lives are left/);

  const again = catchUpMember(opened.state, [...logs.values()], '2026-10-03', goal);
  assert.equal(again.changed, false);
  assert.equal(again.state.lives, 2);

  const next = play(opened.state, logs, '2026-10-03', 10);
  assert.equal(next.state.streak, 2);
  assert.equal(next.state.lives, 2);
  assert.equal(next.state.lifeProgress, 2);
});

check('three lives cover three misses and the next miss ends the streak', () => {
  const logs = new Map<string, DayLog>();
  let state = newMemberState('2026-10-01');
  state = play(state, logs, '2026-10-01', 4).state;
  state = play(state, logs, '2026-10-01', 6).state;
  assert.equal(state.streak, 1);
  assert.equal(logs.get('2026-10-01')?.count, 10);

  const later = catchUpMember(state, [...logs.values()], '2026-10-06', goal);
  assert.equal(later.state.streak, 0);
  assert.equal(later.state.lives, 0);
  assert.equal(later.state.streakAnchor, null);
  assert.match(later.notice ?? '', /used up your lives/);
  assert.match(later.notice ?? '', /1-day streak ended/);

  const restarted = play(later.state, logs, '2026-10-06', 10);
  assert.equal(restarted.state.streak, 1);
  assert.equal(restarted.state.lives, 1);
  assert.equal(restarted.lifeEarned, true);
});

check('every third finish lights a life without going past three', () => {
  const logs = new Map<string, DayLog>();
  let state = newMemberState('2026-10-01');
  state = play(state, logs, '2026-10-01', 10).state;
  const missed = catchUpMember(state, [...logs.values()], '2026-10-03', goal);
  state = missed.state;
  assert.equal(state.lives, 2);

  state = play(state, logs, '2026-10-03', 10).state;
  assert.equal(state.lives, 2);
  assert.equal(state.lifeProgress, 2);

  const third = play(state, logs, '2026-10-04', 10);
  assert.equal(third.state.streak, 3);
  assert.equal(third.state.lives, 3);
  assert.equal(third.state.lifeProgress, 0);
  assert.equal(third.lifeEarned, true);

  state = play(third.state, logs, '2026-10-05', 10).state;
  state = play(state, logs, '2026-10-06', 10).state;
  const held = play(state, logs, '2026-10-07', 10);
  assert.equal(held.state.lives, 3);
  assert.equal(held.state.lifeProgress, 0);
  assert.equal(held.lifeEarned, false);
  assert.equal(held.state.streak, 6);
});

check('a finished day cannot be undone below the goal', () => {
  const logs = new Map<string, DayLog>();
  let state = newMemberState('2026-10-01');
  state = play(state, logs, '2026-10-01', 10).state;
  state = play(state, logs, '2026-10-01', 5).state;
  assert.equal(logs.get('2026-10-01')?.count, 15);

  const undone = play(state, logs, '2026-10-01', -10);
  assert.equal(undone.appliedAmount, -5);
  assert.equal(undone.state.totalSalawat, 10);
  assert.equal(logs.get('2026-10-01')?.count, 10);
  assert.equal(undone.state.streak, 1);

  const before = play(newMemberState('2026-10-02'), new Map(), '2026-10-02', 4);
  const back = play(before.state, new Map([['2026-10-02', before.writes[0]]]), '2026-10-02', -4);
  assert.equal(back.state.totalSalawat, 0);
  assert.equal(back.state.streak, 0);
});

check('notices stay quiet when nothing happened', () => {
  assert.equal(describeCatchUp([]), null);
  assert.match(describeCatchUp([{ type: 'protected', days: 3, livesLeft: 0 }]) ?? '', /None are left/);
});

check('offline taps sit on the last saved house', () => {
  const base: MeResponse = {
    family: { id: 'f', name: 'House', email: 'a@b.c', timezone: 'UTC', dailyGoal: 10 },
    members: [
      {
        id: 'm1',
        name: 'Yusuf',
        color: 'emerald',
        pinSet: false,
        lives: 3,
        streak: 0,
        bestStreak: 0,
        lifeProgress: 0,
        totalSalawat: 8,
        todayCount: 8,
        todayGoal: 10,
        todayDone: false,
        notice: null,
      },
    ],
    activeMemberId: 'm1',
    familyToday: 8,
    familyTarget: 10,
    allDone: false,
  };
  const view = overlay(
    base,
    [
      { id: 'b', memberId: 'm1', amount: -3, at: 2 },
      { id: 'a', memberId: 'm1', amount: 5, at: 1 },
    ],
    'm1',
  );
  assert.equal(view.members[0].todayCount, 10);
  assert.equal(view.members[0].totalSalawat, 10);
  assert.equal(view.members[0].todayDone, true);
  assert.equal(view.familyToday, 10);
  assert.equal(view.allDone, true);
});

console.log('all game rules passed');
