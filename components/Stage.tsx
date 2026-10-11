'use client';

import { useState } from 'react';
import { lifeHint, PHRASES } from '@/lib/copy';
import type { PublicMember, PublicPhrase } from '@/lib/types';
import { Avatar, Flame, Lamps } from './Icons';
import { HouseholdBar, Tasbih } from './Marks';
import { Ring } from './Ring';

export function Stage({
  member,
  householdCount,
  householdGoal,
  phrases,
  dedication,
  onDedication,
  banner,
  canUndo,
  onAdd,
  onUndo,
  onDismiss,
}: {
  member: PublicMember;
  householdCount: number;
  householdGoal: number;
  phrases: PublicPhrase[];
  dedication: string;
  onDedication: (value: string) => void;
  banner: string | null;
  canUndo: boolean;
  onAdd: (amount: number) => void;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  const [phrase, setPhrase] = useState(0);
  const [floaters, setFloaters] = useState<{ id: number; amount: number; x: number }[]>([]);
  const choices = [...PHRASES, ...phrases];
  const words = choices[phrase] ?? choices[0];
  const full = member.todayCount >= member.todayGoal || member.todayDone;
  const reduce =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function add(amount: number) {
    onAdd(amount);
    if (amount > 0 && !reduce) {
      const id = Date.now() + Math.random();
      setFloaters((current) => [...current, { id, amount, x: 36 + Math.random() * 28 }]);
      window.setTimeout(() => {
        setFloaters((current) => current.filter((item) => item.id !== id));
      }, 700);
    }
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(8);
  }

  return (
    <section className={`panel stage ${full ? 'is-done' : ''}`}>
      <div className="stage-head">
        <Avatar name={member.name} color={member.color} size="sm" />
        <div>
          <h1 className="person-name">{member.name}</h1>
          <p className={member.streak > 0 ? 'meta streak-pill' : 'meta'}>
            <Flame /> {member.streak > 0 ? `${member.streak} day streak` : 'No streak yet'}
          </p>
        </div>
        <Lamps lives={member.lives} />
      </div>

      <HouseholdBar count={householdCount} goal={householdGoal} />
      <p className="quiet">Other phones in this group add to this same total.</p>
      <Tasbih count={member.todayCount} />

      {member.notice ? (
        <div className="notice">
          <p>{member.notice}</p>
          <button type="button" className="btn btn-text" onClick={onDismiss}>
            Got it
          </button>
        </div>
      ) : null}

      {member.kids ? (
        <div className="kids">
          <button type="button" className="kids-tap" onClick={() => add(1)} aria-label="Count one salawat">
            <strong>{member.todayCount}</strong>
            <span>/ {member.todayGoal}</span>
            <small>{full ? 'Complete' : 'Tap'}</small>
          </button>
          <p className="phrase" lang="ar" dir="rtl">
            {words.arabic}
          </p>
          <p className="latin">{words.latin}</p>
          <PhraseChoices choices={choices} phrase={phrase} onChoose={setPhrase} />
          <Dedication value={dedication} onChange={onDedication} />
        </div>
      ) : (
        <div className="stage-main">
          <div className="dial">
            <Ring value={member.todayCount} goal={member.todayGoal} />
            <button type="button" className="dial-hit" onClick={() => add(1)} aria-label="Count one salawat">
              <strong>{member.todayCount}</strong>
              <span>/ {member.todayGoal}</span>
              <small>{full ? 'Complete' : 'Tap'}</small>
            </button>
            {floaters.map((floater) => (
              <span key={floater.id} className="floater" style={{ left: `${floater.x}%` }}>
                +{floater.amount}
              </span>
            ))}
          </div>

          <div className="stage-copy">
            <p className="phrase" lang="ar" dir="rtl">
              {words.arabic}
            </p>
            <p className="latin">{words.latin}</p>
            <PhraseChoices choices={choices} phrase={phrase} onChoose={setPhrase} />
            <Dedication value={dedication} onChange={onDedication} />

            <div className="add-row">
              <button type="button" className="add-btn primary" onClick={() => add(1)}>
                +1
              </button>
              <button type="button" className="add-btn" onClick={() => add(10)}>
                +10
              </button>
              <button type="button" className="add-btn" onClick={() => add(33)} title="A tasbih set">
                +33
              </button>
              <button type="button" className="add-btn" onClick={() => add(100)}>
                +100
              </button>
            </div>
            <button type="button" className="btn btn-text undo" onClick={onUndo} disabled={!canUndo}>
              Undo last
            </button>

            {full ? <p className="celebrate">{banner ?? 'Today is complete.'}</p> : <p className="hint">{lifeHint(member)}</p>}
            <p className="quiet">{member.totalSalawat.toLocaleString()} recited</p>
          </div>
        </div>
      )}
    </section>
  );
}

function PhraseChoices({
  choices,
  phrase,
  onChoose,
}: {
  choices: { id: string; label: string }[];
  phrase: number;
  onChoose: (index: number) => void;
}) {
  return (
    <div className="phrases" role="group" aria-label="Phrase to recite">
      {choices.map((item, index) => (
        <button key={item.id} type="button" aria-pressed={phrase === index} onClick={() => onChoose(index)}>
          {item.label}
        </button>
      ))}
    </div>
  );
}

function Dedication({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="field dedication">
      <span>This round is for</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={40}
        placeholder="Optional"
      />
    </label>
  );
}
