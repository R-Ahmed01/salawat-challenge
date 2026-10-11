import { tasbihPlace } from '@/lib/tasbih';

export function HouseholdBar({ count, goal }: { count: number; goal: number }) {
  const width = goal <= 0 ? 0 : Math.min(100, Math.round((count / goal) * 100));
  return (
    <div className="household">
      <p className="kicker">The household</p>
      <p className="household-count">
        <strong>{count.toLocaleString()}</strong>
        <span> / {goal.toLocaleString()}</span>
      </p>
      <span className="bar" aria-hidden="true">
        <span style={{ width: `${width}%` }} />
      </span>
    </div>
  );
}

export function Tasbih({ count }: { count: number }) {
  const place = tasbihPlace(count);
  return (
    <div className="tasbih" aria-label={count > 0 ? `${place.position} in this round of 99` : 'Tasbih'}>
      {[33, 66, 99].map((bead) => (
        <span key={bead} className={place.position >= bead ? (place.bead === bead ? 'bead landed' : 'bead on') : 'bead'}>
          {bead}
        </span>
      ))}
    </div>
  );
}
