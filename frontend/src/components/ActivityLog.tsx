import { Avatar } from './Avatar';
import { activityFieldLabel, formatDateTime } from '../lib/format';
import type { Activity } from '../lib/types';

interface Group {
  actorName: string;
  createdAt: string;
  entries: Activity[];
}

/** Several fields changed in the same request share one `createdAt` — group them under one actor/time header. */
function groupByMoment(items: Activity[]): Group[] {
  const groups: Group[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.entries[0].actorId === item.actorId && last.createdAt === item.createdAt) {
      last.entries.push(item);
    } else {
      groups.push({ actorName: item.actorName, createdAt: item.createdAt, entries: [item] });
    }
  }
  return groups;
}

export function ActivityLog({
  items,
  showTask,
  onOpenTask,
}: {
  items: Activity[];
  showTask?: boolean;
  onOpenTask?: (task: NonNullable<Activity['task']>) => void;
}) {
  if (items.length === 0) {
    return <p style={{ fontSize: 13, color: 'var(--muted)' }}>Nicio activitate încă.</p>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {groupByMoment(items).map((g, i) => (
        <div key={i} style={{ display: 'flex', gap: 10 }}>
          <Avatar name={g.actorName} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <strong style={{ fontSize: 13 }}>{g.actorName}</strong>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>{formatDateTime(g.createdAt)}</span>
            </div>
            <ul style={{ margin: '4px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 3 }}>
              {g.entries.map((e) => (
                <li key={e.id} style={{ fontSize: 13 }}>
                  {showTask && e.task && (
                    onOpenTask ? (
                      <button
                        className="mono"
                        style={{ all: 'unset', cursor: 'pointer', fontSize: 11, color: 'var(--accent)', marginRight: 6 }}
                        onClick={() => onOpenTask(e.task!)}
                      >
                        {e.task.key}
                      </button>
                    ) : (
                      <span className="mono" style={{ fontSize: 11, color: 'var(--muted)', marginRight: 6 }}>
                        {e.task.key}
                      </span>
                    )
                  )}
                  <span style={{ color: 'var(--muted)' }}>{activityFieldLabel(e.field)}:</span>{' '}
                  <span style={{ color: 'var(--muted)', textDecoration: 'line-through' }}>{e.fromValue ?? '—'}</span>
                  {' → '}
                  <span>{e.toValue ?? '—'}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ))}
    </div>
  );
}
