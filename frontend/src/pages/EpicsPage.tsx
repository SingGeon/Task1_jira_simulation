import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useProjectAccess } from '../lib/projectAccess';
import { useProjectRealtime } from '../lib/realtime';
import { Permission, TaskType, type Epic } from '../lib/types';
import { Spinner, ErrorBanner, EmptyState } from '../components/Feedback';
import { Modal } from '../components/Modal';
import { TaskDrawer } from '../components/TaskDrawer';
import { categoryPillClass, hueFromKey } from '../lib/format';

export function EpicsPage() {
  const { project, can } = useProjectAccess();
  const [epics, setEpics] = useState<Epic[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [params, setParams] = useSearchParams();
  const openTask = params.get('task');

  const load = useCallback(() => {
    api
      .get<Epic[]>(`/projects/${project.id}/epics`)
      .then(setEpics)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Nu am putut încărca epicele'));
  }, [project.id]);

  useEffect(load, [load]);
  useProjectRealtime(project.id, load);

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        {can(Permission.TASK_CREATE) && (
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            + Epic
          </button>
        )}
      </div>

      {error && <ErrorBanner message={error} />}
      {!epics && !error && <Spinner />}
      {epics && epics.length === 0 && (
        <EmptyState title="Niciun epic" hint="Creează un epic ca să grupezi task-uri înrudite (ex. un modul sau o funcționalitate mare)." />
      )}

      {epics && epics.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {epics.map((e) => (
            <EpicRow key={e.id} epic={e} onOpen={() => setParams({ task: e.key })} />
          ))}
        </div>
      )}

      {openTask && <TaskDrawer idOrKey={openTask} onClose={() => setParams({})} onChanged={load} />}
      {showCreate && (
        <CreateEpicModal
          projectId={project.id}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function EpicRow({ epic, onOpen }: { epic: Epic; onOpen: () => void }) {
  const pct = epic.taskCount > 0 ? Math.round((epic.doneCount / epic.taskCount) * 100) : 0;
  return (
    <button className="card" onClick={onOpen} style={{ textAlign: 'left', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          className="project-swatch"
          style={{ '--hue': hueFromKey(epic.key) } as React.CSSProperties}
        >
          {epic.key.split('-')[1] ?? epic.key.slice(0, 2)}
        </span>
        <h2 style={{ flex: 1 }}>{epic.title}</h2>
        <span className={categoryPillClass(epic.status.category)}>{epic.status.name}</span>
      </div>
      {epic.description && (
        <p
          style={{
            fontSize: 13,
            color: 'var(--muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {epic.description}
        </p>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="epic-progress-track" style={{ flex: 1 }}>
          <div className="epic-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <span style={{ fontSize: 12, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {epic.doneCount}/{epic.taskCount} task-uri
        </span>
      </div>
    </button>
  );
}

function CreateEpicModal({ projectId, onClose, onCreated }: { projectId: string; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/projects/${projectId}/tasks`, { title, description: description || undefined, type: TaskType.EPIC });
      onCreated();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Crearea epicului a eșuat');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Epic nou" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && <ErrorBanner message={error} />}
        <div className="field">
          <label>Titlu</label>
          <input className="input" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ex. Relansare checkout" />
        </div>
        <div className="field">
          <label>Descriere (opțional)</label>
          <textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn" onClick={onClose}>
            Anulează
          </button>
          <button className="btn btn-primary" disabled={busy || title.trim().length < 3} onClick={submit}>
            {busy ? 'Se creează…' : 'Creează epic'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
