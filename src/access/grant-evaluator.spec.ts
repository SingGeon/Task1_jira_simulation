import { describeRequirement, grantsAllow, TaskContext } from './grant-evaluator';
import { GrantScope, Permission, PermissionGrant } from './permission.enum';
import { SYSTEM_ROLES, SYSTEM_ROLE_NAMES } from '../roles/system-roles';

const ME = 'user-me';
const OTHER = 'user-other';
const grantsOf = (name: string) => SYSTEM_ROLES.find((r) => r.name === name)!.grants;
const task = (p: Partial<TaskContext> = {}): TaskContext => ({
  assigneeId: OTHER,
  reporterId: OTHER,
  statusKey: 'TODO',
  ...p,
});

describe('grant evaluator', () => {
  it('unconditional grant applies with or without a task', () => {
    const g: PermissionGrant[] = [{ permission: Permission.TASK_UPDATE }];
    expect(grantsAllow(g, Permission.TASK_UPDATE, ME)).toBe(true);
    expect(grantsAllow(g, Permission.TASK_UPDATE, ME, task())).toBe(true);
    expect(grantsAllow(g, Permission.TASK_DELETE, ME, task())).toBe(false);
  });

  it('conditional grants never apply without a task', () => {
    const g: PermissionGrant[] = [{ permission: Permission.TASK_UPDATE, scope: GrantScope.ASSIGNEE }];
    expect(grantsAllow(g, Permission.TASK_UPDATE, ME)).toBe(false);
  });

  it('grants are OR-ed, conditions inside a grant are AND-ed', () => {
    const g: PermissionGrant[] = [
      { permission: Permission.TASK_UPDATE, scope: GrantScope.ASSIGNEE, statuses: ['IN_QA'] },
      { permission: Permission.TASK_UPDATE, scope: GrantScope.REPORTER },
    ];
    expect(grantsAllow(g, Permission.TASK_UPDATE, ME, task({ assigneeId: ME, statusKey: 'IN_QA' }))).toBe(true);
    expect(grantsAllow(g, Permission.TASK_UPDATE, ME, task({ assigneeId: ME, statusKey: 'TODO' }))).toBe(false);
    expect(grantsAllow(g, Permission.TASK_UPDATE, ME, task({ reporterId: ME, statusKey: 'TODO' }))).toBe(true);
  });

  describe('seeded roles', () => {
    it('Developer can transition only tasks assigned to them', () => {
      const dev = grantsOf(SYSTEM_ROLE_NAMES.DEVELOPER);
      expect(grantsAllow(dev, Permission.TASK_TRANSITION, ME, task({ assigneeId: ME }))).toBe(true);
      expect(grantsAllow(dev, Permission.TASK_TRANSITION, ME, task())).toBe(false);
    });

    it('Developer can delete only tasks assigned to them; QA cannot delete at all', () => {
      const dev = grantsOf(SYSTEM_ROLE_NAMES.DEVELOPER);
      expect(grantsAllow(dev, Permission.TASK_DELETE, ME, task({ assigneeId: ME }))).toBe(true);
      expect(grantsAllow(dev, Permission.TASK_DELETE, ME, task())).toBe(false);

      const qa = grantsOf(SYSTEM_ROLE_NAMES.QA);
      expect(grantsAllow(qa, Permission.TASK_DELETE, ME, task({ assigneeId: ME }))).toBe(false);
    });

    it('QA can change only tasks in IN_QA that are assigned to them', () => {
      const qa = grantsOf(SYSTEM_ROLE_NAMES.QA);
      expect(grantsAllow(qa, Permission.TASK_TRANSITION, ME, task({ assigneeId: ME, statusKey: 'IN_QA' }))).toBe(true);
      expect(grantsAllow(qa, Permission.TASK_TRANSITION, ME, task({ assigneeId: ME, statusKey: 'IN_PROGRESS' }))).toBe(false);
      expect(grantsAllow(qa, Permission.TASK_TRANSITION, ME, task({ statusKey: 'IN_QA' }))).toBe(false);
      expect(grantsAllow(qa, Permission.TASK_UPDATE, ME, task({ assigneeId: ME, statusKey: 'TODO' }))).toBe(false);
    });

    it('Project Manager can do everything', () => {
      const pm = grantsOf(SYSTEM_ROLE_NAMES.PROJECT_MANAGER);
      for (const p of Object.values(Permission)) expect(grantsAllow(pm, p, ME, task())).toBe(true);
    });

    it('Viewer can only view', () => {
      const v = grantsOf(SYSTEM_ROLE_NAMES.VIEWER);
      expect(Object.values(Permission).filter((p) => grantsAllow(v, p, ME, task({ assigneeId: ME })))).toEqual([
        Permission.PROJECT_VIEW,
      ]);
    });
  });

  it('explains requirements for 403 messages', () => {
    const qa = grantsOf(SYSTEM_ROLE_NAMES.QA);
    expect(describeRequirement(qa, Permission.TASK_TRANSITION)).toContain('assigned to you AND the task is in status IN_QA');
    expect(describeRequirement(qa, Permission.TASK_DELETE)).toContain('does not have this permission');
  });
});
