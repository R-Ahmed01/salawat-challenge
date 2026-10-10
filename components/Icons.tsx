import type { MemberColor } from '@/lib/types';

const STAR =
  '32.00,6.00 35.83,22.76 50.38,13.62 41.24,28.17 58.00,32.00 41.24,35.83 50.38,50.38 35.83,41.24 32.00,58.00 28.17,41.24 13.62,50.38 22.76,35.83 6.00,32.00 22.76,28.17 13.62,13.62 28.17,22.76';

export function initialOf(name: string): string {
  const first = Array.from(name.trim())[0];
  return first ? first.toLocaleUpperCase() : '?';
}

export function StarMark({ className }: { className?: string }) {
  return (
    <svg className={className ?? 'star-mark'} viewBox="0 0 64 64" aria-hidden="true">
      <polygon fill="currentColor" points={STAR} />
    </svg>
  );
}

export function Flame() {
  return (
    <svg className="flame" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 1.8c1.8 3.2 2.2 5 1.4 6.6.8-.4 1.6-1.4 2-2.6 2.2 2 4.2 4.6 4.2 8.1A7.6 7.6 0 1 1 6.4 14c.6-2.6 2.2-4.4 3.4-5.8-.2 1.6.2 2.8 1 3.6C10.2 9.6 11 6.2 12 1.8z"
      />
    </svg>
  );
}

export function Lamp({ lit }: { lit: boolean }) {
  return (
    <svg className={lit ? 'lamp lit' : 'lamp'} viewBox="0 0 36 48" aria-hidden="true">
      <path className="lamp-cap" d="M16 2h4v5h-4zM12 7h12v2.2H12z" />
      <path
        className="lamp-body"
        d="M18 11.5c6.2 0 10 4.2 10 9.2 0 7.2-4.2 13.2-10 18.3C12.2 33.9 8 27.9 8 20.7c0-5 3.8-9.2 10-9.2z"
      />
      {lit ? (
        <path className="lamp-flame" d="M18 21c1.7 2.5 3.3 3.5 3.3 5.6a3.3 3.3 0 1 1-6.6 0c0-2.1 1.6-3.1 3.3-5.6z" />
      ) : null}
      <path className="lamp-base" d="M12 41.5h12M14.5 45h7" />
    </svg>
  );
}

export function Lamps({ lives, max = 3 }: { lives: number; max?: number }) {
  return (
    <div className="lamps" role="img" aria-label={`${lives} of ${max} lives`}>
      {Array.from({ length: max }, (_, index) => (
        <Lamp key={index} lit={index < lives} />
      ))}
    </div>
  );
}

export function Avatar({
  name,
  color,
  size = 'md',
}: {
  name: string;
  color: MemberColor | string;
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <span className={`avatar tone-${color} size-${size}`} aria-hidden="true">
      {initialOf(name)}
    </span>
  );
}
