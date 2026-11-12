import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useProjectAccess } from '../lib/projectAccess';
import {
  BoardType,
  Permission,
  SprintState,
  TaskPriority,
  TaskType,
  type Activity,
  type Comment,
  type Epic,
  type Paginated,
  type Sprint,
  type Task,
  type User,
  type WorkflowStatus,
} from '../lib/types';
import { Drawer } from './Drawer';
import { Avatar } from './Avatar';
import { ActivityLog } from './ActivityLog';
import { EpicChip } from './EpicChip';
import { Spinner, ErrorBanner } from './Feedback';
import { TypeIcon } from './TypeIcon';
import { UserPicker } from './UserPicker';
import { categoryPillClass, formatDateTime, typeIcon } from '../lib/format';

/** Evenly spaced around the wheel so no two presets look alike. */
const HUE_PRESETS = [0, 24, 48, 80, 130, 160, 190, 220, 255, 280, 310, 340];

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
  const [, setParams] = useSearchParams();
  const [task, setTask] = useState<Task | null>(null);
  const [transitions, setTransitions] = useState<WorkflowStatus[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [epics, setEpics] = useState<Epic[]>([]);
  const [subtasks, setSubtasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savingField, setSavingField] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([
      api.get<Task>(`/tasks/${idOrKey}`),
      api.get<WorkflowStatus[]>(`/tasks/${idOrKey}/transitions`),
      api.get<Comment[]>(`/tasks/${idOrKey}/comments`),
      api.get<Activity[]>(`/tasks/${idOrKey}/activity`),
    ])
      .then(([t, tr, c, a]) => {
        setTask(t);
        setTransitions(tr);
        setComments(c);
        setActivity(a);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Nu am putut încărca task-ul'));
  }, [idOrKey]);

  useEffect(load, [load]);

  useEffect(() => {
    if (project.boardType === BoardType.SCRUM) {
      api.get<Sprint[]>(`/projects/${project.id}/sprints`).then(setSprints).catch(() => {});
    }
    api.get<Epic[]>(`/projects/${project.id}/epics`).then(setEpics).catch(() => {});
  }, [project.id, project.boardType]);

  const canHaveSubtasks = task?.type !== TaskType.EPIC && task?.type !== TaskType.SUBTASK;

  const refreshSubtasks = useCallback(() => {
    if (!task || !canHaveSubtasks) return;
    api
      .get<Paginated<Task>>(`/projects/${project.id}/tasks`, { parentId: task.id, limit: 100 })
      .then((r) => setSubtasks(r.items))
      .catch(() => {});
  }, [task?.id, canHaveSubtasks, project.id]);

  useEffect(refreshSubtasks, [refreshSubtasks]);

  const refreshActivity = () => api.get<Activity[]>(`/tasks/${idOrKey}/activity`).then(setActivity).catch(() => {});

  const patch = async (body: Partial<Task>, field: string) => {
    if (!task) return;
    setSavingField(field);
    setError(null);
    try {
      const updated = await api.patch<Task>(`/tasks/${idOrKey}`, body);
      setTask(updated);
      refreshActivity();
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
      refreshActivity();
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
      refreshActivity();
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
      refreshActivity();
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

  // can(permission) only reflects unconditional grants (no task context) — a role like Developer,
  // whose task.update grant is scoped to "assigned to me" or "reported by me", would otherwise
  // never see editable fields on its own tasks at all. Approximate "assigned/reported by me" as
  // eligible too; this doesn't try to replicate every grant's exact condition (e.g. QA's extra
  // IN_QA-status restriction), same as the board's drag-eligibility check — if the backend still
  // rejects the edit, the existing error banner surfaces it.
  const ownsTask = task ? task.assigneeId === me?.id || task.reporterId === me?.id : false;
  const canUpdate = task ? can(Permission.TASK_UPDATE) || ownsTask : false;
  const canAssign = task ? can(Permission.TASK_ASSIGN) : false;
  // Scoped to assignee specifically (not reporter, unlike canUpdate) — matches the grant shape:
  // Developer-tier roles can delete a task once it's assigned to them, like Jira.
  const canDelete = task ? can(Permission.TASK_DELETE) || task.assigneeId === me?.id : false;
  const isEpic = task?.type === TaskType.EPIC;
  const isSubtask = task?.type === TaskType.SUBTASK;
  const canMoveSprint = can(Permission.SPRINT_MANAGE) && project.boardType === BoardType.SCRUM && !isEpic && !isSubtask;
  const canComment = can(Permission.COMMENT_CREATE);
  const canManageComments = can(Permission.COMMENT_MANAGE);
  const canSelfAssign = can(Permission.TASK_ASSIGNABLE);

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
            {task.epic && <EpicChip epic={task.epic} />}
            {task.parent && (
              <button
                className="mono"
                style={{ all: 'unset', cursor: 'pointer' }}
                onClick={() => setParams({ task: task.parent!.key })}
                title="Deschide task-ul părinte"
              >
                <EpicChip epic={task.parent} />
              </button>
            )}
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

            {transitions.length > 0 && (
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

            {isEpic && (
              <EpicColorPicker
                value={task.hue}
                disabled={!canUpdate}
                onPick={(hue) => patch({ hue }, 'hue')}
              />
            )}

            <div className="field">
              <label>Assignee</label>
              {canAssign ? (
                <UserPicker value={task.assignee} onChange={assign} placeholder="Neasignat — caută un membru" />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Avatar name={task.assignee?.fullName} unassigned={!task.assignee} />
                  <span style={{ fontSize: 13, color: task.assignee ? 'var(--ink)' : 'var(--muted)' }}>
                    {task.assignee?.fullName ?? 'Neasignat'}
                  </span>
                  {canSelfAssign && task.assigneeId !== me?.id && (
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: 12, padding: '3px 10px' }}
                      disabled={savingField === 'assignee'}
                      onClick={() => me && assign(me)}
                    >
                      Asignează-mi mie
                    </button>
                  )}
                  {canSelfAssign && task.assigneeId === me?.id && (
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: 12, padding: '3px 10px' }}
                      disabled={savingField === 'assignee'}
                      onClick={() => assign(null)}
                    >
                      Dezasignează-mă
                    </button>
                  )}
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

            {!isEpic && !isSubtask && epics.length > 0 && (
              <div className="field">
                <label>Epic</label>
                <select
                  className="select"
                  disabled={!canUpdate}
                  value={task.epicId ?? ''}
                  onChange={(e) => patch({ epicId: e.target.value || null }, 'epicId')}
                >
                  <option value="">Fără epic</option>
                  {epics.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.key} — {e.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {canHaveSubtasks && (
              <SubtasksSection
                subtasks={subtasks}
                canCreate={can(Permission.TASK_CREATE)}
                onOpen={(key) => setParams({ task: key })}
                onCreate={async (title) => {
                  await api.post(`/projects/${project.id}/tasks`, { title, type: TaskType.SUBTASK, parentId: task.id });
                  refreshSubtasks();
                  onChanged();
                }}
              />
            )}

            <EditableLabels
              value={task.labels}
              disabled={!canUpdate}
              onSave={(labels) => patch({ labels }, 'labels')}
            />

            <div className="field">
              <label>Story points</label>
              <input
                key={task.id}
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

            <div>
              <h3 style={{ marginBottom: 10 }}>ISTORIC</h3>
              <ActivityLog items={activity} />
            </div>
          </div>
        </>
      )}
    </Drawer>
  );
}

function EditableTitle({ value, disabled, saving, onSave }: { value: string; disabled: boolean; saving: boolean; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [height, setHeight] = useState<number>();
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => setDraft(value), [value]);
  // Auto-grow to fit the real content instead of guessing row count from character length (that
  // guess didn't account for this field's larger font-size and clipped single-line titles). The
  // measured height is kept in state — not just written to the DOM — so it survives re-renders
  // triggered by the drawer's other data loading (comments/activity/subtasks arriving later),
  // which would otherwise reset the textarea back to React's declarative style each time.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    setHeight(el.scrollHeight);
  }, [draft]);
  return (
    <textarea
      ref={ref}
      className="textarea"
      style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 600,
        fontSize: 17,
        minHeight: 0,
        // This field is a direct child of the drawer's overflowing flex column. Without
        // flexShrink:0, the flex-shrink algorithm squeezes it down near 0 height whenever the
        // column's total content overflows — minHeight:0 above (needed to go under the shared
        // 72px .textarea min-height) is exactly what removes the browser's normal protection
        // against that, so it has to be reinstated explicitly here.
        flexShrink: 0,
        resize: 'none',
        overflow: 'hidden',
        height: height ? `${height}px` : undefined,
      }}
      rows={1}
      value={draft}
      disabled={disabled || saving}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft.trim() && draft !== value && onSave(draft.trim())}
    />
  );
}

