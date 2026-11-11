import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Avatar } from './Avatar';
import { Sidebar } from './Sidebar';

export function Layout() {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', height: '100%' }}>
      <Sidebar />
      <div style={{ display: 'grid', gridTemplateRows: '56px 1fr', minHeight: 0 }}>
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 14,
            padding: '0 20px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface)',
          }}
        >
          <NavLink
            to="/profile"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              textDecoration: 'none',
              color: 'var(--ink)',
              padding: '4px 8px 4px 4px',
              borderRadius: 999,
              transition: 'background 0.12s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-sunken)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <Avatar name={user.fullName} />
            <span style={{ fontSize: 14, fontWeight: 500 }}>{user.fullName}</span>
          </NavLink>
          <button className="btn btn-ghost" onClick={logout}>
            Ieșire
          </button>
        </header>

        <main style={{ overflow: 'auto', minHeight: 0 }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
