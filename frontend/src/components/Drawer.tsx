import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function Drawer({ onClose, children, width = 560 }: { onClose: () => void; children: ReactNode; width?: number }) {
  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 90, display: 'flex', justifyContent: 'flex-end' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(10, 14, 13, 0.4)' }} />
      <div
        className="card"
        style={{
          position: 'relative',
          width,
          maxWidth: '100%',
          height: '100%',
          borderRadius: 0,
          borderTop: 'none',
          borderBottom: 'none',
          borderRight: 'none',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-16px 0 40px -14px rgba(8, 15, 14, 0.3)',
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
