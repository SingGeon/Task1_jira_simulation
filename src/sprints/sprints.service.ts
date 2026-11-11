import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Not, Repository } from 'typeorm';
import { BoardType, Project } from '../projects/project.entity';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { Task } from '../tasks/task.entity';
import { StatusCategory, WorkflowStatus } from '../workflow/workflow-status.entity';
import { Sprint, SprintState } from './sprint.entity';
import { CompleteSprintDto, CreateSprintDto, ListSprintsQueryDto, StartSprintDto, UpdateSprintDto } from './dto/sprint.dto';

@Injectable()
export class SprintsService {
  constructor(
    @InjectRepository(Sprint) private readonly sprints: Repository<Sprint>,
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    private readonly dataSource: DataSource,
    private readonly realtime: RealtimeGateway,
  ) {}

  async assertScrum(projectId: string) {
    const p = await this.projects.findOneByOrFail({ id: projectId });
    if (p.boardType !== BoardType.SCRUM) {
      throw new BadRequestException('Sprints are only available in SCRUM projects (this one is KANBAN)');
    }
  }

  list(projectId: string, q: ListSprintsQueryDto) {
    return this.sprints.find({
      where: { projectId, ...(q.state ? { state: q.state } : {}) },
      order: { createdAt: 'ASC' },
    });
  }

  async get(projectId: string, sprintId: string): Promise<Sprint> {
    const s = await this.sprints.findOne({ where: { id: sprintId, projectId } });
    if (!s) throw new NotFoundException('Sprint not found');
    return s;
  }

  findActive(projectId: string) {
    return this.sprints.findOne({ where: { projectId, state: SprintState.ACTIVE } });
  }

  async create(projectId: string, dto: CreateSprintDto): Promise<Sprint> {
    await this.assertScrum(projectId);
    this.assertDates(dto.startDate, dto.endDate);
    const saved = await this.sprints.save(this.sprints.create({ ...dto, projectId, goal: dto.goal ?? '' }));
    this.realtime.broadcast(projectId);
    return saved;
  }

  async update(projectId: string, sprintId: string, dto: UpdateSprintDto): Promise<Sprint> {
    const s = await this.get(projectId, sprintId);
    if (s.state === SprintState.CLOSED) throw new BadRequestException('Closed sprints cannot be edited');
    Object.assign(s, dto);
    this.assertDates(s.startDate, s.endDate);
    const saved = await this.sprints.save(s);
    this.realtime.broadcast(projectId);
    return saved;
  }

  async start(projectId: string, sprintId: string, dto: StartSprintDto): Promise<Sprint> {
    await this.assertScrum(projectId);
    const s = await this.get(projectId, sprintId);
    if (s.state !== SprintState.PLANNED) throw new BadRequestException('Only PLANNED sprints can be started');
    if (await this.findActive(projectId)) {
      throw new ConflictException('Another sprint is already active; complete it first');
    }
    s.startDate = dto.startDate ?? new Date();
    s.endDate = dto.endDate;
    this.assertDates(s.startDate, s.endDate);
    s.state = SprintState.ACTIVE;
    const saved = await this.sprints.save(s);
    this.realtime.broadcast(projectId);
    return saved;
  }

  /** Closes the sprint; unfinished tasks (status category != DONE) go to backlog or another planned sprint. */
  async complete(projectId: string, sprintId: string, dto: CompleteSprintDto) {
    const s = await this.get(projectId, sprintId);
    if (s.state !== SprintState.ACTIVE) throw new BadRequestException('Only the ACTIVE sprint can be completed');
    let target: Sprint | null = null;
    if (dto.moveOpenTasksToSprintId) {
      target = await this.get(projectId, dto.moveOpenTasksToSprintId);
      if (target.state !== SprintState.PLANNED) {
        throw new BadRequestException('Unfinished tasks can only be moved to a PLANNED sprint');
      }
    }
    return this.dataSource.transaction(async (em) => {
      const doneStatusIds = (
        await em.find(WorkflowStatus, { where: { projectId, category: StatusCategory.DONE }, select: { id: true } })
      ).map((x) => x.id);
      const open = await em.find(Task, {
        where: {
          sprintId,
          ...(doneStatusIds.length ? { statusId: Not(In(doneStatusIds)) } : {}),
        },
        select: { id: true },
      });
      if (open.length) {
        await em.update(Task, { id: In(open.map((t) => t.id)) }, { sprintId: target?.id ?? null });
      }
      s.state = SprintState.CLOSED;
      s.completedAt = new Date();
      await em.save(s);
      this.realtime.broadcast(projectId);
      const completedTasks = await em.count(Task, { where: { sprintId } });
      return {
        sprint: s,
        completedTasks,
        movedTasks: open.length,
        movedTo: target ? { sprintId: target.id, name: target.name } : 'backlog',
      };
    });
  }

  async remove(projectId: string, sprintId: string): Promise<void> {
    const s = await this.get(projectId, sprintId);
    if (s.state !== SprintState.PLANNED) throw new BadRequestException('Only PLANNED sprints can be deleted');
    await this.sprints.delete(s.id); // tasks fall back to the backlog (FK ON DELETE SET NULL)
    this.realtime.broadcast(projectId);
  }

  private assertDates(start?: Date | null, end?: Date | null) {
    if (start && end && end <= start) throw new BadRequestException('endDate must be after startDate');
  }
}
