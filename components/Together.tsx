import { formatJoinCode, type MeResponse, type PublicMember } from '@/lib/types';
import { HouseholdBar } from './Marks';

export function Together({
  data,
  onOpen,
  onCount,
}: {
  data: MeResponse;
  onOpen: (member: PublicMember) => void;
  onCount: () => void;
}) {
  return (
    <section className="together">
      <div className="section-head">
        <p className="kicker">Together</p>
        <h1>One total</h1>
        <p className="lede">
          Pass this phone, or join from another with {formatJoinCode(data.family.joinCode)}. Every tap moves the same
          household total.
        </p>
      </div>
      <div className="panel house-block">
        <HouseholdBar count={data.family.householdCount} goal={data.family.householdGoal} />
      </div>
      <div className="roster-grid">
        {data.members.map((member) => (
          <button key={member.id} type="button" className="roster-card" onClick={() => onOpen(member)}>
            <span className="person-name">{member.name}</span>
            <span className="count">
              {member.todayCount}/{member.todayGoal}
              {member.kids ? ' · kids' : ''}
            </span>
          </button>
        ))}
      </div>
      {data.activeMemberId ? (
        <button type="button" className="btn btn-gold" onClick={onCount}>
          Count
        </button>
      ) : null}
    </section>
  );
}
