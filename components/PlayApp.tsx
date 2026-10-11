'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { completionMessage } from '@/lib/copy';
import { crossedGoal, overlay, type PendingTap } from '@/lib/offline';
import type { MeResponse, PlayResponse, PublicMember } from '@/lib/types';
import { ApiError, api, isOfflineError } from './client-api';
import { FamilyRail } from './FamilyRail';
import { House } from './House';
import { type MemberDraft } from './MemberForm';
import { clearLocalHouse, deleteOutbox, listOutbox, loadHouse, putOutbox, saveHouse } from './offline-store';
import { MonthView } from './MonthView';
import { PinPad } from './PinPad';
import { Roster } from './Roster';
import { Stage } from './Stage';
import { Together } from './Together';

type Screen = 'roster' | 'pin' | 'play' | 'house' | 'together' | 'month';

export function PlayApp() {
  const [data, setData] = useState<MeResponse | null>(null);
  const [screen, setScreen] = useState<Screen>('roster');
  const [backTo, setBackTo] = useState<'roster' | 'play'>('roster');
  const [pinFor, setPinFor] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [dedication, setDedication] = useState('');
  const [undoCount, setUndoCount] = useState(0);
  const [offline, setOffline] = useState(false);
  const [waiting, setWaiting] = useState(0);
  const undoStack = useRef<number[]>([]);
  const pending = useRef(0);
  const queue = useRef(Promise.resolve());
  const baseRef = useRef<MeResponse | null>(null);
  const outboxRef = useRef<PendingTap[]>([]);
  const selectedRef = useRef<string | null>(null);
  const offlineRef = useRef(false);
  const tapClock = useRef(0);

  const paint = useCallback((base: MeResponse) => {
    const view = overlay(base, outboxRef.current, selectedRef.current);
    selectedRef.current = view.activeMemberId;
    setData(view);
    setWaiting(outboxRef.current.length);
    return view;
  }, []);

  const remember = useCallback(
    (base: MeResponse) => {
      baseRef.current = base;
      const view = paint(base);
      void saveHouse({ base, selectedId: view.activeMemberId });
      return view;
    },
    [paint],
  );

  const publishOffline = useCallback(
    (value: boolean) => {
      offlineRef.current = value;
      setOffline(value);
    },
    [],
  );

  const syncOne = useCallback(
    async (item: PendingTap) => {
      if (!outboxRef.current.some((op) => op.id === item.id)) return;
      if (offlineRef.current || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        publishOffline(true);
        return;
      }
      try {
        const next = await api<PlayResponse>('/api/play', {
          body: {
            action: 'add',
            amount: item.amount,
            memberId: item.memberId,
            opId: item.id,
            dedication: item.dedication || undefined,
          },
        });
        outboxRef.current = outboxRef.current.filter((op) => op.id !== item.id);
        await deleteOutbox(item.id);
        if (next.justCompleted) setBanner(completionMessage(next, Boolean(next.lifeEarned)));
        publishOffline(false);
        remember(next);
      } catch (caught) {
        if (isOfflineError(caught)) {
          publishOffline(true);
          return;
        }
        if (caught instanceof ApiError && caught.status >= 500) return;
        if (caught instanceof ApiError && caught.pinRequired) {
          setError('Enter the PIN for that profile to save the count.');
          return;
        }
        outboxRef.current = outboxRef.current.filter((op) => op.id !== item.id);
        await deleteOutbox(item.id);
        setWaiting(outboxRef.current.length);
        setError(caught instanceof Error ? caught.message : 'The count did not save.');
        const fresh = await api<MeResponse>('/api/me').catch(() => null);
        if (fresh) remember(fresh);
        undoStack.current = [];
        setUndoCount(0);
      }
    },
    [publishOffline, remember],
  );

  const flush = useCallback(async () => {
    publishOffline(false);
    for (const item of [...outboxRef.current]) {
      if (offlineRef.current) break;
      await syncOne(item);
    }
    const base = baseRef.current;
    const selected = selectedRef.current;
    if (!offlineRef.current && base && selected && selected !== base.activeMemberId) {
      const member = base.members.find((item) => item.id === selected);
      if (member && !member.pinSet) {
        try {
          const next = await api<MeResponse>('/api/play', { body: { action: 'select', memberId: selected } });
          publishOffline(false);
          remember(next);
        } catch (caught) {
          if (isOfflineError(caught)) publishOffline(true);
        }
      }
    }
  }, [publishOffline, remember, syncOne]);

  const scheduleFlush = useCallback(() => {
    queue.current = queue.current.then(() => flush());
  }, [flush]);

  useEffect(() => {
    let gone = false;
    async function open() {
      let saved: Awaited<ReturnType<typeof loadHouse>> = null;
      let pendingTaps: PendingTap[] = [];
      try {
        [saved, pendingTaps] = await Promise.all([loadHouse(), listOutbox()]);
      } catch {
        if (!gone) setError('Could not read the saved group on this device.');
        return;
      }
      if (gone) return;
      outboxRef.current = pendingTaps;
      tapClock.current = pendingTaps.reduce((max, item) => Math.max(max, item.at), 0);
      if (saved) {
        baseRef.current = saved.base;
        selectedRef.current = saved.selectedId;
        paint(saved.base);
        setScreen(saved.selectedId && saved.base.members.length > 0 ? 'play' : 'roster');
      }
      if (!navigator.onLine) {
        if (baseRef.current) {
          publishOffline(true);
          return;
        }
        setError('Open the group once while you are online. After that, counting works offline.');
        return;
      }
      try {
        const next = await api<MeResponse>('/api/me');
        if (gone) return;
        if (saved && saved.base.family.id !== next.family.id) {
          outboxRef.current = [];
          selectedRef.current = next.activeMemberId;
          await clearLocalHouse();
        }
        selectedRef.current = selectedRef.current ?? next.activeMemberId;
        publishOffline(false);
        const view = remember(next);
        setScreen(view.activeMemberId && next.members.length > 0 ? 'play' : 'roster');
        if (outboxRef.current.length > 0) scheduleFlush();
      } catch (caught) {
        if (gone) return;
        if (isOfflineError(caught) && baseRef.current) {
          publishOffline(true);
          return;
        }
        setError(
          isOfflineError(caught)
            ? 'Open the group once while you are online. After that, counting works offline.'
            : caught instanceof Error
              ? caught.message
              : 'Could not open the group.',
        );
      }
    }
    void open();
    return () => {
      gone = true;
    };
  }, [paint, publishOffline, remember, scheduleFlush]);

  useEffect(() => {
    function onFocus() {
      if (outboxRef.current.length > 0) {
        scheduleFlush();
        return;
      }
      if (pending.current > 0 || offlineRef.current) return;
      undoStack.current = [];
      setUndoCount(0);
      api<MeResponse>('/api/me')
        .then((next) => {
          publishOffline(false);
          remember(next);
        })
        .catch((caught) => {
          if (isOfflineError(caught)) publishOffline(true);
        });
    }
    function onOnline() {
      scheduleFlush();
    }
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
    };
  }, [publishOffline, remember, scheduleFlush]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (offlineRef.current || outboxRef.current.length > 0 || pending.current > 0) return;
      api<MeResponse>('/api/me')
        .then((next) => {
          if (outboxRef.current.length > 0 || pending.current > 0) return;
          publishOffline(false);
          remember(next);
        })
        .catch((caught) => {
          if (isOfflineError(caught)) publishOffline(true);
        });
    }, 2000);
    return () => window.clearInterval(timer);
  }, [publishOffline, remember]);

  function clearUndo() {
    undoStack.current = [];
    setUndoCount(0);
    setBanner(null);
  }

  async function openMember(member: PublicMember) {
    setError(null);
    setPinError(null);
    if (data?.activeMemberId === member.id && screen !== 'pin') {
      setScreen('play');
      return;
    }
    if (member.pinSet && (offlineRef.current || !navigator.onLine)) {
      setError('A PIN needs a connection the first time on this device.');
      return;
    }
    if (member.pinSet) {
      setPinFor(member.id);
      setScreen('pin');
      return;
    }
    try {
      const next = await api<MeResponse>('/api/play', { body: { action: 'select', memberId: member.id } });
      selectedRef.current = next.activeMemberId;
      remember(next);
      clearUndo();
      publishOffline(false);
      setScreen('play');
    } catch (caught) {
      if (!isOfflineError(caught)) throw caught;
      if (!baseRef.current) throw caught;
      selectedRef.current = member.id;
      paint(baseRef.current);
      void saveHouse({ base: baseRef.current, selectedId: member.id });
      publishOffline(true);
      clearUndo();
      setScreen('play');
    }
  }

  async function submitPin(pin: string) {
    if (!pinFor) return;
    try {
      const next = await api<MeResponse>('/api/play', { body: { action: 'select', memberId: pinFor, pin } });
      selectedRef.current = next.activeMemberId;
      remember(next);
      setPinError(null);
      clearUndo();
      publishOffline(false);
      setScreen('play');
    } catch (caught) {
      if (isOfflineError(caught)) setPinError('The PIN needs a connection.');
      else if (caught instanceof ApiError && caught.pinRequired) setPinError(caught.message);
      else setError(caught instanceof Error ? caught.message : 'Could not open that profile.');
    }
  }

  function send(amount: number, record: boolean) {
    const base = baseRef.current;
    const memberId = selectedRef.current ?? base?.activeMemberId;
    if (!base || !memberId) return;
    if (record && amount > 0) {
      undoStack.current.push(amount);
      if (undoStack.current.length > 20) undoStack.current.shift();
      setUndoCount(undoStack.current.length);
    }
    const before = overlay(base, outboxRef.current, memberId).members.find((member) => member.id === memberId);
    const at = Math.max(Date.now(), tapClock.current + 1);
    tapClock.current = at;
    const item: PendingTap = {
      id: crypto.randomUUID(),
      memberId,
      amount,
      at,
      dedication: dedication.trim() || null,
    };
    outboxRef.current = [...outboxRef.current, item];
    const after = paint(base).members.find((member) => member.id === memberId);
    if (crossedGoal(before, after)) setBanner('Saved on this device. The streak updates when you reconnect.');
    void putOutbox(item);
    pending.current += 1;
    queue.current = queue.current
      .then(() => syncOne(item))
      .finally(() => {
        pending.current = Math.max(0, pending.current - 1);
      });
  }

  function undo() {
    const last = undoStack.current.pop();
    setUndoCount(undoStack.current.length);
    if (!last || !data?.activeMemberId) return;
    const member = data.members.find((item) => item.id === data.activeMemberId);
    if (!member) return;
    const floor = member.todayCount >= member.todayGoal ? member.todayGoal : 0;
    const next = Math.max(floor, member.todayCount - last);
    const amount = next - member.todayCount;
    if (amount === 0) return;
    send(amount, false);
  }

  async function createMember(draft: MemberDraft, enter: boolean) {
    const next = await api<MeResponse>('/api/members', {
        body: {
          name: draft.name,
          color: draft.color,
          pin: draft.pin || undefined,
          dailyGoal: draft.dailyGoal ? Number(draft.dailyGoal) : null,
          kids: draft.kids,
          enter,
        },
    });
    if (enter && next.activeMemberId) selectedRef.current = next.activeMemberId;
    remember(next);
    setError(null);
    publishOffline(false);
    if (enter && next.activeMemberId) {
      clearUndo();
      setScreen('play');
    }
  }

  async function logout() {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch (caught) {
      if (isOfflineError(caught)) {
        setError('Log out needs a connection.');
        return;
      }
      throw caught;
    }
    await clearLocalHouse();
    window.location.assign('/');
  }

  function openHouse(from: 'roster' | 'play') {
    setBackTo(from);
    setScreen('house');
  }

  if (!data) {
    return (
      <div className="loading-screen">
        <img className="cover-mark" src="/mark.png" alt="" />
        {error ? (
          <p className="alert" role="alert">
            {error}
          </p>
        ) : (
          <p>Opening the group…</p>
        )}
      </div>
    );
  }

  const active = data.members.find((member) => member.id === data.activeMemberId) ?? null;
  const pinMember = data.members.find((member) => member.id === pinFor) ?? null;
  const syncNote = offline
    ? 'Offline. Counts stay on this device and join the group when you reconnect.'
    : waiting > 0
      ? 'Saving counts to the group…'
      : null;

  return (
    <div className="play-screen">
      <header className="topbar">
        <a className="brand" href="/">
          <img className="brand-mark" src="/mark.png" alt="" />
          <span>
            <strong>{data.family.name}</strong>
            <small>Salawat Challenge</small>
          </span>
        </a>
        <div className="top-actions">
          {screen === 'play' ? (
            <button type="button" className="btn btn-text" onClick={() => setScreen('roster')}>
              Profiles
            </button>
          ) : null}
          {screen !== 'house' && screen !== 'month' && screen !== 'together' ? (
            <button type="button" className="btn btn-text" onClick={() => setScreen('together')}>
              Together
            </button>
          ) : null}
          {screen !== 'month' && screen !== 'house' ? (
            <button type="button" className="btn btn-text" onClick={() => setScreen('month')}>
              Month
            </button>
          ) : null}
          {screen !== 'house' ? (
            <button
              type="button"
              className="btn btn-text"
              onClick={() => openHouse(screen === 'play' ? 'play' : 'roster')}
            >
              Group
            </button>
          ) : null}
          <button type="button" className="btn btn-text" onClick={() => void logout()}>
            Log out
          </button>
        </div>
      </header>

      {syncNote ? (
        <p className="sync-note" role="status">
          {syncNote}
        </p>
      ) : null}

      {error ? (
        <p className="alert" role="alert">
          {error}
        </p>
      ) : null}

      {screen === 'month' ? <MonthView data={data} onBack={() => setScreen(data.activeMemberId ? 'play' : 'roster')} /> : null}

      {screen === 'together' ? (
        <Together
          data={data}
          onOpen={(member) => {
            openMember(member).catch((caught) => {
              setError(caught instanceof Error ? caught.message : 'Could not open that profile.');
            });
          }}
          onCount={() => setScreen('play')}
        />
      ) : null}

      {screen === 'house' ? (
        <House
          data={data}
          onBack={() => setScreen(backTo === 'play' && data.activeMemberId ? 'play' : 'roster')}
          onChange={remember}
          onCreate={createMember}
          onLogout={() => void logout()}
        />
      ) : null}

      {screen === 'roster' ? (
        <Roster
          data={data}
          onOpen={(member) => {
            openMember(member).catch((caught) => {
              setError(caught instanceof Error ? caught.message : 'Could not open that profile.');
            });
          }}
          onCreate={createMember}
        />
      ) : null}

      {screen === 'pin' && pinMember ? (
        <PinPad
          name={pinMember.name}
          color={pinMember.color}
          error={pinError}
          onSubmit={(pin) => void submitPin(pin)}
          onBack={() => {
            setPinError(null);
            setScreen('roster');
          }}
        />
      ) : null}

      {screen === 'play' && active ? (
        <div className="play-layout">
          <Stage
            member={active}
            householdCount={data.family.householdCount}
            householdGoal={data.family.householdGoal}
            phrases={data.phrases}
            dedication={dedication}
            onDedication={setDedication}
            banner={banner}
            canUndo={undoCount > 0}
            onAdd={(amount) => send(amount, true)}
            onUndo={undo}
            onDismiss={() => {
              void api<MeResponse>('/api/play', { body: { action: 'dismiss', memberId: active.id } })
                .then((next) => remember(next))
                .catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not dismiss that.'));
            }}
          />
          <FamilyRail
            members={data.members}
            activeId={data.activeMemberId}
            familyToday={data.familyToday}
            familyTarget={data.familyTarget}
            allDone={data.allDone}
            onOpen={(member) => {
              openMember(member).catch((caught) => {
                setError(caught instanceof Error ? caught.message : 'Could not open that profile.');
              });
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