function EditableDescription({ value, disabled, onSave }: { value: string; disabled: boolean; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [height, setHeight] = useState<number>();
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => setDraft(value), [value]);
  // Same auto-grow as the title field above: fixed rows={5} clipped long descriptions, requiring
  // a scroll inside a small box to read the rest. Measuring scrollHeight and writing it back as
  // an explicit height (kept in state, not just on the DOM) lets it grow with the content and
  // survives re-renders from the drawer's other async data (comments/activity/sub-tasks).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    setHeight(el.scrollHeight);
  }, [draft]);
  return (
    <div className="field">
      <label>Descriere</label>
      <textarea
        ref={ref}
        className="textarea"
        style={{
          flexShrink: 0, // same squeeze risk as the title field, inside this overflowing column
          resize: 'none',
          overflow: 'hidden',
          height: height ? `${height}px` : undefined,
        }}
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

function EpicColorPicker({
  value,
  disabled,
  onPick,
}: {
  value: number | null;
  disabled: boolean;
  onPick: (hue: number | null) => void;
}) {
  return (
    <div className="field">
      <label>Culoare</label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {HUE_PRESETS.map((h) => (
          <button
            key={h}
            type="button"
            disabled={disabled}
            className={`hue-swatch${value === h ? ' hue-swatch-selected' : ''}`}
            style={{ background: `hsl(${h} 62% 52%)` }}
            title={`Nuanța ${h}°`}
            aria-label={`Nuanța ${h}°`}
            onClick={() => onPick(h)}
          />
        ))}
        <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} disabled={disabled} onClick={() => onPick(null)}>
          Auto
        </button>
      </div>
    </div>
  );
}

