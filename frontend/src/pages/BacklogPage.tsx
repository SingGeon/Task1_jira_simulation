import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useProjectAccess } from '../lib/projectAccess';
import { useProjectRealtime } from '../lib/realtime';
import { Permission, SprintState, StatusCategory, TaskType, type Paginated, type Sprint, type Task } from '../lib/types';
import { Spinner, ErrorBanner, EmptyState } from '../components/Feedback';
import { Avatar } from '../components/Avatar';
import { EpicChip } from '../components/EpicChip';
import { TaskDrawer } from '../components/TaskDrawer';
import { TypeIcon } from '../components/TypeIcon';
import { CreateTaskModal } from '../components/CreateTaskModal';
import { CreateSprintModal, StartSprintModal, CompleteSprintModal } from '../components/SprintModals';
import { categoryPillClass, formatDate } from '../lib/format';

interface Group {
  key: string;
  title: string;
  sprint: Sprint | null;
  tasks: Task[];
}

export function BacklogPage() {
  const { project, can } = useProjectAccess();
  const [sprints, setSprints] = useState<Sprint[] | null>(null);
  const [tasksByGroup, setTasksByGroup] = useState<Record<string, Task[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [createIn, setCreateIn] = useState<Group | null>(null);
  const [showCreateSprint, setShowCreateSprint] = useState(false);
  const [starting, setStarting] = useState<Sprint | null>(null);
  const [completing, setCompleting] = useState<Sprint | null>(null);
  const [params, setParams] = useSearchParams();
  const openTask = params.get('task');

  const canCreate = can(Permission.TASK_CREATE);
  const canManageSprint = can(Permission.SPRINT_MANAGE);

  const load = useCallback(() => {
    api
      .get<Sprint[]>(`/projects/${project.id}/sprints`)
      .then(async (all) => {
        const open = all
          .filter((s) => s.state !== SprintState.CLOSED)
          .sort((a, b) => {
            if (a.state === b.state) return a.createdAt < b.createdAt ? -1 : 1;
            return a.state === SprintState.ACTIVE ? -1 : 1;
          });
        setSprints(open);

        const entries = await Promise.all([
          ...open.map((s) =>
            api
              .get<Paginated<Task>>(`/projects/${project.id}/tasks`, { sprintId: s.id, q: q || undefined, limit: 100 })
              .then((r) => [s.id, r.items] as const),
          ),
          api
            .get<Paginated<Task>>(`/projects/${project.id}/tasks`, { backlog: true, q: q || undefined, limit: 100 })
            .then((r) => ['backlog', r.items] as const),
        ]);
        // Epics are managed on their own tab; sub-tasks show up nested under their parent instead.
        setTasksByGroup(
          Object.fromEntries(
            entries.map(([key, items]) => [
              key,
              items.filter((t) => t.type !== TaskType.EPIC && t.type !== TaskType.SUBTASK),
            ]),
          ),
        );
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Nu am putut încărca backlog-ul'));
  }, [project.id, q]);

  useEffect(load, [load]);
  useProjectRealtime(project.id, load);

  const toggle = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const removeSprint = async (s: Sprint) => {
    if (!confirm(`Ștergi "${s.name}"?`)) return;
    try {
      await api.delete(`/projects/${project.id}/sprints/${s.id}`);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ștergere eșuată');
    }
  };

  if (error) return <ErrorBanner message={error} />;
  if (!sprints) return <Spinner />;

  const groups: Group[] = [
    ...sprints.map((s) => ({ key: s.id, title: s.name, sprint: s, tasks: tasksByGroup[s.id] ?? [] })),
    { key: 'backlog', title: 'Backlog', sprint: null, tasks: tasksByGroup.backlog ?? [] },
  ];

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <input className="input" style={{ maxWidth: 280 }} placeholder="Caută…" value={q} onChange={(e) => setQ(e.target.value)} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {groups.map((g) => (
          <GroupSection
            key={g.key}
            group={g}
            collapsed={collapsed.has(g.key)}
            onToggle={() => toggle(g.key)}
            canCreate={canCreate}
            canManageSprint={canManageSprint}
            onOpenTask={(key) => setParams({ task: key })}
            onCreate={() => setCreateIn(g)}
            onStart={g.sprint ? () => setStarting(g.sprint) : undefined}
            onComplete={g.sprint ? () => setCompleting(g.sprint) : undefined}
            onDelete={g.sprint ? () => removeSprint(g.sprint!) : undefined}
            onCreateSprint={g.key === 'backlog' ? () => setShowCreateSprint(true) : undefined}
          />
        ))}
      </div>

      {openTask && <TaskDrawer idOrKey={openTask} onClose={() => setParams({})} onChanged={load} />}
      {createIn && (
        <CreateTaskModal
          projectId={project.id}
          sprintId={createIn.sprint?.id}
          onClose={() => setCreateIn(null)}
          onCreated={() => {
            setCreateIn(null);
            load();
          }}
        />
      )}
      {showCreateSprint && (
        <CreateSprintModal
          projectId={project.id}
          onClose={() => setShowCreateSprint(false)}
          onCreated={() => {
            setShowCreateSprint(false);
            load();
          }}
        />
      )}
      {starting && (
        <StartSprintModal
          projectId={project.id}
          sprint={starting}
          onClose={() => setStarting(null)}
          onStarted={() => {
            setStarting(null);
            load();
          }}
        />
      )}
      {completing && (
        <CompleteSprintModal
          projectId={project.id}
          sprint={completing}
          sprints={sprints}
          onClose={() => setCompleting(null)}
          onCompleted={() => {
            setCompleting(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function GroupSection({
  group,
  collapsed,
  onToggle,
  canCreate,
  canManageSprint,
  onOpenTask,
  onCreate,
  onStart,
  onComplete,
  onDelete,
  onCreateSprint,
}: {
  group: Group;
  collapsed: boolean;
  onToggle: () => void;
  canCreate: boolean;
  canManageSprint: boolean;
  onOpenTask: (key: string) => void;
  onCreate: () => void;
  onStart?: () => void;
  onComplete?: () => void;
  onDelete?: () => void;
  onCreateSprint?: () => void;
}) {
  const { sprint, tasks } = group;
  const counts = {
    [StatusCategory.TODO]: tasks.filter((t) => t.status.category === StatusCategory.TODO).length,
    [StatusCategory.IN_PROGRESS]: tasks.filter((t) => t.status.category === StatusCategory.IN_PROGRESS).length,
    [StatusCategory.DONE]: tasks.filter((t) => t.status.category === StatusCategory.DONE).length,
  };
  const points = tasks.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);

  return (
    <div className="backlog-group">
      <div className="backlog-group-header">
        <button className="btn btn-ghost" style={{ padding: '2px 6px' }} onClick={onToggle} aria-label="Toggle">
          {collapsed ? '▸' : '▾'}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <strong style={{ fontFamily: 'var(--font-display)' }}>{group.title}</strong>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>({tasks.length} task-uri)</span>
          </div>
          {sprint?.goal && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{sprint.goal}</p>}
          {sprint?.startDate && (
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
              {formatDate(sprint.startDate)} → {formatDate(sprint.endDate)}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {points > 0 && (
            <span className="pill pill-todo" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {points} SP
            </span>
          )}
          <span className="pill pill-todo" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {counts[StatusCategory.TODO]}
          </span>
          <span className="pill pill-progress" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {counts[StatusCategory.IN_PROGRESS]}
          </span>
          <span className="pill pill-done" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {counts[StatusCategory.DONE]}
          </span>
        </div>

        {canManageSprint && sprint && sprint.state === SprintState.PLANNED && (
          <>
            <button className="btn" onClick={onStart}>
              Pornește
            </button>
            <button className="btn btn-danger" onClick={onDelete}>
              Șterge
            </button>
          </>
        )}
        {canManageSprint && sprint && sprint.state === SprintState.ACTIVE && (
          <button className="btn" onClick={onComplete}>
            Închide
          </button>
        )}
        {canManageSprint && !sprint && onCreateSprint && (
          <button className="btn btn-primary" onClick={onCreateSprint}>
            Creează sprint
          </button>
        )}
      </div>

      {!collapsed && (
        <div style={{ padding: tasks.length || canCreate ? '6px 0' : 0 }}>
          {tasks.map((t) => (
            <button key={t.id} className="backlog-row" onClick={() => onOpenTask(t.key)}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <TypeIcon type={t.type} />
                <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {t.key}
                </span>
              </span>
              <span style={{ fontSize: 13, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
              <span>{t.epic && <EpicChip epic={t.epic} />}</span>
              <span style={{ display: 'flex', gap: 4 }}>
                {t.labels.map((l) => (
                  <span key={l} className="chip-label">
                    {l}
                  </span>
                ))}
              </span>
              <span className={categoryPillClass(t.status.category)}>{t.status.name}</span>
              <span style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                {t.storyPoints ?? ''}
              </span>
              <Avatar name={t.assignee?.fullName} size={24} unassigned={!t.assignee} />
            </button>
          ))}
          {tasks.length === 0 && (
            <EmptyState title={group.sprint ? 'Niciun task în acest sprint' : 'Backlog gol'} />
          )}
          {canCreate && (
            <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', padding: '8px 14px', color: 'var(--muted)' }} onClick={onCreate}>
              + Creează
            </button>
          )}
        </div>
      )}
    </div>
  );
}
