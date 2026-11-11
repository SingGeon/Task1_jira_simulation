import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { Project } from '../lib/types';

function hueFromKey(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 360;
  return h;
}

export function Sidebar() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[] | null>(null);

  useEffect(() => {
    api.get<Project[]>('/projects').then(setProjects).catch(() => setProjects([]));
  }, []);

  return (
    <aside
      style={{
        width: 240,
        minWidth: 240,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid var(--border)',
        background: 'var(--surface)',
      }}
    >
      <button
        className="btn btn-ghost"
        style={{
          margin: '10px 10px 2px',
          justifyContent: 'flex-start',
          padding: '8px 10px',
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 17,
        }}
        onClick={() => navigate('/projects')}
      >
        <span style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--accent)', display: 'inline-block' }} />
        Tracker
      </button>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px 0' }}>
        <div className="sidebar-label">Proiecte</div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {projects?.map((p) => (
            <NavLink key={p.id} to={`/projects/${p.id}`} className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
              <span
                className="project-swatch"
                style={{ '--hue': hueFromKey(p.key) } as React.CSSProperties}
              >
                {p.key.slice(0, 2)}
              </span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
            </NavLink>
          ))}
          {projects && projects.length === 0 && (
            <p style={{ fontSize: 12.5, color: 'var(--muted)', padding: '6px 10px' }}>Niciun proiect încă.</p>
          )}
        </nav>
        <NavLink to="/projects" className="sidebar-link sidebar-link-muted" style={{ marginTop: 2 }}>
          <span style={{ width: 24, textAlign: 'center' }}>···</span>
          <span>Toate proiectele</span>
        </NavLink>

        {isAdmin && (
          <>
            <div className="sidebar-label" style={{ marginTop: 18 }}>
              Admin
            </div>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <NavLink to="/admin/join-requests" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
                <span style={{ width: 24, textAlign: 'center' }}>✉</span>
                <span>Cereri</span>
              </NavLink>
              <NavLink to="/admin/roles" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
                <span style={{ width: 24, textAlign: 'center' }}>◆</span>
                <span>Roluri</span>
              </NavLink>
              <NavLink to="/admin/users" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
                <span style={{ width: 24, textAlign: 'center' }}>◎</span>
                <span>Utilizatori</span>
              </NavLink>
            </nav>
          </>
        )}
      </div>
    </aside>
  );
}
