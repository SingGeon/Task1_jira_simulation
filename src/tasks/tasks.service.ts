import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ActivityService, diff } from '../activity/activity.service';
import { AccessControlService } from '../access/access-control.service';
import { Permission } from '../access/permission.enum';
import { ProjectAccess } from '../access/project-access';
import { paginate } from '../common/dto/pagination.dto';
import { BoardType, Project } from '../projects/project.entity';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { Sprint, SprintState } from '../sprints/sprint.entity';
import { SprintsService } from '../sprints/sprints.service';
import { User } from '../users/user.entity';
import { StatusCategory } from '../workflow/workflow-status.entity';
import { WorkflowService } from '../workflow/workflow.service';
import { Task, TaskType } from './task.entity';
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

function taskRefLabel(ref: Task | null): string | null {
  return ref ? `${ref.key} — ${ref.title}` : null;
}

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
    private readonly activity: ActivityService,
  ) {}

  // ---------- helpers ----------

  private baseQuery() {
    return this.tasks
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.status', 'status')
      .leftJoinAndSelect('t.assignee', 'assignee')
      .leftJoinAndSelect('t.reporter', 'reporter')
      .leftJoinAndSelect('t.sprint', 'sprint')
      .leftJoinAndSelect('t.epic', 'epic')
      .leftJoinAndSelect('t.parent', 'parent');
  }

  /** An epicId must point at an EPIC in the same project; epics can't belong to another epic. */
  private async resolveEpic(projectId: string, epicId: string): Promise<Task> {
    const epic = await this.tasks.findOne({ where: { id: epicId, projectId } });
    if (!epic) throw new BadRequestException('Epic not found in this project');
    if (epic.type !== TaskType.EPIC) throw new BadRequestException(`'${epic.key}' is not an epic`);
    return epic;
  }

  /** A parentId must point at a story/task/bug in the same project — not an epic, not another sub-task. */
  private async resolveParent(projectId: string, parentId: string): Promise<Task> {
    const parent = await this.tasks.findOne({ where: { id: parentId, projectId } });
    if (!parent) throw new BadRequestException('Parent task not found in this project');
    if (parent.type === TaskType.EPIC) throw new BadRequestException('A sub-task cannot belong to an epic directly');
    if (parent.type === TaskType.SUBTASK) throw new BadRequestException('A sub-task cannot belong to another sub-task');
    return parent;
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
      // Claiming the new task for yourself only needs 'task.assignable' (checked below via
      // assertAssignable) — 'task.assign' scoped to ASSIGNEE can never pass here, since it would
      // require already being the assignee before the task (and the assignment) even exist.
      if (dto.assigneeId !== user.id) {
        access.assert(Permission.TASK_ASSIGN, { assigneeId: null, reporterId: user.id, status: initial });
      }
      await this.assertAssignable(projectId, dto.assigneeId);
    }
    // Placing a new task directly into a sprint only needs 'task.create': anyone
    // allowed to create tasks can add their own into the sprint they're working in.
    if (dto.sprintId) await this.resolveSprint(projectId, dto.sprintId);
    if (dto.type === TaskType.EPIC && dto.sprintId) throw new BadRequestException('Epics cannot be placed in a sprint');
    if (dto.type === TaskType.SUBTASK && dto.sprintId) {
      throw new BadRequestException('Sub-tasks cannot be placed in a sprint directly (they follow their parent)');
    }
    if (dto.epicId) {
      if (dto.type === TaskType.EPIC) throw new BadRequestException('An epic cannot belong to another epic');
      if (dto.type === TaskType.SUBTASK) {
        throw new BadRequestException("Sub-tasks don't have their own epic — they inherit it from their parent");
      }
      await this.resolveEpic(projectId, dto.epicId);
    }
    if (dto.type === TaskType.SUBTASK && !dto.parentId) {
      throw new BadRequestException('A sub-task needs a parentId');
    }
    if (dto.parentId) {
      if (dto.type !== TaskType.SUBTASK) throw new BadRequestException('Only a sub-task can have a parentId');
      await this.resolveParent(projectId, dto.parentId);
    }
    if (dto.hue !== undefined && dto.type !== TaskType.EPIC) {
      throw new BadRequestException('Only an epic can have a custom color');
    }

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
          epicId: dto.epicId ?? null,
          parentId: dto.parentId ?? null,
          hue: dto.hue ?? null,
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
    const { title, description, type, priority, labels, storyPoints, epicId, parentId, hue } = dto;
    const changes = Object.fromEntries(
      Object.entries({ title, description, type, priority, labels, storyPoints, epicId, parentId, hue }).filter(
        ([, v]) => v !== undefined,
      ),
    );
    if (Object.keys(changes).length === 0) throw new BadRequestException('Nothing to update');

    const resultingType = type ?? task.type;
    if (hue !== undefined && hue !== null && resultingType !== TaskType.EPIC) {
      throw new BadRequestException('Only an epic can have a custom color');
    }
    if (epicId !== undefined && epicId !== null) {
      if (resultingType === TaskType.EPIC) throw new BadRequestException('An epic cannot belong to another epic');
      if (resultingType === TaskType.SUBTASK) {
        throw new BadRequestException("Sub-tasks don't have their own epic — they inherit it from their parent");
      }
      await this.resolveEpic(task.projectId, epicId);
    }
    if (resultingType === TaskType.SUBTASK) {
      const resultingEpicId = epicId !== undefined ? epicId : task.epicId;
      if (resultingEpicId) throw new BadRequestException("Sub-tasks don't have their own epic — they inherit it from their parent");
      const resultingParentId = parentId !== undefined ? parentId : task.parentId;
      if (!resultingParentId) throw new BadRequestException('A sub-task needs a parentId');
    } else if (parentId !== undefined) {
      throw new BadRequestException('Only a sub-task can have a parentId');
    }
    if (parentId !== undefined) await this.resolveParent(task.projectId, parentId);

    await this.tasks.update(task.id, changes);
    const updated = await this.reload(task.id);
    // `hue` is deliberately not logged here — it's a cosmetic epic color, not something worth
    // cluttering the task's history timeline with.
    await this.activity.record(task.id, user, [
      ...diff('title', task.title, updated.title),
      ...diff('description', task.description, updated.description),
      ...diff('type', task.type, updated.type),
      ...diff('priority', task.priority, updated.priority),
      ...diff('labels', task.labels.join(', ') || null, updated.labels.join(', ') || null),
      ...diff('storyPoints', task.storyPoints?.toString() ?? null, updated.storyPoints?.toString() ?? null),
      ...diff('epic', taskRefLabel(task.epic), taskRefLabel(updated.epic)),
      ...diff('parent', taskRefLabel(task.parent), taskRefLabel(updated.parent)),
    ]);
    this.realtime.broadcast(task.projectId);
    return updated;
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
    await this.activity.record(task.id, user, diff('status', task.status.name, target.name));
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
    // Assigning yourself only needs 'task.assignable' (checked below via assertAssignable) —
    // anyone eligible to hold tasks can grab one directly, no approval step. The regular
    // 'task.assign' grant (often scoped to ASSIGNEE for IC-shaped roles) would otherwise require
    // already being the assignee before the very change that makes you one, which can never be
    // true the first time. Assigning someone ELSE still goes through the full check.
    if (dto.assigneeId !== user.id) access.assert(Permission.TASK_ASSIGN, task);
    if (dto.assigneeId) await this.assertAssignable(task.projectId, dto.assigneeId);
    await this.tasks.update(task.id, { assigneeId: dto.assigneeId });
    const updated = await this.reload(task.id);
    await this.activity.record(
      task.id,
      user,
      diff('assignee', task.assignee?.fullName ?? null, updated.assignee?.fullName ?? null),
    );
    this.realtime.broadcast(task.projectId);
    return updated;
  }

  async moveToSprint(user: User, idOrKey: string, dto: MoveToSprintDto): Promise<Task> {
    const { task, access } = await this.load(user, idOrKey);
    access.assert(Permission.SPRINT_MANAGE);
    if (dto.sprintId && (task.type === TaskType.EPIC || task.type === TaskType.SUBTASK)) {
      throw new BadRequestException(`A ${task.type === TaskType.EPIC ? 'epic' : 'sub-task'} cannot be placed in a sprint`);
    }
    if (dto.sprintId) await this.resolveSprint(task.projectId, dto.sprintId);
    await this.tasks.update(task.id, { sprintId: dto.sprintId });
    const updated = await this.reload(task.id);
    await this.activity.record(
      task.id,
      user,
      diff('sprint', task.sprint?.name ?? null, updated.sprint?.name ?? null),
    );
    this.realtime.broadcast(task.projectId);
    return updated;
  }

  /** Activity history for one task, newest first. Any project member can view it. */
  async activityForTask(user: User, idOrKey: string) {
    const { task } = await this.load(user, idOrKey);
    return this.activity.listForTask(task.id);
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
    if (q.epicId) qb.andWhere('t.epicId = :epicId', { epicId: q.epicId });
    if (q.parentId) qb.andWhere('t.parentId = :parentId', { parentId: q.parentId });
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
    const qb = this.baseQuery()
      .where('t.projectId = :projectId', { projectId })
      // Epics and sub-tasks don't get their own board card: epics group work at a higher level,
      // sub-tasks show up nested under their parent instead (list() with ?parentId=).
      .andWhere('t.type NOT IN (:...excludedFromBoard)', { excludedFromBoard: [TaskType.EPIC, TaskType.SUBTASK] });
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

  /** Epics in a project, each with how many tasks link to it and how many of those are DONE. */
  async listEpics(user: User, projectId: string) {
    await this.acl.forProject(user, projectId);
    const epics = await this.tasks.find({
      where: { projectId, type: TaskType.EPIC },
      relations: { status: true, assignee: true, reporter: true },
      order: { createdAt: 'ASC' },
    });
    if (epics.length === 0) return [];

    const counts = await this.tasks
      .createQueryBuilder('t')
      .leftJoin('t.status', 'status')
      .select('t.epicId', 'epicId')
      .addSelect('COUNT(*)', 'total')
      .addSelect('COUNT(*) FILTER (WHERE status.category = :done)', 'done')
      .where('t.projectId = :projectId', { projectId })
      .andWhere('t.epicId IS NOT NULL')
      .setParameter('done', StatusCategory.DONE)
      .groupBy('t.epicId')
      .getRawMany<{ epicId: string; total: string; done: string }>();
    const byEpic = new Map(counts.map((c) => [c.epicId, { taskCount: Number(c.total), doneCount: Number(c.done) }]));

    return epics.map((epic) => ({ ...epic, ...(byEpic.get(epic.id) ?? { taskCount: 0, doneCount: 0 }) }));
  }
}
