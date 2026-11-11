import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectMember } from '../projects/project-member.entity';
import { ProjectsService } from '../projects/projects.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { RolesService } from '../roles/roles.service';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { CreateInviteDto } from './dto/invite.dto';
import { InviteStatus, ProjectInvite } from './invite.entity';

const RELATIONS = { project: true, user: true, role: true, invitedBy: true };

@Injectable()
export class InvitesService {
  constructor(
    @InjectRepository(ProjectInvite) private readonly invites: Repository<ProjectInvite>,
    @InjectRepository(ProjectMember) private readonly members: Repository<ProjectMember>,
    private readonly roles: RolesService,
    private readonly users: UsersService,
    private readonly projectsService: ProjectsService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async create(projectId: string, invitedBy: User, dto: CreateInviteDto): Promise<ProjectInvite> {
    await this.users.findById(dto.userId);
    await this.roles.findById(dto.roleId);

    if (await this.members.exist({ where: { projectId, userId: dto.userId } })) {
      throw new ConflictException('User is already a member of this project');
    }
    if (await this.invites.exist({ where: { projectId, userId: dto.userId, status: InviteStatus.PENDING } })) {
      throw new ConflictException('This user already has a pending invite to this project');
    }

    const saved = await this.invites.save(
      this.invites.create({ projectId, userId: dto.userId, roleId: dto.roleId, invitedById: invitedBy.id }),
    );
    this.realtime.broadcast(projectId);
    return this.reload(saved.id);
  }

  listForProject(projectId: string): Promise<ProjectInvite[]> {
    return this.invites.find({ where: { projectId }, relations: RELATIONS, order: { createdAt: 'DESC' } });
  }

  listMine(user: User): Promise<ProjectInvite[]> {
    return this.invites.find({ where: { userId: user.id }, relations: RELATIONS, order: { createdAt: 'DESC' } });
  }

  async accept(user: User, id: string): Promise<ProjectInvite> {
    const invite = await this.getPendingForUser(user, id);
    await this.projectsService.addMember(invite.projectId, { userId: user.id, roleId: invite.roleId });
    await this.invites.update(invite.id, { status: InviteStatus.ACCEPTED, respondedAt: new Date() });
    this.realtime.broadcast(invite.projectId);
    return this.reload(invite.id);
  }

  async decline(user: User, id: string): Promise<ProjectInvite> {
    const invite = await this.getPendingForUser(user, id);
    await this.invites.update(invite.id, { status: InviteStatus.DECLINED, respondedAt: new Date() });
    return this.reload(invite.id);
  }

  private async getPendingForUser(user: User, id: string): Promise<ProjectInvite> {
    const invite = await this.invites.findOne({ where: { id } });
    if (!invite) throw new NotFoundException('Invite not found');
    if (invite.userId !== user.id) throw new ForbiddenException('This invite is not addressed to you');
    if (invite.status !== InviteStatus.PENDING) throw new BadRequestException('This invite was already answered');
    return invite;
  }

  private reload(id: string): Promise<ProjectInvite> {
    return this.invites.findOneOrFail({ where: { id }, relations: RELATIONS });
  }
}
