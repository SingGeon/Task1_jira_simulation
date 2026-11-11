import type { ReactNode } from 'react';

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'radial-gradient(1200px 500px at 15% -10%, var(--accent-soft), transparent), var(--paper)',
        padding: 20,
      }}
    >
      <div style={{ width: 380, maxWidth: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28, justifyContent: 'center' }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              background: 'var(--accent)',
              display: 'inline-block',
            }}
          />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18 }}>Tracker</span>
        </div>
        <div className="card" style={{ padding: 28 }}>
          <h1 style={{ marginBottom: 6 }}>{title}</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 22 }}>{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}
