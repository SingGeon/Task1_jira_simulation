import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useProjectAccess } from '../lib/projectAccess';
import { useProjectRealtime } from '../lib/realtime';
import { BoardType, Permission, type Board, type BoardColumn, type Task } from '../lib/types';
import { Spinner, ErrorBanner, EmptyState } from '../components/Feedback';
import { TaskCard } from '../components/TaskCard';
import { TaskDrawer } from '../components/TaskDrawer';
import { CreateTaskModal } from '../components/CreateTaskModal';
import { categoryPillClass } from '../lib/format';

export function BoardPage() {
  const { project, can } = useProjectAccess();
  const { user: me } = useAuth();
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const openTask = params.get('task');
  // can(TASK_TRANSITION) only reflects an unconditional grant (no task context) — a role like
  // Developer, whose grant is scoped to "assigned to me", would otherwise never be draggable at
  // all. Treat "assigned to me" as drag-eligible too; the backend still enforces the real,
  // possibly status-conditional, permission on drop (and the UI reverts cleanly if it rejects).
  const canDragTask = (t: Task) => can(Permission.TASK_TRANSITION) || t.assigneeId === me?.id;

  const load = useCallback(() => {
    api
      .get<Board>(`/projects/${project.id}/board`)
      .then(setBoard)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Nu am putut încărca board-ul'));
  }, [project.id]);

  useEffect(load, [load]);
  useProjectRealtime(project.id, load);

  const moveCard = (taskKey: string, targetColumn: BoardColumn) => {
    setBoard((prev) => {
      if (!prev) return prev;
      let moved: Board['columns'][number]['tasks'][number] | undefined;
      const columns = prev.columns.map((c) => {
        const idx = c.tasks.findIndex((t) => t.key === taskKey);
        if (idx === -1) return c;
        moved = c.tasks[idx];
        return { ...c, tasks: c.tasks.filter((t) => t.key !== taskKey) };
      });
      if (!moved) return prev;
      const withMoved = columns.map((c) =>
        c.status.id === targetColumn.status.id ? { ...c, tasks: [...c.tasks, { ...moved!, statusId: targetColumn.status.id, status: targetColumn.status }] } : c,
      );
      return { ...prev, columns: withMoved };
    });
  };

  const onDrop = async (column: BoardColumn) => {
    const taskKey = draggingKey;
    setDraggingKey(null);
    setDragOverColumn(null);
    if (!taskKey) return;
    const current = board?.columns.find((c) => c.tasks.some((t) => t.key === taskKey));
    if (!current || current.status.id === column.status.id) return;

    moveCard(taskKey, column);
    setError(null);
    try {
      await api.post(`/tasks/${taskKey}/transitions`, { status: column.status.key });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Mutarea nu a fost permisă de workflow');
      load();
    }
  };

  if (error && !board) return <ErrorBanner message={error} />;
  if (!board) return <Spinner />;

  if (project.boardType === BoardType.SCRUM && !board.sprint) {
    return (
      <EmptyState
        title="Niciun sprint activ"
        hint="Pornește un sprint din tab-ul Sprinturi ca să vezi task-urile pe board."
      />
    );
  }

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          {board.sprint ? `Sprint: ${board.sprint.name}` : 'Toate task-urile'}
        </span>
        {can(Permission.TASK_CREATE) && (
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            + Task
          </button>
        )}
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="scroll-x" style={{ flex: 1, minHeight: 0 }}>
        <div style={{ display: 'flex', gap: 14, height: '100%', paddingBottom: 8 }}>
          {board.columns.map((col) => (
            <div
              key={col.status.id}
              onDragOver={(e) => {
                if (!draggingKey) return;
                e.preventDefault();
                setDragOverColumn(col.status.id);
              }}
              onDragLeave={() => setDragOverColumn((c) => (c === col.status.id ? null : c))}
              onDrop={(e) => {
                e.preventDefault();
                onDrop(col);
              }}
              style={{
                width: 272,
                minWidth: 272,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                background: dragOverColumn === col.status.id ? 'var(--accent-soft)' : 'var(--surface-sunken)',
                borderRadius: 'var(--radius-lg)',
                padding: 10,
                border: dragOverColumn === col.status.id ? '1px dashed var(--accent)' : '1px solid var(--border)',
                transition: 'background 0.1s ease, border-color 0.1s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span className={categoryPillClass(col.status.category)}>{col.status.name}</span>
                <span style={{ fontSize: 12, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{col.tasks.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', flex: 1 }}>
                {col.tasks.map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    onOpen={() => setParams({ task: t.key })}
                    draggable={canDragTask(t)}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move';
                      setDraggingKey(t.key);
                    }}
                    onDragEnd={() => {
                      setDraggingKey(null);
                      setDragOverColumn(null);
                    }}
                  />
                ))}
                {col.tasks.length === 0 && (
                  <div
                    style={{
                      flex: 1,
                      minHeight: 64,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1.5px dashed var(--border)',
                      borderRadius: 'var(--radius)',
                      fontSize: 12,
                      color: 'var(--muted)',
                    }}
                  >
                    Fără task-uri
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {openTask && (
        <TaskDrawer
          idOrKey={openTask}
          onClose={() => setParams({})}
          onChanged={load}
        />
      )}
      {showCreate && (
        <CreateTaskModal
          projectId={project.id}
          sprintId={board.sprint?.id}
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
