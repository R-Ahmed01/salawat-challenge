export function Ring({ value, goal }: { value: number; goal: number }) {
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const progress = goal <= 0 ? 0 : Math.min(1, value / goal);
  const dash = circumference * progress;

  return (
    <svg className={progress >= 1 ? 'ring done' : 'ring'} viewBox="0 0 120 120" aria-hidden="true">
      <circle className="ring-track" cx="60" cy="60" r={radius} />
      <circle className="ring-inner" cx="60" cy="60" r="38" />
      {progress > 0 ? (
        <g transform="rotate(-90 60 60)">
          <circle
            className="ring-value"
            cx="60"
            cy="60"
            r={radius}
            strokeDasharray={`${dash} ${circumference}`}
          />
        </g>
      ) : null}
    </svg>
  );
}
