import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Paginated, User } from '../lib/types';
import { Avatar } from './Avatar';

export function UserPicker({ value, onChange, placeholder }: { value: User | null; onChange: (u: User | null) => void; placeholder?: string }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      api
        .get<Paginated<User>>('/users', { q, limit: 8 })
        .then((r) => setResults(r.items))
        .catch(() => setResults([]));
    }, 200);
    return () => clearTimeout(t);
  }, [q, open]);

  if (value) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius)',
          padding: '5px 8px',
        }}
      >
        <Avatar name={value.fullName} size={22} />
        <span style={{ fontSize: 13, flex: 1 }}>
          {value.fullName} <span style={{ color: 'var(--muted)' }}>· {value.email}</span>
        </span>
        <button className="btn btn-ghost" style={{ padding: '2px 8px' }} onClick={() => onChange(null)}>
          ✕
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        className="input"
        placeholder={placeholder ?? 'Caută după nume sau e-mail…'}
        value={q}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
      />
      {open && (
        <div
          className="card"
          style={{
            position: 'absolute',
            top: '110%',
            left: 0,
            right: 0,
            zIndex: 20,
            maxHeight: 220,
            overflowY: 'auto',
            boxShadow: '0 12px 30px -10px rgba(8,15,14,0.3)',
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {results.length === 0 && <div style={{ padding: 10, fontSize: 13, color: 'var(--muted)' }}>Niciun rezultat</div>}
          {results.map((u) => (
            <button
              key={u.id}
              className="btn btn-ghost"
              style={{ width: '100%', justifyContent: 'flex-start', borderRadius: 0, padding: '8px 10px' }}
              onClick={() => {
                onChange(u);
                setOpen(false);
                setQ('');
              }}
            >
              <Avatar name={u.fullName} size={22} />
              <span style={{ fontSize: 13 }}>
                {u.fullName} <span style={{ color: 'var(--muted)' }}>· {u.email}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
