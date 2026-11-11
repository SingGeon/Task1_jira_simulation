import { NavLink, Outlet, useParams } from 'react-router-dom';
import { ProjectAccessProvider, useProjectAccess } from '../lib/projectAccess';
import { BoardType } from '../lib/types';

export function ProjectLayout() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) return null;
  return (
    <ProjectAccessProvider projectId={projectId}>
      <ProjectShell />
    </ProjectAccessProvider>
  );
}

function ProjectShell() {
  const { project } = useProjectAccess();
  const isScrum = project.boardType === BoardType.SCRUM;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '14px 20px 0', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
          <span
            className="mono"
            style={{
              fontSize: 11,
              fontWeight: 600,
              background: 'var(--accent-soft)',
              color: 'var(--accent-ink)',
              padding: '2px 7px',
              borderRadius: 4,
            }}
          >
            {project.key}
          </span>
          <h1 style={{ fontSize: 18 }}>{project.name}</h1>
        </div>
        <nav style={{ display: 'flex', gap: 2 }}>
          <Tab to="board">Board</Tab>
          <Tab to="backlog">Backlog</Tab>
          {isScrum && <Tab to="sprints">Sprinturi</Tab>}
          <Tab to="members">Membri</Tab>
          <Tab to="workflow">Workflow</Tab>
        </nav>
      </div>
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        <Outlet />
      </div>
    </div>
  );
}

function Tab({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `nav-tab${isActive ? ' active' : ''}`}
      style={({ isActive }) => ({
        padding: '8px 12px',
        borderRadius: '6px 6px 0 0',
        fontSize: 13,
        fontWeight: 500,
        textDecoration: 'none',
        color: isActive ? 'var(--accent-strong)' : 'var(--muted)',
        borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
        marginBottom: -1,
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
