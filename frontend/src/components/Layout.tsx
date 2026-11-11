import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Avatar } from './Avatar';

export function Layout() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <div style={{ display: 'grid', gridTemplateRows: '52px 1fr', height: '100%' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          padding: '0 18px',
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

        <nav style={{ display: 'flex', gap: 4 }}>
          <NavTab to="/projects">Proiecte</NavTab>
          {isAdmin && <NavTab to="/admin/join-requests">Cereri</NavTab>}
          {isAdmin && <NavTab to="/admin/roles">Roluri</NavTab>}
          {isAdmin && <NavTab to="/admin/users">Utilizatori</NavTab>}
        </nav>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <NavLink
            to="/profile"
            style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'var(--ink)' }}
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
      style={({ isActive }) => ({
        padding: '6px 12px',
        borderRadius: 6,
        fontSize: 13,
        fontWeight: 500,
        textDecoration: 'none',
        color: isActive ? 'var(--accent-strong)' : 'var(--muted)',
        background: isActive ? 'var(--accent-soft)' : 'transparent',
      })}
    >
      {children}
    </NavLink>
  );
}
