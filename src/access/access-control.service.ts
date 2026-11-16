import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../projects/project.entity';
import { ProjectMember } from '../projects/project-member.entity';
import { User, SystemRole } from '../users/user.entity';
import { Permission } from './permission.enum';
import { grantsAllow } from './grant-evaluator';
import { ProjectAccess } from './project-access';

@Injectable()
export class AccessControlService {
  constructor(
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    @InjectRepository(ProjectMember) private readonly members: Repository<ProjectMember>,
  ) {}

  /**
   * Resolves the user's access to a project and requires at least `project.view`.
   * Non-members get 404 (we don't reveal that the project exists).
   */
  async forProject(user: User, projectId: string): Promise<ProjectAccess> {
    const exists = await this.projects.exist({ where: { id: projectId } });
    if (!exists) throw new NotFoundException('Project not found');

    const membership =
      user.systemRole === SystemRole.ADMIN
        ? null
        : await this.members.findOne({ where: { projectId, userId: user.id }, relations: { role: true } });

    const access = new ProjectAccess(user, projectId, membership);
    if (!access.isAdmin && !membership) throw new NotFoundException('Project not found');
    access.assert(Permission.PROJECT_VIEW);
    return access;
  }

  /** Whether a given user may be an assignee in the project (needs `task.assignable`). */
  async isAssignable(projectId: string, userId: string): Promise<boolean> {
    const m = await this.members.findOne({
      where: { projectId, userId, user: { isActive: true } },
      relations: { role: true, user: true },
    });
    return !!m && grantsAllow(m.role.grants, Permission.TASK_ASSIGNABLE, userId);
  }
}
