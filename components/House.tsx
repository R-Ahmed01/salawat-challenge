'use client';

import { useEffect, useState } from 'react';
import { formatJoinCode, GOAL_PRESETS, HOUSEHOLD_PRESETS, type MeResponse, type PublicMember } from '@/lib/types';
import { ApiError, api } from './client-api';
import { Avatar } from './Icons';
import { MemberForm, type MemberDraft } from './MemberForm';
import { RulesList } from './Rules';
import { Sheet } from './Sheet';

export function House({
  data,
  onBack,
  onChange,
  onCreate,
  onLogout,
}: {
  data: MeResponse;
  onBack: () => void;
  onChange: (next: MeResponse) => void;
  onCreate: (draft: MemberDraft, enter: boolean) => Promise<void>;
  onLogout: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<PublicMember | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [goal, setGoal] = useState(String(data.family.dailyGoal));
  const [household, setHousehold] = useState(String(data.family.householdGoal));
  const [phraseLabel, setPhraseLabel] = useState('');
  const [phraseArabic, setPhraseArabic] = useState('');
  const [phraseLatin, setPhraseLatin] = useState('');
  const [name, setName] = useState(data.family.name);
  const [timezone, setTimezone] = useState(data.family.timezone);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setGoal(String(data.family.dailyGoal));
    setHousehold(String(data.family.householdGoal));
    setName(data.family.name);
    setTimezone(data.family.timezone);
  }, [data.family.dailyGoal, data.family.householdGoal, data.family.name, data.family.timezone]);

  async function save(body: unknown, success: string): Promise<boolean> {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const next = await api<MeResponse>('/api/family', { method: 'PATCH', body });
      onChange(next);
      setMessage(success);
      return true;
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save that.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function remove(member: PublicMember) {
    setSaving(true);
    setError(null);
    try {
      const next = await api<MeResponse>(`/api/members/${member.id}`, { method: 'DELETE' });
      onChange(next);
      setEditing(null);
      setConfirming(false);
      setMessage(`${member.name} was removed.`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not remove that profile.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="house">
      <div className="section-head">
        <button type="button" className="btn btn-text back" onClick={onBack}>
          Back
        </button>
        <p className="kicker">The group</p>
        <h1>{data.family.name}</h1>
        <p className="lede">Login: {data.family.email}</p>
      </div>

      {error ? (
        <p className="alert" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p className="notice-line">{message}</p> : null}

      <div className="panel house-block">
        <h2>Other phones</h2>
        <p className="quiet">
          On another phone, choose Join with a code and enter this. Each person still picks their own profile. Every tap
          moves the household total.
        </p>
        <p className="join-code">{formatJoinCode(data.family.joinCode)}</p>
      </div>

      <div className="panel house-block">
        <h2>Household total</h2>
        <p className="quiet">
          {data.family.householdCount.toLocaleString()} of {data.family.householdGoal.toLocaleString()}. Every phone in
          this group moves this same number.
        </p>
        <div className="presets">
          {HOUSEHOLD_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className={data.family.householdGoal === preset ? 'preset on' : 'preset'}
              disabled={saving}
              onClick={() => save({ householdGoal: preset }, `The household total is ${preset.toLocaleString()}.`)}
            >
              {preset.toLocaleString()}
            </button>
          ))}
        </div>
        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            save({ householdGoal: Number(household) }, `The household total is ${Number(household).toLocaleString()}.`);
          }}
        >
          <label className="field">
            <span>Custom total</span>
            <input
              inputMode="numeric"
              value={household}
              onChange={(event) => setHousehold(event.target.value.replace(/\D/g, '').slice(0, 7))}
            />
          </label>
          <button type="submit" className="btn btn-ghost" disabled={saving}>
            Save total
          </button>
        </form>
        <button
          type="button"
          className="btn btn-text"
          disabled={saving}
          onClick={() => save({ resetHousehold: true }, 'The household total starts again.')}
        >
          Start the total again
        </button>
      </div>

      <div className="panel house-block">
        <h2>Daily goal</h2>
        <p className="quiet">
          This is the goal for anyone without their own number. A child can aim for 33 while someone else aims for 300.
        </p>
        <div className="presets">
          {GOAL_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className={data.family.dailyGoal === preset ? 'preset on' : 'preset'}
              disabled={saving}
              onClick={() => save({ dailyGoal: preset }, `Daily goal is ${preset}.`)}
            >
              {preset}
            </button>
          ))}
        </div>
        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            save({ dailyGoal: Number(goal) }, `Daily goal is ${goal}.`);
          }}
        >
          <label className="field">
            <span>Custom goal</span>
            <input
              inputMode="numeric"
              value={goal}
              onChange={(event) => setGoal(event.target.value.replace(/\D/g, '').slice(0, 4))}
            />
          </label>
          <button type="submit" className="btn btn-ghost" disabled={saving}>
            Save goal
          </button>
        </form>
      </div>

      <div className="panel house-block">
        <div className="block-head">
          <h2>Profiles</h2>
          <button type="button" className="btn btn-gold" onClick={() => setAdding(true)}>
            Add someone
          </button>
        </div>
        <ul className="people">
          {data.members.map((member) => (
            <li key={member.id}>
              <Avatar name={member.name} color={member.color} size="sm" />
              <span>
                <strong className="person-name">{member.name}</strong>
                <span className="quiet">
                  {member.personalGoal ?? data.family.dailyGoal} a day
                  {member.kids ? ' · kids screen' : ''}
                  {member.pinSet ? ' · PIN on' : ''}
                </span>
              </span>
              <button type="button" className="btn btn-text" onClick={() => setEditing(member)}>
                Edit
              </button>
            </li>
          ))}
        </ul>
        {data.members.length === 0 ? <p className="quiet">No profiles yet.</p> : null}
      </div>

      <div className="panel house-block">
        <h2>Your salawat</h2>
        <p className="quiet">The short and longer phrases are already there. Add another the group recites.</p>
        <ul className="calm-list">
          {data.phrases.map((phrase) => (
            <li key={phrase.id}>
              <span>
                <strong className="person-name">{phrase.label}</strong>
                <span className="quiet" lang="ar" dir="rtl">
                  {phrase.arabic}
                </span>
              </span>
              <button
                type="button"
                className="btn btn-text"
                onClick={() => {
                  void api<MeResponse>(`/api/phrases/${phrase.id}`, { method: 'DELETE' })
                    .then(onChange)
                    .catch((caught) => {
                      setError(caught instanceof ApiError ? caught.message : 'Could not remove that salawat.');
                    });
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <div className="form">
          <label className="field">
            <span>Name</span>
            <input value={phraseLabel} onChange={(event) => setPhraseLabel(event.target.value)} maxLength={24} />
          </label>
          <label className="field">
            <span>Arabic</span>
            <input value={phraseArabic} onChange={(event) => setPhraseArabic(event.target.value)} lang="ar" dir="rtl" />
          </label>
          <label className="field">
            <span>Transliteration</span>
            <input value={phraseLatin} onChange={(event) => setPhraseLatin(event.target.value)} />
          </label>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={saving}
            onClick={() => {
              void (async () => {
                setSaving(true);
                setError(null);
                try {
                  const next = await api<MeResponse>('/api/phrases', {
                    body: { label: phraseLabel, arabic: phraseArabic, latin: phraseLatin },
                  });
                  onChange(next);
                  setPhraseLabel('');
                  setPhraseArabic('');
                  setPhraseLatin('');
                  setMessage('Salawat added.');
                } catch (caught) {
                  setError(caught instanceof ApiError ? caught.message : 'Could not add that salawat.');
                } finally {
                  setSaving(false);
                }
              })();
            }}
          >
            Add salawat
          </button>
        </div>
      </div>

      <div className="panel house-block">
        <h2>Group details</h2>
        <form
          className="form"
          onSubmit={(event) => {
            event.preventDefault();
            save({ name, timezone }, 'Group details saved.');
          }}
        >
          <label className="field">
            <span>Group name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} maxLength={40} required />
          </label>
          <label className="field">
            <span>Timezone</span>
            <input value={timezone} onChange={(event) => setTimezone(event.target.value)} required />
          </label>
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-text"
              onClick={() => {
                const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                if (zone) setTimezone(zone);
              }}
            >
              Use this device
            </button>
            <button type="submit" className="btn btn-ghost" disabled={saving}>
              Save details
            </button>
          </div>
        </form>
      </div>

      <div className="panel house-block">
        <h2>Password</h2>
        <form
          className="form"
          onSubmit={(event) => {
            event.preventDefault();
            if (newPassword !== confirmPassword) {
              setError('Those new passwords do not match.');
              return;
            }
            void save({ currentPassword, newPassword }, 'Password updated.').then((ok) => {
              if (!ok) return;
              setCurrentPassword('');
              setNewPassword('');
              setConfirmPassword('');
            });
          }}
        >
          <label className="field">
            <span>Current password</span>
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <label className="field">
            <span>New password</span>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          <label className="field">
            <span>Confirm new password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          <button type="submit" className="btn btn-ghost" disabled={saving}>
            Change password
          </button>
        </form>
      </div>

      <div className="panel house-block">
        <h2>How lives work</h2>
        <RulesList />
      </div>

      <button type="button" className="btn btn-text logout-row" onClick={onLogout}>
        Log out
      </button>

      {adding ? (
        <Sheet title="Add someone" onClose={() => setAdding(false)}>
          <MemberForm
            submitLabel="Add profile"
            onCancel={() => setAdding(false)}
            onSubmit={async (draft) => {
              await onCreate(draft, false);
              setAdding(false);
            }}
          />
        </Sheet>
      ) : null}

      {editing ? (
        <Sheet
          title={`Edit ${editing.name}`}
          onClose={() => {
            setEditing(null);
            setConfirming(false);
          }}
        >
          <MemberForm
            initial={{
              name: editing.name,
              color: editing.color,
              pinSet: editing.pinSet,
              personalGoal: editing.personalGoal,
              kids: editing.kids,
            }}
            allowClearPin
            submitLabel="Save profile"
            onCancel={() => setEditing(null)}
            onSubmit={async (draft) => {
              const next = await api<MeResponse>(`/api/members/${editing.id}`, {
                method: 'PATCH',
                body: {
                  name: draft.name,
                  color: draft.color,
                  dailyGoal: draft.dailyGoal ? Number(draft.dailyGoal) : null,
                  kids: draft.kids,
                  ...(draft.pin ? { pin: draft.pin } : {}),
                  ...(draft.clearPin ? { clearPin: true } : {}),
                },
              });
              onChange(next);
              setEditing(null);
              setMessage('Profile saved.');
            }}
          />
          {confirming ? (
            <div className="confirm">
              <p>Remove {editing.name}? This clears their counts.</p>
              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setConfirming(false)}>
                  Keep
                </button>
                <button type="button" className="btn btn-danger" disabled={saving} onClick={() => remove(editing)}>
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn btn-text danger-text" onClick={() => setConfirming(true)}>
              Remove this profile
            </button>
          )}
        </Sheet>
      ) : null}
    </section>
  );
}
