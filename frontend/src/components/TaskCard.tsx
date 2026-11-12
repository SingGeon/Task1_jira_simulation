import type { Task } from '../lib/types';
import { Avatar } from './Avatar';
import { EpicChip } from './EpicChip';
import { TypeIcon } from './TypeIcon';
import { priorityPillClass } from '../lib/format';

export function TaskCard({
  task,
  onOpen,
  draggable,
  onDragStart,
  onDragEnd,
}: {
  task: Task;
  onOpen: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
}) {
  return (
    <button
      className="card task-card"
      onClick={onOpen}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{
        textAlign: 'left',
        padding: 11,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        width: '100%',
        cursor: draggable ? 'grab' : 'pointer',
      }}
    >
      <p style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.35 }}>{task.title}</p>
      {task.epic && (
        <div>
          <EpicChip epic={task.epic} />
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <TypeIcon type={task.type} />
          <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
            {task.key}
          </span>
        </span>
        <span className={priorityPillClass(task.priority)}>{task.priority}</span>
        {task.storyPoints != null && (
          <span className="pill pill-todo" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {task.storyPoints} SP
          </span>
        )}
      </div>
      {task.labels.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {task.labels.map((l) => (
            <span key={l} className="pill pill-todo" style={{ background: 'var(--surface-sunken)' }}>
              {l}
            </span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Avatar name={task.assignee?.fullName} size={22} unassigned={!task.assignee} />
      </div>
    </button>
  );
}
