import { initials } from '../lib/format';

export function Avatar({ name, size = 26 }: { name: string; size?: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size, minWidth: size, fontSize: size * 0.42 }} title={name}>
      {initials(name)}
    </span>
  );
}
