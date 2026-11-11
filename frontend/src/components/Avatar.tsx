import { initials } from '../lib/format';

export function Avatar({ name, size = 26, unassigned = false }: { name?: string; size?: number; unassigned?: boolean }) {
  if (unassigned || !name) {
    return (
      <span
        className="avatar avatar-unassigned"
        style={{ width: size, height: size, minWidth: size }}
        title="Neasignat"
        aria-label="Neasignat"
      >
        <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
          <path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </span>
    );
  }
  return (
    <span className="avatar" style={{ width: size, height: size, minWidth: size, fontSize: size * 0.42 }} title={name}>
      {initials(name)}
    </span>
  );
}
