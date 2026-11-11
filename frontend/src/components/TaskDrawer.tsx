import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useProjectAccess } from '../lib/projectAccess';
import {
  BoardType,
  Permission,
  SprintState,
  TaskPriority,
  TaskType,
  type Comment,
  type Sprint,
  type Task,
  type User,
  type WorkflowStatus,
} from '../lib/types';
import { Drawer } from './Drawer';
import { Avatar } from './Avatar';
import { Spinner, ErrorBanner } from './Feedback';
import { UserPicker } from './UserPicker';
import { categoryPillClass, formatDateTime, typeIcon } from '../lib/format';

export function TaskDrawer({
  idOrKey,
  onClose,
  onChanged,
}: {
  idOrKey: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { can, project } = useProjectAccess();
  const { user: me } = useAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [transitions, setTransitions] = useState<WorkflowStatus[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savingField, setSavingField] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([
      api.get<Task>(`/tasks/${idOrKey}`),
      api.get<WorkflowStatus[]>(`/tasks/${idOrKey}/transitions`),
      api.get<Comment[]>(`/tasks/${idOrKey}/comments`),
    ])
      .then(([t, tr, c]) => {
        setTask(t);
        setTransitions(tr);
        setComments(c);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Nu am putut încărca task-ul'));
  }, [idOrKey]);

  useEffect(load, [load]);

  useEffect(() => {
    if (project.boardType === BoardType.SCRUM) {
      api.get<Sprint[]>(`/projects/${project.id}/sprints`).then(setSprints).catch(() => {});
    }
  }, [project.id, project.boardType]);

  const patch = async (body: Partial<Task>, field: string) => {
    if (!task) return;
    setSavingField(field);
    setError(null);
    try {
      const updated = await api.patch<Task>(`/tasks/${idOrKey}`, body);
      setTask(updated);
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Salvare eșuată');
    } finally {
      setSavingField(null);
    }
  };

  const transition = async (status: string) => {
    if (!task) return;
    setSavingField('status');
    setError(null);
    try {
      const updated = await api.post<Task>(`/tasks/${idOrKey}/transitions`, { status });
      setTask(updated);
      const tr = await api.get<WorkflowStatus[]>(`/tasks/${idOrKey}/transitions`);
      setTransitions(tr);
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Tranziție eșuată');
    } finally {
      setSavingField(null);
    }
  };

  const assign = async (u: User | null) => {
    setSavingField('assignee');
    setError(null);
    try {
      const updated = await api.put<Task>(`/tasks/${idOrKey}/assignee`, { assigneeId: u?.id ?? null });
      setTask(updated);
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Nu am putut asigna');
    } finally {
      setSavingField(null);
    }
  };

  const moveSprint = async (sprintId: string | null) => {
    setSavingField('sprint');
    setError(null);
    try {
      const updated = await api.put<Task>(`/tasks/${idOrKey}/sprint`, { sprintId });
      setTask(updated);
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Mutare eșuată');
    } finally {
      setSavingField(null);
    }
  };

  const remove = async () => {
    if (!task || !confirm(`Ștergi ${task.key}? Nu se poate anula.`)) return;
    try {
      await api.delete(`/tasks/${idOrKey}`);
      onChanged();
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ștergere eșuată');
    }
  };

  const canUpdate = task ? can(Permission.TASK_UPDATE) : false;
  const canAssign = task ? can(Permission.TASK_ASSIGN) : false;
  const canTransition = task ? can(Permission.TASK_TRANSITION) : false;
  const canDelete = task ? can(Permission.TASK_DELETE) : false;
  const canMoveSprint = can(Permission.SPRINT_MANAGE) && project.boardType === BoardType.SCRUM;
  const canComment = can(Permission.COMMENT_CREATE);
  const canManageComments = can(Permission.COMMENT_MANAGE);

  return (
    <Drawer onClose={onClose}>
      {!task && !error && <Spinner />}
      {error && !task && (
        <div style={{ padding: 20 }}>
          <ErrorBanner message={error} />
        </div>
      )}
      {task && (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '14px 18px',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>
              {task.key}
            </span>
            <span className={categoryPillClass(task.status.category)}>{task.status.name}</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              {canDelete && (
                <button className="btn btn-danger" style={{ padding: '4px 10px' }} onClick={remove}>
                  Șterge
                </button>
              )}
              <button className="btn btn-ghost" onClick={onClose} aria-label="Close">
                ✕
              </button>
            </div>
          </div>

          <div style={{ padding: 18, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18, flex: 1 }}>
            {error && <ErrorBanner message={error} />}

            <EditableTitle
              value={task.title}
              disabled={!canUpdate}
              saving={savingField === 'title'}
              onSave={(v) => patch({ title: v }, 'title')}
            />

            {transitions.length > 0 && canTransition && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {transitions.map((s) => (
                  <button
                    key={s.id}
                    className="btn"
                    disabled={savingField === 'status'}
                    onClick={() => transition(s.key)}
                  >
                    → {s.name}
                  </button>
                ))}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="field">
                <label>Tip</label>
                <select
                  className="select"
                  value={task.type}
                  disabled={!canUpdate}
                  onChange={(e) => patch({ type: e.target.value as TaskType }, 'type')}
                >
                  {Object.values(TaskType).map((t) => (
                    <option key={t} value={t}>
                      {typeIcon(t)} {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Prioritate</label>
                <select
                  className="select"
                  value={task.priority}
                  disabled={!canUpdate}
                  onChange={(e) => patch({ priority: e.target.value as TaskPriority }, 'priority')}
                >
                  {Object.values(TaskPriority).map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field">
              <label>Assignee</label>
              {canAssign ? (
                <UserPicker value={task.assignee} onChange={assign} placeholder="Neasignat — caută un membru" />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {task.assignee ? <Avatar name={task.assignee.fullName} /> : null}
                  <span style={{ fontSize: 13 }}>{task.assignee?.fullName ?? 'Neasignat'}</span>
                </div>
              )}
            </div>

            {canMoveSprint && (
              <div className="field">
                <label>Sprint</label>
                <select
                  className="select"
                  value={task.sprintId ?? ''}
                  onChange={(e) => moveSprint(e.target.value || null)}
                >
                  <option value="">Backlog</option>
                  {sprints
                    .filter((s) => s.state !== SprintState.CLOSED)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.state === SprintState.ACTIVE ? '(activ)' : ''}
                      </option>
                    ))}
                </select>
              </div>
            )}

            <EditableLabels
              value={task.labels}
              disabled={!canUpdate}
              onSave={(labels) => patch({ labels }, 'labels')}
            />

            <div className="field">
              <label>Story points</label>
              <input
                className="input"
                type="number"
                min={0}
                max={100}
                disabled={!canUpdate}
                defaultValue={task.storyPoints ?? ''}
                style={{ width: 100 }}
                onBlur={(e) => {
                  const v = e.target.value === '' ? null : Number(e.target.value);
                  if (v !== task.storyPoints) patch({ storyPoints: v }, 'storyPoints');
                }}
              />
            </div>

            <EditableDescription
              value={task.description}
              disabled={!canUpdate}
              onSave={(v) => patch({ description: v }, 'description')}
            />

            <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 14 }}>
              <span>Reporter: {task.reporter.fullName}</span>
              <span>Creat: {formatDateTime(task.createdAt)}</span>
            </div>

            <div>
              <h3 style={{ marginBottom: 10 }}>COMENTARII ({comments.length})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {comments.map((c) => (
                  <CommentRow
                    key={c.id}
                    comment={c}
                    canManage={canManageComments || c.authorId === me?.id}
                    onChanged={(updated) =>
                      setComments((prev) => (updated ? prev.map((x) => (x.id === updated.id ? updated : x)) : prev))
                    }
                    onDeleted={(id) => setComments((prev) => prev.filter((x) => x.id !== id))}
                  />
                ))}
                {comments.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted)' }}>Niciun comentariu încă.</p>}
              </div>
              {canComment && (
                <NewComment
                  onAdd={(body) =>
                    api.post<Comment>(`/tasks/${idOrKey}/comments`, { body }).then((c) => setComments((prev) => [...prev, c]))
                  }
                />
              )}
            </div>
          </div>
        </>
      )}
    </Drawer>
  );
}

function EditableTitle({ value, disabled, saving, onSave }: { value: string; disabled: boolean; saving: boolean; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <textarea
      className="textarea"
      style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 17, minHeight: 0, resize: 'none' }}
      rows={Math.max(1, Math.ceil(draft.length / 46))}
      value={draft}
      disabled={disabled || saving}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft.trim() && draft !== value && onSave(draft.trim())}
    />
  );
}

