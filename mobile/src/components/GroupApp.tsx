import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { ApiError } from '@/api';
import { completionMessage, PHRASES } from '@/copy';
import { PinPad } from '@/components/PinPad';
import { Alert, Field, GoldButton, TextButton } from '@/components/ui';
import { takeDedication } from '@/dedication';
import { overlay } from '@/offline';
import { loadOutbox, saveOutbox } from '@/outbox';
import { useSession } from '@/session';
import { tasbihPlace } from '@/tasbih';
import { theme, tones } from '@/theme';
import {
  formatJoinCode,
  GOAL_PRESETS,
  HOUSEHOLD_PRESETS,
  MEMBER_COLORS,
  type MeResponse,
  type MemberColor,
  type MonthResponse,
  type PendingTap,
  type PlayResponse,
  type PublicMember,
  type PublicPhrase,
} from '@/types';

type Mode = 'roster' | 'pin' | 'play' | 'add' | 'together' | 'month' | 'group';

export function GroupApp() {
  const router = useRouter();
  const { api, setPlayer, signOut } = useSession();
  const [data, setData] = useState<MeResponse | null>(null);
  const [mode, setMode] = useState<Mode>('roster');
  const [pinFor, setPinFor] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [dedication, setDedication] = useState(takeDedication);
  const [offline, setOffline] = useState(false);
  const [undoCount, setUndoCount] = useState(0);
  const baseRef = useRef<MeResponse | null>(null);
  const outboxRef = useRef<PendingTap[]>([]);
  const queue = useRef(Promise.resolve());
  const undoStack = useRef<number[]>([]);
  const offlineRef = useRef(false);

  const remember = useCallback((next: MeResponse) => {
    baseRef.current = stripPlayer(next);
    setData(overlay(baseRef.current, outboxRef.current));
    return next;
  }, []);

  const fail = useCallback(
    async (caught: unknown, fallback: string) => {
      if (caught instanceof ApiError && caught.status === 401 && !caught.pinRequired) {
        await signOut();
        router.replace('/');
        return;
      }
      setError(caught instanceof Error ? caught.message : fallback);
    },
    [router, signOut],
  );

  useEffect(() => {
    let gone = false;
    void loadOutbox().then((saved) => {
      if (gone) return;
      outboxRef.current = saved;
      api<MeResponse>('/api/me')
        .then((next) => {
          if (gone) return;
          offlineRef.current = false;
          setOffline(false);
          remember(next);
          setMode(next.activeMemberId && next.members.length > 0 ? 'play' : 'roster');
          if (saved.length > 0) flush();
        })
        .catch((caught) => {
          if (gone) return;
          if (caught instanceof ApiError && caught.status === 0 && baseRef.current) {
            offlineRef.current = true;
            setOffline(true);
            return;
          }
          void fail(caught, 'Could not open the group.');
        });
    });
    return () => {
      gone = true;
    };
    // Load once. Later taps use the latest session, including a newly chosen profile.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      if (offlineRef.current || outboxRef.current.length > 0) return;
      api<MeResponse>('/api/me')
        .then((next) => {
          if (outboxRef.current.length > 0) return;
          offlineRef.current = false;
          setOffline(false);
          remember(next);
        })
        .catch((caught) => {
          if (caught instanceof ApiError && caught.status === 0) {
            offlineRef.current = true;
            setOffline(true);
          }
        });
    }, 2000);
    return () => clearInterval(timer);
  }, [api, remember]);

  function paint() {
    const base = baseRef.current;
    if (base) setData(overlay(base, outboxRef.current));
  }

  async function syncOne(item: PendingTap) {
    if (!outboxRef.current.some((op) => op.id === item.id)) return;
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
      await saveOutbox(outboxRef.current);
      offlineRef.current = false;
      setOffline(false);
      baseRef.current = stripPlayer(next);
      paint();
      if (next.justCompleted && outboxRef.current.length === 0) {
        setBanner(completionMessage(next, Boolean(next.lifeEarned)));
      }
    } catch (caught) {
      if (caught instanceof ApiError && (caught.status === 0 || caught.status >= 500)) {
        offlineRef.current = true;
        setOffline(true);
        return;
      }
      outboxRef.current = outboxRef.current.filter((op) => op.id !== item.id);
      await saveOutbox(outboxRef.current);
      paint();
      await fail(caught, 'The count did not save.');
      const fresh = await api<MeResponse>('/api/me').catch(() => null);
      if (fresh) remember(fresh);
    }
  }

  function flush() {
    queue.current = queue.current.then(async () => {
      for (const item of [...outboxRef.current]) {
        if (offlineRef.current) break;
        await syncOne(item);
      }
    });
  }

  async function openMember(member: PublicMember) {
    setError(null);
    setPinError(null);
    if (member.pinSet) {
      setPinFor(member.id);
      setMode('pin');
      return;
    }
    try {
      const next = await api<MeResponse>('/api/play', { body: { action: 'select', memberId: member.id } });
      if (next.playerToken) await setPlayer(next.playerToken);
      remember(next);
      undoStack.current = [];
      setUndoCount(0);
      setBanner(null);
      setMode('play');
    } catch (caught) {
      await fail(caught, 'Could not open that profile.');
    }
  }

  async function submitPin(pin: string) {
    if (!pinFor) return;
    setPinError(null);
    try {
      const next = await api<MeResponse>('/api/play', {
        body: { action: 'select', memberId: pinFor, pin },
      });
      if (next.playerToken) await setPlayer(next.playerToken);
      remember(next);
      setPinError(null);
      undoStack.current = [];
      setUndoCount(0);
      setMode('play');
    } catch (caught) {
      if (caught instanceof ApiError && caught.pinRequired) setPinError(caught.message);
      else await fail(caught, 'Could not open that profile.');
    }
  }

  function send(amount: number, record: boolean) {
    const base = baseRef.current;
    const memberId = base?.activeMemberId;
    if (!base || !memberId) return;
    if (record && amount > 0) {
      undoStack.current.push(amount);
      if (undoStack.current.length > 20) undoStack.current.shift();
      setUndoCount(undoStack.current.length);
    }
    const item: PendingTap = {
      id: crypto.randomUUID(),
      memberId,
      amount,
      at: Date.now(),
      dedication: dedication.trim() || null,
    };
    outboxRef.current = [...outboxRef.current, item];
    void saveOutbox(outboxRef.current);
    paint();
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    offlineRef.current = false;
    queue.current = queue.current.then(() => syncOne(item));
  }

  function undo() {
    const last = undoStack.current.pop();
    setUndoCount(undoStack.current.length);
    if (!last) return;
    send(-last, false);
  }

  async function createMember(
    name: string,
    color: MemberColor,
    pin: string,
    dailyGoal: string,
    kids: boolean,
    enter: boolean,
  ) {
    const next = await api<MeResponse>('/api/members', {
      body: { name, color, pin: pin || undefined, dailyGoal: dailyGoal ? Number(dailyGoal) : null, kids, enter },
    });
    if (enter && next.playerToken) await setPlayer(next.playerToken);
    remember(next);
    setError(null);
    setMode(enter && next.activeMemberId ? 'play' : 'roster');
  }

  async function logout() {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch (caught) {
      if (!(caught instanceof ApiError) || caught.status !== 401) {
        await fail(caught, 'Could not log out.');
        return;
      }
    }
    await signOut();
    router.replace('/');
  }

  if (!data) {
    return (
      <View style={styles.loading}>
        <Image source={require('../../assets/mark.png')} style={styles.loadingMark} />
        <Alert message={error} />
        {!error ? <Text style={styles.muted}>Opening the group…</Text> : null}
      </View>
    );
  }

  const active = data.members.find((member) => member.id === data.activeMemberId) ?? null;
  const pinMember = data.members.find((member) => member.id === pinFor) ?? null;

  return (
    <View style={styles.flex}>
      <View style={styles.topbar}>
        <View>
          <Text style={styles.groupName}>{data.family.name}</Text>
          <Text style={styles.muted}>Salawat Challenge</Text>
        </View>
        <View style={styles.topActions}>
          {mode === 'play' ? <TextButton label="Profiles" onPress={() => setMode('roster')} /> : null}
          {mode === 'play' || mode === 'roster' ? <TextButton label="Together" onPress={() => setMode('together')} /> : null}
          {mode === 'play' || mode === 'roster' ? <TextButton label="Month" onPress={() => setMode('month')} /> : null}
          {mode === 'play' || mode === 'roster' ? <TextButton label="Group" onPress={() => setMode('group')} /> : null}
          <TextButton label="Log out" onPress={() => void logout()} />
        </View>
      </View>
      {offline ? (
        <Text style={styles.muted}>Saved on this phone. The household total updates when you reconnect.</Text>
      ) : null}
      <Alert message={error} />

      {mode === 'together' ? (
        <Together data={data} onOpen={(member) => void openMember(member)} onBack={() => setMode('roster')} />
      ) : null}
      {mode === 'month' ? <MonthPage onBack={() => setMode('roster')} /> : null}
      {mode === 'group' ? <GroupPage data={data} onChange={remember} onBack={() => setMode('roster')} /> : null}

      {mode === 'pin' && pinMember ? (
        <PinPad
          name={pinMember.name}
          error={pinError}
          onSubmit={(pin) => void submitPin(pin)}
          onBack={() => {
            setPinError(null);
            setMode('roster');
          }}
        />
      ) : null}

      {mode === 'add' || (mode === 'roster' && data.members.length === 0) ? (
        <AddPerson
          first={data.members.length === 0}
          onCancel={data.members.length === 0 ? null : () => setMode('roster')}
          onCreate={async (name, color, pin, dailyGoal, kids, enter) => {
            try {
              await createMember(name, color, pin, dailyGoal, kids, enter);
            } catch (caught) {
              if (caught instanceof ApiError && caught.status === 401 && !caught.pinRequired) {
                await signOut();
                router.replace('/');
                return;
              }
              throw caught;
            }
          }}
        />
      ) : null}

      {mode === 'roster' && data.members.length > 0 ? (
        <ScrollView contentContainerStyle={styles.roster}>
          <Text style={styles.kicker}>{data.family.name}</Text>
          <Text style={styles.title}>Who’s reciting?</Text>
          {data.members.map((member) => (
            <Pressable key={member.id} onPress={() => void openMember(member)} style={styles.card}>
              <View style={[styles.avatar, { backgroundColor: tones[member.color] }]}>
                <Text style={styles.avatarText}>{member.name.slice(0, 1)}</Text>
              </View>
              <View style={styles.cardCopy}>
                <Text style={styles.person}>{member.name}</Text>
                <Text style={styles.muted}>
                  {member.todayCount}/{member.todayGoal}
                  {member.todayDone ? ' · done' : ''} · {member.streak} day streak
                </Text>
              </View>
            </Pressable>
          ))}
          <GoldButton label="Add someone" onPress={() => setMode('add')} />
        </ScrollView>
      ) : null}

      {mode === 'play' && active ? (
        <PlayStage
          member={active}
          phrases={data.phrases}
          householdCount={data.family.householdCount}
          householdGoal={data.family.householdGoal}
          dedication={dedication}
          onDedication={setDedication}
          banner={banner}
          canUndo={undoCount > 0}
          onAdd={(amount) => send(amount, true)}
          onUndo={undo}
          onDismiss={() => {
            void api<MeResponse>('/api/play', { body: { action: 'dismiss', memberId: active.id } })
              .then((next) => remember(next))
              .catch((caught) => void fail(caught, 'Could not dismiss that.'));
          }}
        />
      ) : null}
    </View>
  );
}

