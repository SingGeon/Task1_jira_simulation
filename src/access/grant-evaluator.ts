import { GrantScope, Permission, PermissionGrant } from './permission.enum';

/** Minimal view of a task needed to evaluate conditional grants. */
export interface TaskContext {
  assigneeId: string | null;
  reporterId: string;
  statusKey: string;
}

/** Pure function - the heart of RBAC. Easy to unit test. */
export function grantMatches(
  grant: PermissionGrant,
  permission: Permission,
  userId: string,
  task?: TaskContext,
): boolean {
  if (grant.permission !== permission) return false;
  const scope = grant.scope ?? GrantScope.ANY;
  const statuses = grant.statuses ?? [];

  if (!task) {
    // Without a task, only unconditional grants can apply.
    return scope === GrantScope.ANY && statuses.length === 0;
  }
  if (scope === GrantScope.ASSIGNEE && task.assigneeId !== userId) return false;
  if (scope === GrantScope.REPORTER && task.reporterId !== userId) return false;
  if (statuses.length > 0 && !statuses.includes(task.statusKey)) return false;
  return true;
}

export function grantsAllow(
  grants: PermissionGrant[],
  permission: Permission,
  userId: string,
  task?: TaskContext,
): boolean {
  return grants.some((g) => grantMatches(g, permission, userId, task));
}

/** Human readable explanation of what a role would need, used in 403 messages. */
export function describeRequirement(grants: PermissionGrant[], permission: Permission): string {
  const relevant = grants.filter((g) => g.permission === permission);
  if (relevant.length === 0) return 'your role does not have this permission at all';
  const parts = relevant.map((g) => {
    const c: string[] = [];
    if (g.scope === GrantScope.ASSIGNEE) c.push('the task is assigned to you');
    if (g.scope === GrantScope.REPORTER) c.push('you reported the task');
    if (g.statuses?.length) c.push(`the task is in status ${g.statuses.join('/')}`);
    return c.length ? c.join(' AND ') : 'always';
  });
  return `allowed only when: ${parts.join(' OR ')}`;
}
