import type { PublicMember } from '@/lib/types';
import { Avatar, Flame } from './Icons';

export function FamilyRail({
  members,
  activeId,
  familyToday,
  familyTarget,
  allDone,
  onOpen,
}: {
  members: PublicMember[];
  activeId: string | null;
  familyToday: number;
  familyTarget: number;
  allDone: boolean;
  onOpen: (member: PublicMember) => void;
}) {
  const ranked = [...members].sort(
    (a, b) => b.todayCount - a.todayCount || a.name.localeCompare(b.name),
  );
  const pct = familyTarget <= 0 ? 0 : Math.min(100, Math.round((familyToday / familyTarget) * 100));

  return (
    <aside className="panel rail">
      <p className="kicker">The group today</p>
      <div className="pot">
        <div className="pot-top">
          <strong>{familyToday.toLocaleString()}</strong>
          <span>/ {familyTarget.toLocaleString()}</span>
        </div>
        <span className="bar">
          <span style={{ width: `${pct}%` }} />
        </span>
        <p>{allDone ? 'Everyone has reached the goal.' : 'Each person keeps their own streak.'}</p>
      </div>
      <ul className="rail-list">
        {ranked.map((member) => {
          const width = Math.min(100, Math.round((member.todayCount / member.todayGoal) * 100));
          const current = member.id === activeId;
          return (
            <li key={member.id}>
              <button
                type="button"
                className={current ? 'rail-row current' : 'rail-row'}
                onClick={() => onOpen(member)}
                aria-current={current ? 'true' : undefined}
              >
                <Avatar name={member.name} color={member.color} size="sm" />
                <span className="rail-copy">
                  <span className="person-name">{member.name}</span>
                  <span className="bar">
                    <span style={{ width: `${width}%` }} />
                  </span>
                </span>
                <span className="rail-stat">
                  <span>{member.todayDone ? 'Done' : member.todayCount}</span>
                  <span className="meta">
                    <Flame /> {member.streak}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