function PlayStage({
  member,
  phrases,
  householdCount,
  householdGoal,
  dedication,
  onDedication,
  banner,
  canUndo,
  onAdd,
  onUndo,
  onDismiss,
}: {
  member: PublicMember;
  phrases: PublicPhrase[];
  householdCount: number;
  householdGoal: number;
  dedication: string;
  onDedication: (value: string) => void;
  banner: string | null;
  canUndo: boolean;
  onAdd: (amount: number) => void;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  const [phrase, setPhrase] = useState(0);
  const choices = [...PHRASES, ...phrases];
  const words = choices[phrase] ?? choices[0];
  const full = member.todayCount >= member.todayGoal || member.todayDone;
  const place = tasbihPlace(member.todayCount);
  const width = householdGoal <= 0 ? 0 : Math.min(100, Math.round((householdCount / householdGoal) * 100));

  return (
    <ScrollView contentContainerStyle={styles.play}>
      <Text style={styles.kicker}>The household</Text>
      <Text style={styles.count}>
        {householdCount.toLocaleString()}
        <Text style={styles.goal}> / {householdGoal.toLocaleString()}</Text>
      </Text>
      <View style={styles.track}>
        <View style={[styles.trackFill, { width: `${width}%` }]} />
      </View>
      <Text style={styles.muted}>Other phones in this group add to this same total.</Text>
      <View style={styles.phraseRow}>
        {[33, 66, 99].map((bead) => (
          <Text key={bead} style={[styles.chipText, place.position >= bead && styles.chipTextOn]}>
            {bead}
          </Text>
        ))}
      </View>
      {member.notice ? (
        <View style={styles.notice}>
          <Text style={styles.cream}>{member.notice}</Text>
          <TextButton label="Got it" onPress={onDismiss} />
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Count one salawat"
        onPress={() => onAdd(1)}
        style={[member.kids ? styles.kidsTap : styles.dial, full && styles.dialDone]}
      >
        <Text style={styles.count}>{member.todayCount}</Text>
        <Text style={styles.goal}>/ {member.todayGoal}</Text>
        <Text style={styles.muted}>{full ? 'Complete' : 'Tap'}</Text>
      </Pressable>
      <Text style={styles.arabic}>{words?.arabic}</Text>
      <Text style={styles.latin}>{words?.latin}</Text>
      <View style={styles.phraseRow}>
        {choices.map((item, index) => (
          <Pressable key={item.id} onPress={() => setPhrase(index)} style={[styles.chip, phrase === index && styles.chipOn]}>
            <Text style={[styles.chipText, phrase === index && styles.chipTextOn]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
      <Field label="This round is for" value={dedication} onChangeText={onDedication} maxLength={40} placeholder="Optional" />
      {member.kids ? null : (
        <View style={styles.addRow}>
          {[1, 10, 33, 100].map((amount) => (
            <Pressable
              key={amount}
              accessibilityRole="button"
              accessibilityLabel={`Add ${amount}`}
              onPress={() => onAdd(amount)}
              style={[styles.add, amount === 1 && styles.addPrimary]}
            >
              <Text style={[styles.addText, amount === 1 && styles.addTextPrimary]}>+{amount}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <TextButton label="Undo last" onPress={canUndo ? onUndo : () => undefined} />
      <Text style={styles.hint}>{full ? (banner ?? 'Today is complete.') : `${member.name} · ${member.todayCount} today`}</Text>
    </ScrollView>
  );
}

function AddPerson({
  first,
  onCancel,
  onCreate,
}: {
  first: boolean;
  onCancel: (() => void) | null;
  onCreate: (name: string, color: MemberColor, pin: string, dailyGoal: string, kids: boolean, enter: boolean) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState<MemberColor>('emerald');
  const [pin, setPin] = useState('');
  const [dailyGoal, setDailyGoal] = useState('');
  const [kids, setKids] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(enter: boolean) {
    if (pin && !/^\d{4}$/.test(pin)) {
      setError('A PIN is 4 digits.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onCreate(name.trim(), color, pin, dailyGoal, kids, enter);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not add that profile.');
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.roster} keyboardShouldPersistTaps="handled">
      <Text style={styles.kicker}>{first ? 'New group' : 'Profile'}</Text>
      <Text style={styles.title}>{first ? 'Who recites first?' : 'Add someone'}</Text>
      <Field label="Name" value={name} onChangeText={setName} maxLength={24} />
      <Text style={styles.label}>Color</Text>
      <View style={styles.colors}>
        {MEMBER_COLORS.map((item) => (
          <Pressable
            key={item}
            onPress={() => setColor(item)}
            style={[styles.swatch, { backgroundColor: tones[item] }, color === item && styles.swatchOn]}
          />
        ))}
      </View>
      <Field
        label="PIN, optional"
        value={pin}
        onChangeText={(value) => setPin(value.replace(/\D/g, '').slice(0, 4))}
        keyboardType="number-pad"
        maxLength={4}
        secureTextEntry
      />
      <Field
        label="Personal goal, optional"
        value={dailyGoal}
        onChangeText={(value) => setDailyGoal(value.replace(/\D/g, '').slice(0, 4))}
        keyboardType="number-pad"
        placeholder="33, 100, 300"
      />
      <Pressable onPress={() => setKids((value) => !value)}>
        <Text style={styles.cream}>{kids ? 'Kids screen on' : 'Use the kids screen'}</Text>
      </Pressable>
      <Alert message={error} />
      <GoldButton
        label={saving ? 'One moment…' : first ? 'Add and start' : 'Add profile'}
        disabled={saving || name.trim().length === 0}
        onPress={() => void submit(first)}
      />
      {onCancel ? <TextButton label="Cancel" onPress={onCancel} /> : null}
    </ScrollView>
  );
}

function Together({
  data,
  onOpen,
  onBack,
}: {
  data: MeResponse;
  onOpen: (member: PublicMember) => void;
  onBack: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.roster}>
      <TextButton label="Back" onPress={onBack} />
      <Text style={styles.kicker}>Together</Text>
      <Text style={styles.title}>One total</Text>
      <Text style={styles.muted}>
        Pass this phone, or on another phone choose Join a group and enter {formatJoinCode(data.family.joinCode)}. Every
        tap moves the same number.
      </Text>
      <Text style={styles.joinCode}>{formatJoinCode(data.family.joinCode)}</Text>
      <Text style={styles.count}>
        {data.family.householdCount.toLocaleString()}
        <Text style={styles.goal}> / {data.family.householdGoal.toLocaleString()}</Text>
      </Text>
      {data.members.map((member) => (
        <Pressable key={member.id} onPress={() => onOpen(member)} style={styles.card}>
          <Text style={styles.person}>{member.name}</Text>
          <Text style={styles.muted}>
            {member.todayCount}/{member.todayGoal}
            {member.kids ? ' · kids' : ''}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function MonthPage({ onBack }: { onBack: () => void }) {
  const { api } = useSession();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [page, setPage] = useState<MonthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let gone = false;
    api<MonthResponse>(`/api/month?month=${month}`)
      .then((next) => {
        if (!gone) setPage(next);
      })
      .catch((caught) => {
        if (!gone) setError(caught instanceof Error ? caught.message : 'Could not open this month.');
      });
    return () => {
      gone = true;
    };
  }, [api, month]);

  return (
    <ScrollView contentContainerStyle={styles.roster}>
      <TextButton label="Back" onPress={onBack} />
      <Text style={styles.title}>{month}</Text>
      <View style={styles.topActions}>
        <TextButton label="Previous" onPress={() => setMonth((current) => shiftMonth(current, -1))} />
        <TextButton label="Next" onPress={() => setMonth((current) => shiftMonth(current, 1))} />
      </View>
      <Alert message={error} />
      {page ? (
        <>
          <Text style={styles.person}>{page.recited.toLocaleString()} recited this month</Text>
          {page.showedUp.map((person) => (
            <Text key={person.id} style={styles.muted}>
              {person.name} · {person.days} {person.days === 1 ? 'day' : 'days'}
            </Text>
          ))}
          {page.days.map((day) => (
            <Text key={day.date} style={styles.cream}>
              {day.date} · {day.total.toLocaleString()} · {day.people.map((person) => person.name).join(', ')}
            </Text>
          ))}
          {page.dedications.map((item) => (
            <Text key={`${item.date}${item.memberName}${item.name}`} style={styles.muted}>
              {item.count} for {item.name} · {item.memberName}
            </Text>
          ))}
        </>
      ) : (
        <Text style={styles.muted}>Opening the month…</Text>
      )}
    </ScrollView>
  );
}

function GroupPage({
  data,
  onChange,
  onBack,
}: {
  data: MeResponse;
  onChange: (next: MeResponse) => void;
  onBack: () => void;
}) {
  const { api } = useSession();
  const [label, setLabel] = useState('');
  const [arabic, setArabic] = useState('');
  const [latin, setLatin] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function saveGoal(goal: number) {
    const next = await api<MeResponse>('/api/family', { method: 'PATCH', body: { householdGoal: goal } });
    onChange(next);
  }

  return (
    <ScrollView contentContainerStyle={styles.roster} keyboardShouldPersistTaps="handled">
      <TextButton label="Back" onPress={onBack} />
      <Text style={styles.kicker}>Other phones</Text>
      <Text style={styles.muted}>Join a group on the other phone and enter this code. Each person picks their own profile.</Text>
      <Text style={styles.joinCode}>{formatJoinCode(data.family.joinCode)}</Text>
      <Text style={styles.kicker}>The household</Text>
      <Text style={styles.muted}>
        {data.family.householdCount.toLocaleString()} of {data.family.householdGoal.toLocaleString()}
      </Text>
      <View style={styles.phraseRow}>
        {HOUSEHOLD_PRESETS.map((preset) => (
          <Pressable key={preset} onPress={() => void saveGoal(preset)} style={styles.chip}>
            <Text style={styles.chipText}>{preset.toLocaleString()}</Text>
          </Pressable>
        ))}
      </View>
      <TextButton
        label="Start the total again"
        onPress={() => {
          void api<MeResponse>('/api/family', { method: 'PATCH', body: { resetHousehold: true } }).then(onChange);
        }}
      />
      <Text style={styles.title}>Your salawat</Text>
      {data.phrases.map((phrase) => (
        <Text key={phrase.id} style={styles.cream}>
          {phrase.label}
        </Text>
      ))}
      <Field label="Name" value={label} onChangeText={setLabel} maxLength={24} />
      <Field label="Arabic" value={arabic} onChangeText={setArabic} />
      <Field label="Transliteration" value={latin} onChangeText={setLatin} />
      <Alert message={error} />
      <GoldButton
        label="Add salawat"
        onPress={() => {
          void api<MeResponse>('/api/phrases', { body: { label, arabic, latin } })
            .then((next) => {
              onChange(next);
              setLabel('');
              setArabic('');
              setLatin('');
            })
            .catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not add that salawat.'));
        }}
      />
    </ScrollView>
  );
}

function shiftMonth(month: string, delta: number): string {
  const [yearText, monthText] = month.split('-');
  const date = new Date(Date.UTC(Number(yearText), Number(monthText) - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

function stripPlayer(next: MeResponse): MeResponse {
  const copy = { ...next };
  delete copy.playerToken;
  return copy;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  loadingMark: { width: 84, height: 144 },
  brand: { color: theme.gold, fontSize: 28 },
  topbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  topActions: { flexDirection: 'row', gap: 8 },
  groupName: { color: theme.cream, fontSize: 18, fontWeight: '700' },
  muted: { color: theme.muted, fontSize: 14 },
  roster: { padding: 20, gap: 14 },
  joinCode: { color: theme.gold, fontSize: 32, letterSpacing: 4 },
  kicker: { color: theme.gold, letterSpacing: 1.2, textTransform: 'uppercase', fontSize: 12 },
  title: { color: theme.cream, fontSize: 32, marginBottom: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.panel,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.line,
  },
  cardCopy: { flex: 1, gap: 2 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#07140f', fontWeight: '700', fontSize: 18 },
  person: { color: theme.cream, fontSize: 18 },
  play: { padding: 20, gap: 14, alignItems: 'center' },
  stageHead: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'stretch' },
  lives: { color: theme.gold, fontSize: 16 },
  notice: {
    alignSelf: 'stretch',
    backgroundColor: theme.panel,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  cream: { color: theme.cream },
  dial: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 8,
    borderColor: theme.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  dialDone: { borderColor: '#49c48a' },
  kidsTap: {
    width: 280,
    height: 280,
    borderRadius: 140,
    borderWidth: 8,
    borderColor: theme.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: { alignSelf: 'stretch', height: 8, borderRadius: 99, backgroundColor: 'rgba(246,241,228,0.12)' },
  trackFill: { height: 8, borderRadius: 99, backgroundColor: theme.gold },
  count: { color: theme.cream, fontSize: 56, fontWeight: '700' },
  goal: { color: theme.muted, fontSize: 18 },
  arabic: { color: theme.cream, fontSize: 28, textAlign: 'center', writingDirection: 'rtl' },
  latin: { color: theme.muted, textAlign: 'center' },
  phraseRow: { flexDirection: 'row', gap: 8 },
  chip: { borderWidth: 1, borderColor: theme.line, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  chipOn: { backgroundColor: theme.gold },
  chipText: { color: theme.cream },
  chipTextOn: { color: '#2a1c08', fontWeight: '700' },
  addRow: { flexDirection: 'row', gap: 8, alignSelf: 'stretch' },
  add: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addPrimary: { backgroundColor: theme.gold, borderColor: theme.gold },
  addText: { color: theme.cream, fontWeight: '700' },
  addTextPrimary: { color: '#2a1c08' },
  hint: { color: theme.cream, textAlign: 'center' },
  label: { color: theme.muted, fontSize: 13 },
  colors: { flexDirection: 'row', gap: 10 },
  swatch: { width: 32, height: 32, borderRadius: 16 },
  swatchOn: { borderWidth: 2, borderColor: theme.cream },
});
