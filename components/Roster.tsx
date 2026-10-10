'use client';

import { useState } from 'react';
import type { MeResponse, PublicMember } from '@/lib/types';
import { Avatar, Flame, Lamps } from './Icons';
import { MemberForm, type MemberDraft } from './MemberForm';
import { Sheet } from './Sheet';

export function Roster({
  data,
  onOpen,
  onCreate,
}: {
  data: MeResponse;
  onOpen: (member: PublicMember) => void;
  onCreate: (draft: MemberDraft, enter: boolean) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);

  if (data.members.length === 0) {
    return (
      <section className="panel onboard">
        <p className="kicker">{data.family.name}</p>
        <h1>Who recites first?</h1>
        <p className="lede">
          The group login is ready. Add each person who will take part. The same group opens on a phone, a tablet, or a
          computer.
        </p>
        <MemberForm submitLabel="Add and start" onSubmit={(draft) => onCreate(draft, true)} />
      </section>
    );
  }

  return (
    <section className="roster">
      <div className="section-head">
        <p className="kicker">{data.family.name}</p>
        <h1>Who&apos;s reciting?</h1>
        <p className="lede">Pick a profile. The count, streak, and lives stay with that person.</p>
      </div>
      <div className="roster-grid">
        {data.members.map((member) => {
          const pct = Math.min(100, Math.round((member.todayCount / member.todayGoal) * 100));
          const active = member.id === data.activeMemberId;
          return (
            <button key={member.id} type="button" className="roster-card" onClick={() => onOpen(member)}>
              {active ? <span className="playing">Playing</span> : null}
              {member.notice ? <span className="pip">Catch up</span> : null}
              <Avatar name={member.name} color={member.color} />
              <span className="person-name">{member.name}</span>
              <span className="meta">
                <Flame /> {member.streak === 1 ? '1 day' : `${member.streak} days`}
              </span>
              <Lamps lives={member.lives} />
              <span className="bar" aria-hidden="true">
                <span style={{ width: `${pct}%` }} />
              </span>
              <span className="count">
                {member.todayCount}/{member.todayGoal}
                {member.todayDone ? ' · done' : ''}
              </span>
            </button>
          );
        })}
        <button type="button" className="roster-card add-card" onClick={() => setAdding(true)}>
          <span className="plus">+</span>
          <span className="person-name">Add someone</span>
        </button>
      </div>
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
    </section>
  );
}
