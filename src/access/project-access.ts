import { ForbiddenException } from '@nestjs/common';
import { User, SystemRole } from '../users/user.entity';
import { ProjectMember } from '../projects/project-member.entity';
import { Permission } from './permission.enum';
import { describeRequirement, grantsAllow, TaskContext } from './grant-evaluator';

/** Minimal task shape accepted for conditional checks. */
export interface TaskLike {
  assigneeId: string | null;
  reporterId: string;
  status: { key: string };
}

export const toTaskContext = (t: TaskLike): TaskContext => ({
  assigneeId: t.assigneeId,
  reporterId: t.reporterId,
  statusKey: t.status.key,
});

/**
 * The resolved access of one user to one project. Created per request by
 * AccessControlService.forProject(); all permission checks go through it.
 */
export class ProjectAccess {
  constructor(
    readonly user: User,
    readonly projectId: string,
    readonly membership: ProjectMember | null,
  ) {}

  get isAdmin(): boolean {
    return this.user.systemRole === SystemRole.ADMIN;
  }

  can(permission: Permission, task?: TaskLike): boolean {
    if (this.isAdmin) return true; // admins bypass project RBAC
    if (!this.membership) return false;
    return grantsAllow(
      this.membership.role.grants,
      permission,
      this.user.id,
      task ? toTaskContext(task) : undefined,
    );
  }

  assert(permission: Permission, task?: TaskLike): void {
    if (this.can(permission, task)) return;
    const role = this.membership?.role;
    const why = role ? describeRequirement(role.grants, permission) : 'you are not a member';
    throw new ForbiddenException(
      `Role '${role?.name ?? 'none'}' is not allowed to perform '${permission}'` +
        (task ? ' on this task' : '') +
        ` (${why})`,
    );
  }
}
