import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { Task } from '../tasks/task.entity';
import { DEFAULT_STATUSES, DEFAULT_TRANSITIONS } from './default-workflow';
import { WorkflowStatus } from './workflow-status.entity';
import { WorkflowTransition } from './workflow-transition.entity';
import { CreateStatusDto, CreateTransitionDto, UpdateStatusDto } from './dto/workflow.dto';

@Injectable()
export class WorkflowService {
  constructor(
    @InjectRepository(WorkflowStatus) private readonly statuses: Repository<WorkflowStatus>,
    @InjectRepository(WorkflowTransition) private readonly transitions: Repository<WorkflowTransition>,
    @InjectRepository(Task) private readonly tasks: Repository<Task>,
    private readonly realtime: RealtimeGateway,
  ) {}

  /** Creates the default workflow for a freshly created project (inside its transaction). */
  async seedDefault(em: EntityManager, projectId: string): Promise<void> {
    const saved = await em.save(
      DEFAULT_STATUSES.map((s, i) => em.create(WorkflowStatus, { ...s, projectId, position: i })),
    );
    const byKey = new Map(saved.map((s) => [s.key, s.id]));
    await em.save(
      DEFAULT_TRANSITIONS.map(([from, to]) =>
        em.create(WorkflowTransition, { projectId, fromStatusId: byKey.get(from)!, toStatusId: byKey.get(to)! }),
      ),
    );
  }

  async getWorkflow(projectId: string) {
    const [statuses, transitions] = await Promise.all([
      this.listStatuses(projectId),
      this.transitions.find({ where: { projectId } }),
    ]);
    const keyOf = new Map(statuses.map((s) => [s.id, s.key]));
    return {
      statuses,
      transitions: transitions.map((t) => ({
        id: t.id,
        fromStatusId: t.fromStatusId,
        toStatusId: t.toStatusId,
        from: keyOf.get(t.fromStatusId),
        to: keyOf.get(t.toStatusId),
      })),
    };
  }

  listStatuses(projectId: string) {
    return this.statuses.find({ where: { projectId }, order: { position: 'ASC' } });
  }

  async initialStatus(projectId: string): Promise<WorkflowStatus> {
    const s = await this.statuses.findOne({ where: { projectId }, order: { position: 'ASC' } });
    if (!s) throw new BadRequestException('Project has no workflow statuses');
    return s;
  }

  async findStatusByKey(projectId: string, key: string): Promise<WorkflowStatus> {
    const s = await this.statuses.findOne({ where: { projectId, key } });
    if (!s) throw new BadRequestException(`Status '${key}' does not exist in this project's workflow`);
    return s;
  }

  async getStatus(projectId: string, statusId: string): Promise<WorkflowStatus> {
    const s = await this.statuses.findOne({ where: { id: statusId, projectId } });
    if (!s) throw new NotFoundException('Status not found');
    return s;
  }

  isTransitionAllowed(projectId: string, fromStatusId: string, toStatusId: string): Promise<boolean> {
    return this.transitions.exist({ where: { projectId, fromStatusId, toStatusId } });
  }

  async allowedTargets(projectId: string, fromStatusId: string): Promise<string[]> {
    const ts = await this.transitions.find({ where: { projectId, fromStatusId }, relations: { toStatus: true } });
    return ts.map((t) => t.toStatus.key);
  }

  async createStatus(projectId: string, dto: CreateStatusDto): Promise<WorkflowStatus> {
    if (await this.statuses.exist({ where: { projectId, key: dto.key } })) {
      throw new ConflictException(`Status '${dto.key}' already exists`);
    }
    const count = await this.statuses.count({ where: { projectId } });
    const position = Math.min(dto.position ?? count, count);
    await this.shift(projectId, position, +1);
    const saved = await this.statuses.save(this.statuses.create({ ...dto, projectId, position }));
    this.realtime.broadcast(projectId);
    return saved;
  }

  async updateStatus(projectId: string, statusId: string, dto: UpdateStatusDto): Promise<WorkflowStatus> {
    const status = await this.getStatus(projectId, statusId);
    if (dto.name !== undefined) status.name = dto.name;
    if (dto.category !== undefined) status.category = dto.category;
    if (dto.position !== undefined && dto.position !== status.position) {
      const all = await this.listStatuses(projectId);
      const others = all.filter((s) => s.id !== status.id);
      others.splice(Math.min(dto.position, others.length), 0, status);
      others.forEach((s, i) => (s.position = i));
      await this.statuses.save(others);
      this.realtime.broadcast(projectId);
      return this.getStatus(projectId, statusId);
    }
    const saved = await this.statuses.save(status);
    this.realtime.broadcast(projectId);
    return saved;
  }

  async deleteStatus(projectId: string, statusId: string): Promise<void> {
    const status = await this.getStatus(projectId, statusId);
    const used = await this.tasks.count({ where: { statusId } });
    if (used > 0) throw new ConflictException(`${used} task(s) are in this status; move them first`);
    if ((await this.statuses.count({ where: { projectId } })) <= 1) {
      throw new BadRequestException('A workflow needs at least one status');
    }
    await this.statuses.delete(status.id); // transitions cascade
    await this.shift(projectId, status.position + 1, -1);
    this.realtime.broadcast(projectId);
  }

  async createTransition(projectId: string, dto: CreateTransitionDto) {
    if (dto.fromStatusId === dto.toStatusId) throw new BadRequestException('A transition needs two different statuses');
    await this.getStatus(projectId, dto.fromStatusId);
    await this.getStatus(projectId, dto.toStatusId);
    if (await this.transitions.exist({ where: { fromStatusId: dto.fromStatusId, toStatusId: dto.toStatusId } })) {
      throw new ConflictException('Transition already exists');
    }
    const saved = await this.transitions.save(this.transitions.create({ ...dto, projectId }));
    this.realtime.broadcast(projectId);
    return saved;
  }

  async deleteTransition(projectId: string, transitionId: string): Promise<void> {
    const res = await this.transitions.delete({ id: transitionId, projectId });
    if (!res.affected) throw new NotFoundException('Transition not found');
    this.realtime.broadcast(projectId);
  }

  private shift(projectId: string, fromPosition: number, delta: number) {
    return this.statuses
      .createQueryBuilder()
      .update()
      .set({ position: () => `position + ${delta}` })
      .where('project_id = :projectId AND position >= :fromPosition', { projectId, fromPosition })
      .execute();
  }
}