function EditableDescription({ value, disabled, onSave }: { value: string; disabled: boolean; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <div className="field">
      <label>Descriere</label>
      <textarea
        className="textarea"
        rows={5}
        value={draft}
        disabled={disabled}
        placeholder="Fără descriere"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft !== value && onSave(draft)}
      />
    </div>
  );
}

function EditableLabels({ value, disabled, onSave }: { value: string[]; disabled: boolean; onSave: (v: string[]) => void }) {
  const [draft, setDraft] = useState(value.join(', '));
  useEffect(() => setDraft(value.join(', ')), [value]);
  return (
    <div className="field">
      <label>Etichete (separate prin virgulă)</label>
      <input
        className="input"
        value={draft}
        disabled={disabled}
        placeholder="backend, auth"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const labels = draft
            .split(',')
            .map((l) => l.trim().toLowerCase())
            .filter(Boolean);
          if (labels.join(',') !== value.join(',')) onSave(labels);
        }}
      />
    </div>
  );
}

function CommentRow({
  comment,
  canManage,
  onChanged,
  onDeleted,
}: {
  comment: Comment;
  canManage: boolean;
  onChanged: (c: Comment | null) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);

  const save = async () => {
    const updated = await api.patch<Comment>(`/comments/${comment.id}`, { body: draft });
    onChanged(updated);
    setEditing(false);
  };

  const remove = async () => {
    if (!confirm('Ștergi comentariul?')) return;
    await api.delete(`/comments/${comment.id}`);
    onDeleted(comment.id);
  };

  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <Avatar name={comment.author.fullName} />
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <strong style={{ fontSize: 13 }}>{comment.author.fullName}</strong>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>{formatDateTime(comment.createdAt)}</span>
        </div>
        {editing ? (
          <div style={{ marginTop: 6 }}>
            <textarea className="textarea" value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} />
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button className="btn btn-primary" style={{ padding: '3px 10px' }} onClick={save}>
                Salvează
              </button>
              <button className="btn" style={{ padding: '3px 10px' }} onClick={() => setEditing(false)}>
                Anulează
              </button>
            </div>
          </div>
        ) : (
          <p style={{ fontSize: 13, marginTop: 4, whiteSpace: 'pre-wrap' }}>{comment.body}</p>
        )}
        {canManage && !editing && (
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button className="btn btn-ghost" style={{ padding: '2px 6px', fontSize: 12 }} onClick={() => setEditing(true)}>
              Editează
            </button>
            <button className="btn btn-ghost" style={{ padding: '2px 6px', fontSize: 12, color: 'var(--danger)' }} onClick={remove}>
              Șterge
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function NewComment({ onAdd }: { onAdd: (body: string) => Promise<void> }) {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!body.trim()) return;
    setBusy(true);
    try {
      await onAdd(body.trim());
      setBody('');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <textarea
        className="textarea"
        rows={2}
        placeholder="Scrie un comentariu…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <button className="btn btn-primary" style={{ alignSelf: 'flex-end' }} disabled={busy || !body.trim()} onClick={submit}>
        Comentează
      </button>
    </div>
  );
}
