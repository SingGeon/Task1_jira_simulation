import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Avatar } from './Avatar';

export function Layout() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <div style={{ display: 'grid', gridTemplateRows: '56px 1fr', height: '100%' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 22,
          padding: '0 20px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
        }}
      >
        <button
          className="btn btn-ghost"
          style={{ padding: '4px 2px', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}
          onClick={() => navigate('/projects')}
        >
          Tracker
        </button>

        <div style={{ width: 1, height: 20, background: 'var(--border)' }} />

        <nav style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <NavTab to="/projects">Proiecte</NavTab>
          {isAdmin && (
            <>
              <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 8px' }} />
              <NavTab to="/admin/join-requests">Cereri</NavTab>
              <NavTab to="/admin/roles">Roluri</NavTab>
              <NavTab to="/admin/users">Utilizatori</NavTab>
            </>
          )}
        </nav>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
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
            <span style={{ fontSize: 13, fontWeight: 500 }}>{user.fullName}</span>
          </NavLink>
          <button className="btn btn-ghost" onClick={logout}>
            Ieșire
          </button>
        </div>
      </header>

      <main style={{ overflow: 'auto', minHeight: 0 }}>
        <Outlet />
      </main>
    </div>
  );
}

function NavTab({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `nav-tab${isActive ? ' active' : ''}`}
      style={({ isActive }) => ({
        padding: '6px 12px',
        borderRadius: 6,
        fontSize: 13,
        fontWeight: 500,
        textDecoration: 'none',
        color: isActive ? 'var(--accent-strong)' : 'var(--muted)',
        background: isActive ? 'var(--accent-soft)' : 'transparent',
      })}
      onMouseEnter={(e) => {
        if (!e.currentTarget.classList.contains('active')) e.currentTarget.style.background = 'var(--surface-sunken)';
      }}
      onMouseLeave={(e) => {
        if (!e.currentTarget.classList.contains('active')) e.currentTarget.style.background = 'transparent';
      }}
    >
      {children}
    </NavLink>
  );
}
