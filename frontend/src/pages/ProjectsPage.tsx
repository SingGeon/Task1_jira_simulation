import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import {
  BoardType,
  ProjectManagement,
  type Project,
  type ProjectSummary,
  type PublicConfig,
  type Role,
  type User,
} from '../lib/types';
import { Spinner, ErrorBanner, EmptyState } from '../components/Feedback';
import { Modal } from '../components/Modal';
import { UserPicker } from '../components/UserPicker';

export function ProjectsPage() {
  const { isAdmin } = useAuth();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [publicConfig, setPublicConfig] = useState<PublicConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const navigate = useNavigate();

  const load = () => {
    api
      .get<Project[]>('/projects')
      .then(setProjects)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Nu am putut încărca proiectele'));
  };

  useEffect(load, []);
  useEffect(() => {
    api.get<PublicConfig>('/config/public').then(setPublicConfig);
  }, []);

  const canCreate = isAdmin || !!publicConfig?.teamProjectsEnabled;

  return (
    <div style={{ maxWidth: 920, margin: '0 auto', padding: '28px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1>Proiecte</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>Proiectele la care ai acces.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {!isAdmin && (
            <button className="btn" onClick={() => setShowRequest(true)}>
              Solicită acces / rol
            </button>
          )}
          {canCreate && (
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              + Proiect nou
            </button>
          )}
        </div>
      </div>

      {error && <ErrorBanner message={error} />}
      {!projects && !error && <Spinner />}
      {projects && projects.length === 0 && (
        <EmptyState
          title="Niciun proiect încă"
          hint={canCreate ? 'Creează primul proiect ca să începi.' : 'Solicită acces la un proiect existent sau așteaptă să fii adăugat.'}
        />
      )}

      {projects && projects.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
          {projects.map((p) => (
            <button
              key={p.id}
              className="card"
              onClick={() => navigate(`/projects/${p.id}/board`)}
              style={{ textAlign: 'left', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
                  {p.key}
                </span>
                <span className="pill pill-todo">{p.boardType === BoardType.SCRUM ? 'Scrum' : 'Kanban'}</span>
                <span className="pill pill-todo">{p.management === ProjectManagement.COMPANY ? 'Company-managed' : 'Team-managed'}</span>
              </div>
              <h2>{p.name}</h2>
              {p.description && (
                <p style={{ color: 'var(--muted)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {p.description}
                </p>
              )}
            </button>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateProjectModal
          isAdmin={isAdmin}
          onClose={() => setShowCreate(false)}
          onCreated={(p) => {
            setShowCreate(false);
            navigate(`/projects/${p.id}/board`);
          }}
        />
      )}
      {showRequest && (
        <RequestAccessModal
          onClose={() => setShowRequest(false)}
          onSent={() => {
            setShowRequest(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function RequestAccessModal({ onClose, onSent }: { onClose: () => void; onSent: () => void }) {
  const [directory, setDirectory] = useState<ProjectSummary[] | null>(null);
  const [myProjectIds, setMyProjectIds] = useState<Set<string>>(new Set());
  const [roles, setRoles] = useState<Role[]>([]);
  const [projectId, setProjectId] = useState('');
  const [roleId, setRoleId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([api.get<ProjectSummary[]>('/projects/directory'), api.get<Role[]>('/roles'), api.get<Project[]>('/projects')]).then(
      ([d, r, mine]) => {
        setDirectory(d);
        setMyProjectIds(new Set(mine.map((p) => p.id)));
        setRoles(r);
        setProjectId(d[0]?.id ?? '');
        setRoleId(r.find((x) => x.isDefault)?.id ?? r[0]?.id ?? '');
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post('/join-requests', { projectId, roleId, message: message || undefined });
      onSent();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Trimiterea cererii a eșuat');
    } finally {
      setBusy(false);
    }
  };

  const isRoleChange = myProjectIds.has(projectId);

  return (
    <Modal title="Solicită acces sau un alt rol" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && <ErrorBanner message={error} />}
        {!directory && <Spinner />}
        {directory && directory.length === 0 && <EmptyState title="Niciun proiect existent" />}
        {directory && directory.length > 0 && (
          <>
            <div className="field">
              <label>Proiect</label>
              <select className="select" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                {directory.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.key} · {p.name} {myProjectIds.has(p.id) ? '(ești membru)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>{isRoleChange ? 'Rol nou dorit' : 'Rol dorit'}</label>
              <select className="select" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              {isRoleChange && (
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                  Ești deja membru — asta trimite o cerere de schimbare a rolului tău curent.
                </span>
              )}
            </div>
            <div className="field">
              <label>Mesaj pentru admin (opțional)</label>
              <textarea className="textarea" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="De ce vrei acest acces/rol?" />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={onClose}>
                Anulează
              </button>
              <button className="btn btn-primary" disabled={busy || !projectId || !roleId} onClick={submit}>
                {busy ? 'Se trimite…' : 'Trimite cererea'}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function CreateProjectModal({
  isAdmin,
  onClose,
  onCreated,
}: {
  isAdmin: boolean;
  onClose: () => void;
  onCreated: (p: Project) => void;
}) {
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [boardType, setBoardType] = useState<BoardType>(BoardType.SCRUM);
  const [management, setManagement] = useState<ProjectManagement>(ProjectManagement.COMPANY);
  const [lead, setLead] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setBusy(true);
    try {
      const project = await api.post<Project>('/projects', {
        key,
        name,
        description: description || undefined,
        boardType,
        management: isAdmin ? management : undefined,
        leadId: isAdmin ? lead?.id : undefined,
      });
      onCreated(project);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Nu am putut crea proiectul');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Proiect nou" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && <ErrorBanner message={error} />}
        {!isAdmin && (
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>
            Vei fi adăugat automat ca Project Manager pe acest proiect (Team-managed).
          </p>
        )}
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="field" style={{ width: 120 }}>
            <label>Cheie</label>
            <input className="input mono" value={key} onChange={(e) => setKey(e.target.value.toUpperCase())} placeholder="WEB" maxLength={10} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Nume</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Website relaunch" />
          </div>
        </div>
        <div className="field">
          <label>Descriere (opțional)</label>
          <textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Tip board</label>
            <select className="select" value={boardType} onChange={(e) => setBoardType(e.target.value as BoardType)}>
              <option value={BoardType.SCRUM}>Scrum (sprinturi + backlog)</option>
              <option value={BoardType.KANBAN}>Kanban (flux continuu)</option>
            </select>
          </div>
          {isAdmin && (
            <div className="field" style={{ flex: 1 }}>
              <label>Tip proiect</label>
              <select className="select" value={management} onChange={(e) => setManagement(e.target.value as ProjectManagement)}>
                <option value={ProjectManagement.COMPANY}>Company-managed</option>
                <option value={ProjectManagement.TEAM}>Team-managed</option>
              </select>
            </div>
          )}
        </div>
        {isAdmin && (
          <div className="field">
            <label>Project Manager (opțional)</label>
            <UserPicker value={lead} onChange={setLead} placeholder="Caută un utilizator…" />
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button className="btn" onClick={onClose}>
            Anulează
          </button>
          <button className="btn btn-primary" disabled={busy || key.length < 2 || name.length < 2} onClick={onSubmit}>
            {busy ? 'Se creează…' : 'Creează proiect'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
