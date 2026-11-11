import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useProjectAccess } from '../lib/projectAccess';
import { useProjectRealtime } from '../lib/realtime';
import { Permission, TaskType, type Epic, type Paginated, type Task } from '../lib/types';
import { Spinner, ErrorBanner, EmptyState } from '../components/Feedback';
import { Avatar } from '../components/Avatar';
import { Modal } from '../components/Modal';
import { TaskDrawer } from '../components/TaskDrawer';
import { categoryPillClass, hueFromKey, typeIcon } from '../lib/format';

export function EpicsPage() {
  const { project, can } = useProjectAccess();
  const [epics, setEpics] = useState<Epic[] | null>(null);
  const [children, setChildren] = useState<Record<string, Task[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
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
  useProjectRealtime(project.id, () => {
    load();
    // Any open epic's children may have changed too (status, new links, etc).
    setChildren({});
  });

  const toggle = (epic: Epic) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(epic.id)) next.delete(epic.id);
      else next.add(epic.id);
      return next;
    });
    if (!children[epic.id]) {
      api
        .get<Paginated<Task>>(`/projects/${project.id}/tasks`, { epicId: epic.id, limit: 100 })
        .then((r) => setChildren((prev) => ({ ...prev, [epic.id]: r.items })))
        .catch(() => {});
    }
  };

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
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="epic-tree-header">
            <span />
            <span>Lucru</span>
            <span>Status</span>
            <span />
          </div>
          {epics.map((e) => (
            <EpicNode
              key={e.id}
              epic={e}
              expanded={expanded.has(e.id)}
              children={children[e.id]}
              onToggle={() => toggle(e)}
              onOpen={(key) => setParams({ task: key })}
            />
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

function EpicNode({
  epic,
  expanded,
  children,
  onToggle,
  onOpen,
}: {
  epic: Epic;
  expanded: boolean;
  children: Task[] | undefined;
  onToggle: () => void;
  onOpen: (key: string) => void;
}) {
  const pct = epic.taskCount > 0 ? Math.round((epic.doneCount / epic.taskCount) * 100) : 0;
  return (
    <div>
      <div className="epic-tree-row">
        <button className="epic-chevron" onClick={onToggle} aria-label={expanded ? 'Restrânge' : 'Extinde'}>
          {expanded ? '▾' : '▸'}
        </button>
        <button className="epic-tree-main" onClick={() => onOpen(epic.key)}>
          <span className="project-swatch" style={{ '--hue': hueFromKey(epic.key) } as React.CSSProperties}>
            {typeIcon(TaskType.EPIC)}
          </span>
          <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>
            {epic.key}
          </span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{epic.title}</span>
          {epic.taskCount > 0 && (
            <div className="epic-progress-track" style={{ width: 70 }}>
              <div className="epic-progress-fill" style={{ width: `${pct}%` }} />
            </div>
          )}
          <span style={{ fontSize: 12, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {epic.doneCount}/{epic.taskCount}
          </span>
        </button>
        <span className={categoryPillClass(epic.status.category)}>{epic.status.name}</span>
        <Avatar name={epic.assignee?.fullName} size={24} unassigned={!epic.assignee} />
      </div>

      {expanded && (
        <div className="epic-children">
          {children === undefined && <Spinner />}
          {children && children.length === 0 && (
            <p style={{ fontSize: 12.5, color: 'var(--muted)', padding: '8px 10px 8px 54px' }}>
              Niciun task legat de acest epic încă.
            </p>
          )}
          {children?.map((t) => (
            <button key={t.id} className="epic-child-row" onClick={() => onOpen(t.key)}>
              <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>
                {typeIcon(t.type)} {t.key}
              </span>
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  textDecoration: t.status.category === 'DONE' ? 'line-through' : 'none',
                  color: t.status.category === 'DONE' ? 'var(--muted)' : 'var(--ink)',
                }}
              >
                {t.title}
              </span>
              <span className={categoryPillClass(t.status.category)}>{t.status.name}</span>
              <Avatar name={t.assignee?.fullName} size={22} unassigned={!t.assignee} />
            </button>
          ))}
        </div>
      )}
    </div>
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