function SubtasksSection({
  subtasks,
  canCreate,
  onOpen,
  onCreate,
}: {
  subtasks: Task[];
  canCreate: boolean;
  onOpen: (key: string) => void;
  onCreate: (title: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const done = subtasks.filter((s) => s.status.category === 'DONE').length;

  const submit = async () => {
    if (draft.trim().length < 3) return;
    setBusy(true);
    try {
      await onCreate(draft.trim());
      setDraft('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="field">
      <label>
        Sub-task-uri {subtasks.length > 0 && <span style={{ color: 'var(--muted)', fontWeight: 400 }}>({done}/{subtasks.length})</span>}
      </label>
      {subtasks.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          {subtasks.map((s, i) => (
            <button
              key={s.id}
              onClick={() => onOpen(s.key)}
              style={{
                all: 'unset',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 10px',
                background: 'var(--surface)',
                borderBottom: i < subtasks.length - 1 ? '1px solid var(--border)' : 'none',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <TypeIcon type={s.type} />
                <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
                  {s.key}
                </span>
              </span>
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: 13,
                  textDecoration: s.status.category === 'DONE' ? 'line-through' : 'none',
                  color: s.status.category === 'DONE' ? 'var(--muted)' : 'var(--ink)',
                }}
              >
                {s.title}
              </span>
              <span className={categoryPillClass(s.status.category)}>{s.status.name}</span>
              <Avatar name={s.assignee?.fullName} size={22} unassigned={!s.assignee} />
            </button>
          ))}
        </div>
      )}
      {canCreate && (
        <div style={{ display: 'flex', gap: 6, marginTop: subtasks.length > 0 ? 8 : 0 }}>
          <input
            className="input"
            placeholder="+ Sub-task nou"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          <button className="btn" disabled={busy || draft.trim().length < 3} onClick={submit}>
            Adaugă
          </button>
        </div>
      )}
      {subtasks.length === 0 && !canCreate && <p style={{ fontSize: 13, color: 'var(--muted)' }}>Niciun sub-task.</p>}
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
