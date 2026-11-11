import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../projects/project.entity';
import { ProjectMember } from '../projects/project-member.entity';
import { ProjectsService } from '../projects/projects.service';
import { RolesService } from '../roles/roles.service';
import { User } from '../users/user.entity';
import { CreateJoinRequestDto } from './dto/join-request.dto';
import { JoinRequest, JoinRequestStatus } from './join-request.entity';

const RELATIONS = { project: true, user: true, role: true, decidedBy: true };

@Injectable()
export class JoinRequestsService {
  constructor(
    @InjectRepository(JoinRequest) private readonly requests: Repository<JoinRequest>,
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    @InjectRepository(ProjectMember) private readonly members: Repository<ProjectMember>,
    private readonly roles: RolesService,
    private readonly projectsService: ProjectsService,
  ) {}

  async create(user: User, dto: CreateJoinRequestDto): Promise<JoinRequest> {
    if (!(await this.projects.exist({ where: { id: dto.projectId } }))) {
      throw new NotFoundException('Project not found');
    }
    await this.roles.findById(dto.roleId); // throws if missing

    // Already a member: this becomes a role-change request instead of a join request.
    const membership = await this.members.findOne({ where: { projectId: dto.projectId, userId: user.id } });
    if (membership && membership.roleId === dto.roleId) {
      throw new ConflictException('You already have this role in the project');
    }
    if (
      await this.requests.exist({
        where: { projectId: dto.projectId, userId: user.id, status: JoinRequestStatus.PENDING },
      })
    ) {
      throw new ConflictException('You already have a pending request for this project');
    }

    const saved = await this.requests.save(
      this.requests.create({
        projectId: dto.projectId,
        userId: user.id,
        roleId: dto.roleId,
        message: dto.message ?? '',
      }),
    );
    return this.reload(saved.id);
  }

  listMine(user: User): Promise<JoinRequest[]> {
    return this.requests.find({ where: { userId: user.id }, relations: RELATIONS, order: { createdAt: 'DESC' } });
  }

  listPending(): Promise<JoinRequest[]> {
    return this.requests.find({
      where: { status: JoinRequestStatus.PENDING },
      relations: RELATIONS,
      order: { createdAt: 'ASC' },
    });
  }

  async approve(admin: User, id: string): Promise<JoinRequest> {
    const req = await this.getPending(id);
    const isMember = await this.members.exist({ where: { projectId: req.projectId, userId: req.userId } });
    if (isMember) {
      await this.projectsService.changeRole(req.projectId, req.userId, { roleId: req.roleId });
    } else {
      await this.projectsService.addMember(req.projectId, { userId: req.userId, roleId: req.roleId });
    }
    await this.requests.update(req.id, {
      status: JoinRequestStatus.APPROVED,
      decidedById: admin.id,
      decidedAt: new Date(),
    });
    return this.reload(req.id);
  }

  async reject(admin: User, id: string): Promise<JoinRequest> {
    const req = await this.getPending(id);
    await this.requests.update(req.id, {
      status: JoinRequestStatus.REJECTED,
      decidedById: admin.id,
      decidedAt: new Date(),
    });
    return this.reload(req.id);
  }

  private async getPending(id: string): Promise<JoinRequest> {
    const req = await this.requests.findOne({ where: { id } });
    if (!req) throw new NotFoundException('Request not found');
    if (req.status !== JoinRequestStatus.PENDING) throw new BadRequestException('Request was already decided');
    return req;
  }

  private reload(id: string): Promise<JoinRequest> {
    return this.requests.findOneOrFail({ where: { id }, relations: RELATIONS });
  }
}
