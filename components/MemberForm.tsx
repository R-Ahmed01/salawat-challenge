'use client';

import { useState } from 'react';
import { GOAL_PRESETS, MEMBER_COLORS, type MemberColor } from '@/lib/types';

export type MemberDraft = {
  name: string;
  color: MemberColor;
  pin: string;
  clearPin: boolean;
  dailyGoal: string;
  kids: boolean;
};

export function MemberForm({
  initial,
  submitLabel,
  allowClearPin = false,
  onSubmit,
  onCancel,
}: {
  initial?: { name: string; color: MemberColor; pinSet: boolean; personalGoal: number | null; kids: boolean };
  submitLabel: string;
  allowClearPin?: boolean;
  onSubmit: (draft: MemberDraft) => Promise<void>;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState<MemberColor>(initial?.color ?? 'emerald');
  const [pin, setPin] = useState('');
  const [clearPin, setClearPin] = useState(false);
  const [dailyGoal, setDailyGoal] = useState(initial?.personalGoal ? String(initial.personalGoal) : '');
  const [kids, setKids] = useState(initial?.kids ?? false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pin && !/^\d{4}$/.test(pin)) {
      setError('A PIN is 4 digits, or leave it empty.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ name, color, pin, clearPin, dailyGoal, kids });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save that profile.');
      setSaving(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <label className="field">
        <span>Name</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="name"
          autoCapitalize="words"
          maxLength={24}
          required
          autoFocus
        />
      </label>
      <div className="field">
        <span>Color</span>
        <div className="swatches" role="radiogroup" aria-label="Color">
          {MEMBER_COLORS.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={color === option}
              aria-label={option}
              className={`swatch tone-${option}`}
              onClick={() => setColor(option)}
            />
          ))}
        </div>
      </div>
      <label className="field">
        <span>{initial?.pinSet ? 'New PIN' : 'PIN, optional'}</span>
        <input
          value={pin}
          onChange={(event) => {
            setPin(event.target.value.replace(/\D/g, '').slice(0, 4));
            setClearPin(false);
          }}
          inputMode="numeric"
          autoComplete="off"
          placeholder={initial?.pinSet ? 'Leave blank to keep the current PIN' : '4 digits'}
          maxLength={4}
        />
      </label>
      <p className="quiet">A PIN keeps other people on this login from counting on this profile.</p>
      <div className="field">
        <span>Personal goal</span>
        <div className="presets">
          <button type="button" className={dailyGoal === '' ? 'preset on' : 'preset'} onClick={() => setDailyGoal('')}>
            Group
          </button>
          {GOAL_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className={dailyGoal === String(preset) ? 'preset on' : 'preset'}
              onClick={() => setDailyGoal(String(preset))}
            >
              {preset}
            </button>
          ))}
        </div>
        <input
          inputMode="numeric"
          value={dailyGoal}
          onChange={(event) => setDailyGoal(event.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder="Or the group goal"
        />
      </div>
      <label className="check">
        <input type="checkbox" checked={kids} onChange={(event) => setKids(event.target.checked)} />
        <span>Kids screen, with a large tap</span>
      </label>
      {allowClearPin && initial?.pinSet ? (
        <label className="check">
          <input
            type="checkbox"
            checked={clearPin}
            onChange={(event) => {
              setClearPin(event.target.checked);
              if (event.target.checked) setPin('');
            }}
          />
          <span>Remove the PIN</span>
        </label>
      ) : null}
      {error ? (
        <p className="alert" role="alert">
          {error}
        </p>
      ) : null}
      <div className="form-actions">
        {onCancel ? (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
        <button type="submit" className="btn btn-gold" disabled={saving}>
          {saving ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
