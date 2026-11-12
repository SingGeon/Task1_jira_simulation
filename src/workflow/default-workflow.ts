import { StatusCategory } from './workflow-status.entity';

/** Workflow every new project starts with. Fully editable afterwards. */
export const DEFAULT_STATUSES = [
  { key: 'TODO', name: 'To Do', category: StatusCategory.TODO },
  { key: 'IN_PROGRESS', name: 'In Progress', category: StatusCategory.IN_PROGRESS },
  { key: 'IN_REVIEW', name: 'Code Review', category: StatusCategory.IN_PROGRESS },
  { key: 'IN_QA', name: 'In QA', category: StatusCategory.IN_PROGRESS },
  { key: 'DONE', name: 'Done', category: StatusCategory.DONE },
];

/**
 * Every status can move to every other status by default — a new project starts fully open
 * (move a task "cum vrei și de unde vrei"), not pre-restricted to a specific chain. A PM narrows
 * this down afterwards on the Workflow tab (§6.2) if their team wants a stricter process; nothing
 * here is enforced as "the" correct flow, it's just the permissive starting point.
 */
export const DEFAULT_TRANSITIONS: [string, string][] = DEFAULT_STATUSES.flatMap(({ key: from }) =>
  DEFAULT_STATUSES.filter(({ key: to }) => to !== from).map(({ key: to }) => [from, to] as [string, string]),
);
