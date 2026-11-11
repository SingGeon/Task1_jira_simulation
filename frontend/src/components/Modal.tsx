import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function Modal({
  title,
  onClose,
  children,
  width = 480,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10, 14, 13, 0.45)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '8vh 16px',
        zIndex: 100,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="card"
        style={{
          width,
          maxWidth: '100%',
          maxHeight: '82vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 50px -12px rgba(8, 15, 14, 0.35)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <h2>{title}</h2>
          <button className="btn btn-ghost" onClick={onClose} aria-label="Close" style={{ padding: '4px 8px' }}>
            ✕
          </button>
        </div>
        <div style={{ padding: 18, overflowY: 'auto' }}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
