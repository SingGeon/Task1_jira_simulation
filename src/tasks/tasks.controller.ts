import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { TasksService } from './tasks.service';
import {
  AssignTaskDto,
  BoardQueryDto,
  CreateTaskDto,
  ListTasksQueryDto,
  MoveToSprintDto,
  TransitionTaskDto,
  UpdateTaskDto,
} from './dto/task.dto';

@ApiTags('tasks')
@ApiBearerAuth()
@Controller()
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Post('projects/:projectId/tasks')
  create(@CurrentUser() user: User, @Param('projectId', ParseUUIDPipe) projectId: string, @Body() dto: CreateTaskDto) {
    return this.tasks.create(user, projectId, dto);
  }

  @Get('projects/:projectId/tasks')
  @ApiOperation({ summary: 'List/filter tasks (use backlog=true for the backlog)' })
  list(@CurrentUser() user: User, @Param('projectId', ParseUUIDPipe) projectId: string, @Query() q: ListTasksQueryDto) {
    return this.tasks.list(user, projectId, q);
  }

  @Get('projects/:projectId/board')
  @ApiOperation({ summary: 'Board: active sprint (SCRUM) or all tasks (KANBAN), grouped by status' })
  board(@CurrentUser() user: User, @Param('projectId', ParseUUIDPipe) projectId: string, @Query() q: BoardQueryDto) {
    return this.tasks.board(user, projectId, q);
  }

  @Get('projects/:projectId/epics')
  @ApiOperation({ summary: 'Epics in this project, each with linked/done task counts' })
  listEpics(@CurrentUser() user: User, @Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.tasks.listEpics(user, projectId);
  }

  @Get('tasks/:idOrKey')
  @ApiOperation({ summary: 'Get a task by id or key (e.g. WEB-12)' })
  async get(@CurrentUser() user: User, @Param('idOrKey') idOrKey: string) {
    return (await this.tasks.load(user, idOrKey)).task;
  }

  @Patch('tasks/:idOrKey')
  @ApiOperation({ summary: "Edit fields (requires 'task.update')" })
  update(@CurrentUser() user: User, @Param('idOrKey') idOrKey: string, @Body() dto: UpdateTaskDto) {
    return this.tasks.update(user, idOrKey, dto);
  }

  @Get('tasks/:idOrKey/transitions')
  @ApiOperation({ summary: 'Statuses the current user can move this task to' })
  transitions(@CurrentUser() user: User, @Param('idOrKey') idOrKey: string) {
    return this.tasks.availableTransitions(user, idOrKey);
  }

  @Post('tasks/:idOrKey/transitions')
  @HttpCode(200)
  @ApiOperation({ summary: "Change status through the workflow (requires 'task.transition')" })
  transition(@CurrentUser() user: User, @Param('idOrKey') idOrKey: string, @Body() dto: TransitionTaskDto) {
    return this.tasks.transition(user, idOrKey, dto);
  }

  @Put('tasks/:idOrKey/assignee')
  @ApiOperation({ summary: "Assign/unassign (requires 'task.assign')" })
  assign(@CurrentUser() user: User, @Param('idOrKey') idOrKey: string, @Body() dto: AssignTaskDto) {
    return this.tasks.assign(user, idOrKey, dto);
  }

  @Put('tasks/:idOrKey/sprint')
  @ApiOperation({ summary: "Move to a sprint or back to backlog (requires 'sprint.manage')" })
  moveToSprint(@CurrentUser() user: User, @Param('idOrKey') idOrKey: string, @Body() dto: MoveToSprintDto) {
    return this.tasks.moveToSprint(user, idOrKey, dto);
  }

  @Delete('tasks/:idOrKey')
  @HttpCode(204)
  remove(@CurrentUser() user: User, @Param('idOrKey') idOrKey: string) {
    return this.tasks.remove(user, idOrKey);
  }

  @Get('tasks/:idOrKey/activity')
  @ApiOperation({ summary: "History: who changed what and when, newest first (like Jira's 'History' tab)" })
  activity(@CurrentUser() user: User, @Param('idOrKey') idOrKey: string) {
    return this.tasks.activityForTask(user, idOrKey);
  }
}
