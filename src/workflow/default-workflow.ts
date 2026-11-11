import { StatusCategory } from './workflow-status.entity';

/** Workflow every new project starts with. Fully editable afterwards. */
export const DEFAULT_STATUSES = [
  { key: 'TODO', name: 'To Do', category: StatusCategory.TODO },
  { key: 'IN_PROGRESS', name: 'In Progress', category: StatusCategory.IN_PROGRESS },
  { key: 'IN_REVIEW', name: 'Code Review', category: StatusCategory.IN_PROGRESS },
  { key: 'IN_QA', name: 'In QA', category: StatusCategory.IN_PROGRESS },
  { key: 'DONE', name: 'Done', category: StatusCategory.DONE },
];

export const DEFAULT_TRANSITIONS: [string, string][] = [
  ['TODO', 'IN_PROGRESS'],
  ['IN_PROGRESS', 'TODO'],
  ['IN_PROGRESS', 'IN_REVIEW'],
  ['IN_REVIEW', 'IN_PROGRESS'],
  ['IN_REVIEW', 'IN_QA'],
  ['IN_QA', 'IN_PROGRESS'], // QA rejected
  ['IN_QA', 'DONE'],
  ['DONE', 'IN_PROGRESS'], // reopen
];
