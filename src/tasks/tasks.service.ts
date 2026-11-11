import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AccessControlService } from '../access/access-control.service';
import { Permission } from '../access/permission.enum';
import { ProjectAccess } from '../access/project-access';
import { paginate } from '../common/dto/pagination.dto';
import { BoardType, Project } from '../projects/project.entity';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { Sprint, SprintState } from '../sprints/sprint.entity';
import { SprintsService } from '../sprints/sprints.service';
import { User } from '../users/user.entity';
import { WorkflowService } from '../workflow/workflow.service';
import { Task } from './task.entity';
import {
  AssignTaskDto,
  BoardQueryDto,
  CreateTaskDto,
  ListTasksQueryDto,
  MoveToSprintDto,
  TransitionTaskDto,
  UpdateTaskDto,
} from './dto/task.dto';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task) private readonly tasks: Repository<Task>,
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    private readonly dataSource: DataSource,
    private readonly acl: AccessControlService,
    private readonly workflow: WorkflowService,
    private readonly sprints: SprintsService,
    private readonly realtime: RealtimeGateway,
  ) {}

  // ---------- helpers ----------

  private baseQuery() {
    return this.tasks
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.status', 'status')
      .leftJoinAndSelect('t.assignee', 'assignee')
      .leftJoinAndSelect('t.reporter', 'reporter')
      .leftJoinAndSelect('t.sprint', 'sprint');
  }

  /** Loads a task by id or key ("WEB-12") and resolves the caller's project access. */
  async load(user: User, idOrKey: string): Promise<{ task: Task; access: ProjectAccess }> {
    const qb = this.baseQuery();
    if (UUID_RE.test(idOrKey)) qb.where('t.id = :v', { v: idOrKey });
    else qb.where('t.key = :v', { v: idOrKey.toUpperCase() });
    const task = await qb.getOne();
    if (!task) throw new NotFoundException('Task not found');
    const access = await this.acl.forProject(user, task.projectId); // 404 for non-members
    return { task, access };
  }

  private async reload(id: string): Promise<Task> {
    return this.baseQuery().where('t.id = :id', { id }).getOneOrFail();
  }

  private async assertAssignable(projectId: string, userId: string) {
    if (!(await this.acl.isAssignable(projectId, userId))) {
      throw new BadRequestException(
        "Assignee must be an active project member whose role has 'task.assignable'",
      );
    }
  }

  private async resolveSprint(projectId: string, sprintId: string): Promise<Sprint> {
    const project = await this.projects.findOneByOrFail({ id: projectId });
    if (project.boardType !== BoardType.SCRUM) {
      throw new BadRequestException('KANBAN projects have no sprints');
    }
    const sprint = await this.sprints.get(projectId, sprintId);
    if (sprint.state === SprintState.CLOSED) throw new BadRequestException('Cannot add tasks to a closed sprint');
    return sprint;
  }

  private resolveAssigneeFilter(user: User, v?: string) {
    if (v === 'me') return user.id;
    if (v === 'unassigned') return null;
    return v;
  }

  // ---------- commands ----------

  async create(user: User, projectId: string, dto: CreateTaskDto): Promise<Task> {
    const access = await this.acl.forProject(user, projectId);
    access.assert(Permission.TASK_CREATE);

    const initial = await this.workflow.initialStatus(projectId);
    if (dto.assigneeId) {
      // Evaluate 'task.assign' against the task as it would exist before assignment.
      access.assert(Permission.TASK_ASSIGN, { assigneeId: null, reporterId: user.id, status: initial });
      await this.assertAssignable(projectId, dto.assigneeId);
    }
    // Placing a new task directly into a sprint only needs 'task.create': anyone
    // allowed to create tasks can add their own into the sprint they're working in.
    if (dto.sprintId) await this.resolveSprint(projectId, dto.sprintId);

    const id = await this.dataSource.transaction(async (em) => {
      // Atomic per-project counter -> WEB-1, WEB-2, ... (safe under concurrency)
      const res = await em
        .createQueryBuilder()
        .update(Project)
        .set({ taskCounter: () => 'task_counter + 1' })
        .where('id = :projectId', { projectId })
        .returning(['taskCounter', 'key'])
        .execute();
      const { task_counter, key } = res.raw[0];
      const saved = await em.save(
        em.create(Task, {
          projectId,
          key: `${key}-${task_counter}`,
          title: dto.title,
          description: dto.description ?? '',
          type: dto.type,
          priority: dto.priority,
          labels: dto.labels ?? [],
          storyPoints: dto.storyPoints ?? null,
          statusId: initial.id,
          assigneeId: dto.assigneeId ?? null,
          reporterId: user.id,
          sprintId: dto.sprintId ?? null,
        }),
      );
      return saved.id;
    });
    this.realtime.broadcast(projectId);
    return this.reload(id);
  }

  async update(user: User, idOrKey: string, dto: UpdateTaskDto): Promise<Task> {
    const { task, access } = await this.load(user, idOrKey);
    access.assert(Permission.TASK_UPDATE, task);
    const { title, description, type, priority, labels, storyPoints } = dto;
    const changes = Object.fromEntries(
      Object.entries({ title, description, type, priority, labels, storyPoints }).filter(([, v]) => v !== undefined),
    );
    if (Object.keys(changes).length === 0) throw new BadRequestException('Nothing to update');
    await this.tasks.update(task.id, changes);
    this.realtime.broadcast(task.projectId);
    return this.reload(task.id);
  }

  async transition(user: User, idOrKey: string, dto: TransitionTaskDto): Promise<Task> {
    const { task, access } = await this.load(user, idOrKey);
    access.assert(Permission.TASK_TRANSITION, task);

    const target = await this.workflow.findStatusByKey(task.projectId, dto.status);
    if (target.id === task.statusId) throw new BadRequestException(`Task is already in ${target.key}`);
    if (!(await this.workflow.isTransitionAllowed(task.projectId, task.statusId, target.id))) {
      const allowed = await this.workflow.allowedTargets(task.projectId, task.statusId);
      throw new BadRequestException(
        `Workflow does not allow ${task.status.key} -> ${target.key}. Allowed: ${allowed.join(', ') || 'none'}`,
      );
    }
    await this.tasks.update(task.id, { statusId: target.id });
    this.realtime.broadcast(task.projectId);
    return this.reload(task.id);
  }

  /** Transitions the caller could perform right now (like Jira's transition buttons). */
  async availableTransitions(user: User, idOrKey: string) {
    const { task, access } = await this.load(user, idOrKey);
    if (!access.can(Permission.TASK_TRANSITION, task)) return [];
    const wf = await this.workflow.getWorkflow(task.projectId);
    return wf.transitions
      .filter((t) => t.fromStatusId === task.statusId)
      .map((t) => wf.statuses.find((s) => s.id === t.toStatusId)!);
  }

  async assign(user: User, idOrKey: string, dto: AssignTaskDto): Promise<Task> {
    const { task, access } = await this.load(user, idOrKey);
    access.assert(Permission.TASK_ASSIGN, task);
    if (dto.assigneeId) await this.assertAssignable(task.projectId, dto.assigneeId);
    await this.tasks.update(task.id, { assigneeId: dto.assigneeId });
    this.realtime.broadcast(task.projectId);
    return this.reload(task.id);
  }

  async moveToSprint(user: User, idOrKey: string, dto: MoveToSprintDto): Promise<Task> {
    const { task, access } = await this.load(user, idOrKey);
    access.assert(Permission.SPRINT_MANAGE);
    if (dto.sprintId) await this.resolveSprint(task.projectId, dto.sprintId);
    await this.tasks.update(task.id, { sprintId: dto.sprintId });
    this.realtime.broadcast(task.projectId);
    return this.reload(task.id);
  }

  async remove(user: User, idOrKey: string): Promise<void> {
    const { task, access } = await this.load(user, idOrKey);
    access.assert(Permission.TASK_DELETE, task);
    await this.tasks.delete(task.id);
    this.realtime.broadcast(task.projectId);
  }

  // ---------- queries ----------

  async list(user: User, projectId: string, q: ListTasksQueryDto) {
    await this.acl.forProject(user, projectId);
    const qb = this.baseQuery().where('t.projectId = :projectId', { projectId });
    if (q.status) qb.andWhere('status.key = :status', { status: q.status });
    const assignee = this.resolveAssigneeFilter(user, q.assignee);
    if (assignee === null) qb.andWhere('t.assigneeId IS NULL');
    else if (assignee) qb.andWhere('t.assigneeId = :assignee', { assignee });
    if (q.label) qb.andWhere(':label = ANY(t.labels)', { label: q.label.toLowerCase() });
    if (q.backlog) qb.andWhere('t.sprintId IS NULL');
    else if (q.sprintId) qb.andWhere('t.sprintId = :sprintId', { sprintId: q.sprintId });
    if (q.type) qb.andWhere('t.type = :type', { type: q.type });
    if (q.priority) qb.andWhere('t.priority = :priority', { priority: q.priority });
    if (q.q) qb.andWhere('(t.title ILIKE :q OR t.key ILIKE :q)', { q: `%${q.q}%` });
    const sort = q.sort ?? 'createdAt';
    qb.orderBy(`t.${sort}`, 'DESC').addOrderBy('t.createdAt', 'DESC');
    const [items, total] = await qb.skip((q.page - 1) * q.limit).take(q.limit).getManyAndCount();
    return paginate(items, total, q);
  }

  /**
   * Board view. SCRUM: tasks of the active sprint. KANBAN: every task.
   * One column per workflow status, in workflow order.
   */
  async board(user: User, projectId: string, q: BoardQueryDto) {
    await this.acl.forProject(user, projectId);
    const project = await this.projects.findOneByOrFail({ id: projectId });
    const statuses = await this.workflow.listStatuses(projectId);

    let sprint: Sprint | null = null;
    let tasks: Task[] = [];
    const qb = this.baseQuery().where('t.projectId = :projectId', { projectId });
    const assignee = this.resolveAssigneeFilter(user, q.assignee);
    if (assignee === null) qb.andWhere('t.assigneeId IS NULL');
    else if (assignee) qb.andWhere('t.assigneeId = :assignee', { assignee });

    if (project.boardType === BoardType.SCRUM) {
      sprint = await this.sprints.findActive(projectId);
      if (sprint) tasks = await qb.andWhere('t.sprintId = :sid', { sid: sprint.id }).orderBy('t.createdAt').getMany();
    } else {
      tasks = await qb.orderBy('t.createdAt').getMany();
    }

    return {
      project: { id: project.id, key: project.key, name: project.name, boardType: project.boardType },
      sprint,
      columns: statuses.map((s) => ({
        status: s,
        tasks: tasks.filter((t) => t.statusId === s.id),
      })),
    };
  }
}
