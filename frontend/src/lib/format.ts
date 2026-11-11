export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleString('ro-RO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function toDateInputValue(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toISOString().slice(0, 10);
}

const PRIORITY_LABEL: Record<string, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

export function priorityLabel(p: string): string {
  return PRIORITY_LABEL[p] ?? p;
}

export function priorityPillClass(p: string): string {
  return (
    {
      LOW: 'pill pill-low',
      MEDIUM: 'pill pill-medium',
      HIGH: 'pill pill-high',
      CRITICAL: 'pill pill-critical',
    }[p] ?? 'pill pill-low'
  );
}

export function categoryPillClass(category: string): string {
  return (
    {
      TODO: 'pill pill-todo',
      IN_PROGRESS: 'pill pill-progress',
      DONE: 'pill pill-done',
    }[category] ?? 'pill pill-todo'
  );
}

const TYPE_ICON: Record<string, string> = { STORY: '◆', TASK: '▣', BUG: '●' };
export function typeIcon(t: string): string {
  return TYPE_ICON[t] ?? '▣';
}
