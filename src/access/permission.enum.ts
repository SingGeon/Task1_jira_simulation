/**
 * Catalogue of project-level actions. Roles are built from these keys
 * (stored as data), so new roles never need code changes.
 * Adding a brand-new *kind* of action is the only thing that needs code.
 */
export enum Permission {
  PROJECT_VIEW = 'project.view',
  PROJECT_UPDATE = 'project.update', // project settings + workflow (statuses / transitions)
  MEMBERS_MANAGE = 'project.members.manage',
  SPRINT_MANAGE = 'sprint.manage', // create/start/complete sprints, move tasks between sprint & backlog
  TASK_CREATE = 'task.create',
  TASK_UPDATE = 'task.update', // title, description, labels, priority, type, story points
  TASK_TRANSITION = 'task.transition', // change status (through the workflow)
  TASK_ASSIGN = 'task.assign', // change assignee
  TASK_ASSIGNABLE = 'task.assignable', // the member can BE an assignee
  TASK_DELETE = 'task.delete',
  COMMENT_CREATE = 'comment.create',
  COMMENT_MANAGE = 'comment.manage', // edit/delete other people's comments
}

export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  [Permission.PROJECT_VIEW]: 'See the project, its board, backlog, tasks and comments',
  [Permission.PROJECT_UPDATE]: 'Edit project settings and its workflow',
  [Permission.MEMBERS_MANAGE]: 'Add/remove project members and change their roles',
  [Permission.SPRINT_MANAGE]: 'Plan, start and complete sprints; move tasks between sprints/backlog',
  [Permission.TASK_CREATE]: 'Create tasks',
  [Permission.TASK_UPDATE]: 'Edit task fields (title, description, labels, priority...)',
  [Permission.TASK_TRANSITION]: 'Move a task to another status',
  [Permission.TASK_ASSIGN]: 'Change the assignee of a task',
  [Permission.TASK_ASSIGNABLE]: 'Can have tasks assigned to them',
  [Permission.TASK_DELETE]: 'Delete tasks',
  [Permission.COMMENT_CREATE]: 'Comment on tasks',
  [Permission.COMMENT_MANAGE]: "Edit/delete other users' comments",
};

/** Permissions whose grants may carry task conditions (scope / statuses). */
export const TASK_SCOPED_PERMISSIONS: Permission[] = [
  Permission.TASK_UPDATE,
  Permission.TASK_TRANSITION,
  Permission.TASK_ASSIGN,
  Permission.TASK_DELETE,
];

/** Who the task must "belong" to for a grant to apply. */
export enum GrantScope {
  ANY = 'ANY',
  ASSIGNEE = 'ASSIGNEE', // task is assigned to the acting user
  REPORTER = 'REPORTER', // task was created by the acting user
}

/**
 * One rule inside a role. A role allows an action if ANY of its grants for
 * that permission match (OR). Inside a grant all conditions must hold (AND).
 */
export interface PermissionGrant {
  permission: Permission;
  scope?: GrantScope; // default ANY
  statuses?: string[]; // workflow status keys the task must currently be in; empty = any status
}
