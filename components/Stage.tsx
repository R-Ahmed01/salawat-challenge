'use client';

import { useState } from 'react';
import { lifeHint, PHRASES } from '@/lib/copy';
import type { PublicMember } from '@/lib/types';
import { Avatar, Flame, Lamps } from './Icons';
import { Ring } from './Ring';

export function Stage({
  member,
  banner,
  canUndo,
  onAdd,
  onUndo,
  onDismiss,
}: {
  member: PublicMember;
  banner: string | null;
  canUndo: boolean;
  onAdd: (amount: number) => void;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  const [phrase, setPhrase] = useState(0);
  const [floaters, setFloaters] = useState<{ id: number; amount: number; x: number }[]>([]);
  const words = PHRASES[phrase];
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

      {member.notice ? (
        <div className="notice">
          <p>{member.notice}</p>
          <button type="button" className="btn btn-text" onClick={onDismiss}>
            Got it
          </button>
        </div>
      ) : null}

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
          <div className="phrases" role="group" aria-label="Phrase to recite">
            {PHRASES.map((item, index) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={phrase === index}
                onClick={() => setPhrase(index)}
              >
                {item.label}
              </button>
            ))}
          </div>

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

          {full ? (
            <p className="celebrate">
              {banner ??
                (member.streak > 0 ? `Today is complete. Day ${member.streak} of the streak.` : 'Today is complete.')}
            </p>
          ) : (
            <p className="hint">{lifeHint(member)}</p>
          )}
          <p className="quiet">
            Best streak {member.bestStreak} · {member.totalSalawat.toLocaleString()} recited
          </p>
        </div>
      </div>
    </section>
  );
}
