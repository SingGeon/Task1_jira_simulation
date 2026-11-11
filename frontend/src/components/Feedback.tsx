export function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
      <div
        style={{
          width: 22,
          height: 22,
          border: '2.5px solid var(--border-strong)',
          borderTopColor: 'var(--accent)',
          borderRadius: '50%',
          animation: 'spin 0.7s linear infinite',
        }}
      />
      <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return <div className="error-banner">{message}</div>;
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="empty-state">
      <strong style={{ color: 'var(--ink-soft)', fontFamily: 'var(--font-display)' }}>{title}</strong>
      {hint && <span style={{ fontSize: 13 }}>{hint}</span>}
    </div>
  );
}
