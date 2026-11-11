import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { hueFromKey } from '../lib/format';
import type { Project } from '../lib/types';

export function Sidebar() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    api.get<Project[]>('/projects').then(setProjects).catch(() => setProjects([]));
  };

  useEffect(load, []);

  const removeProject = (p: Project) => {
    if (!confirm(`Ștergi definitiv proiectul "${p.name}" (${p.key})? Toate task-urile lui se pierd. Nu se poate anula.`)) return;
    api
      .delete(`/projects/${p.id}`)
      .then(load)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Ștergere eșuată'));
  };

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

      {error && (
        <p style={{ fontSize: 12, color: 'var(--danger)', padding: '0 10px', margin: '4px 0 0' }}>{error}</p>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px 0' }}>
        <div className="sidebar-label">Proiecte</div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {projects?.map((p) => (
            <div key={p.id} className="sidebar-row">
              <NavLink to={`/projects/${p.id}`} className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
                <span className="project-swatch" style={{ '--hue': hueFromKey(p.key) } as React.CSSProperties}>
                  {p.key.slice(0, 2)}
                </span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
              </NavLink>
              {isAdmin && (
                <button
                  className="sidebar-delete-btn"
                  title={`Șterge proiectul ${p.name}`}
                  aria-label={`Șterge proiectul ${p.name}`}
                  onClick={() => removeProject(p)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              )}
            </div>
          ))}
          {projects && projects.length === 0 && (
            <p style={{ fontSize: 12.5, color: 'var(--muted)', padding: '6px 10px' }}>Niciun proiect încă.</p>
          )}
        </nav>
        <NavLink to="/projects" className="sidebar-link sidebar-link-muted" style={{ marginTop: 2 }}>
          <span style={{ width: 24, textAlign: 'center' }}>···</span>
          <span>Toate proiectele</span>
        </NavLink>
        {/* Vizibil pentru toată lumea: un admin vede cererile din toate proiectele, un
            Project Manager doar pe cele din proiectele pe care le gestionează (backend-ul
            filtrează — vezi §13 din ARHITECTURA.md), oricine altcineva vede o listă goală. */}
        <NavLink to="/admin/join-requests" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`} style={{ marginTop: 2 }}>
          <span style={{ width: 24, textAlign: 'center' }}>✉</span>
          <span>Cereri</span>
        </NavLink>

        {isAdmin && (
          <>
            <div className="sidebar-label" style={{ marginTop: 18 }}>
              Admin
            </div>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <NavLink to="/admin/roles" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
                <span style={{ width: 24, textAlign: 'center' }}>◆</span>
                <span>Roluri</span>
              </NavLink>
              <NavLink to="/admin/users" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
                <span style={{ width: 24, textAlign: 'center' }}>◎</span>
                <span>Utilizatori</span>
              </NavLink>
              <NavLink to="/admin/activity" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
                <span style={{ width: 24, textAlign: 'center' }}>▤</span>
                <span>Jurnal</span>
              </NavLink>
            </nav>
          </>
        )}
      </div>
    </aside>
  );
}
