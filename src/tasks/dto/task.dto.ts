import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { STATUS_KEY_RULE } from '../../roles/dto/role.dto';
import { TaskPriority, TaskType } from '../task.entity';

const LABEL_RULE = /^[\p{L}\p{N}_.-]{1,30}$/u;
const normalizeLabels = ({ value }: { value: unknown }) =>
  Array.isArray(value)
    ? [...new Set(value.map((v) => (typeof v === 'string' ? v.trim().toLowerCase() : v)))]
    : value;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateTaskDto {
  @ApiProperty({ example: 'Login page returns 500' })
  @Transform(trim)
  @IsString()
  @Length(3, 200)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  description?: string;

  @ApiPropertyOptional({ enum: TaskType, default: TaskType.TASK })
  @IsOptional()
  @IsEnum(TaskType)
  type?: TaskType;

  @ApiPropertyOptional({ enum: TaskPriority, default: TaskPriority.MEDIUM })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional({ type: [String], example: ['backend', 'auth'] })
  @IsOptional()
  @Transform(normalizeLabels)
  @IsArray()
  @ArrayMaxSize(20)
  @Matches(LABEL_RULE, { each: true, message: 'labels must be 1-30 chars: letters, digits, _ . -' })
  labels?: string[];

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  storyPoints?: number;

  @ApiPropertyOptional({ description: "Requires 'task.assign'" })
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @ApiPropertyOptional({ description: 'Put directly in a sprint; backlog otherwise' })
  @IsOptional()
  @IsUUID()
  sprintId?: string;
}

/** Plain field edits. Status, assignee and sprint have dedicated endpoints (different permissions). */
export class UpdateTaskDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(3, 200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  description?: string;

  @ApiPropertyOptional({ enum: TaskType })
  @IsOptional()
  @IsEnum(TaskType)
  type?: TaskType;

  @ApiPropertyOptional({ enum: TaskPriority })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @Transform(normalizeLabels)
  @IsArray()
  @ArrayMaxSize(20)
  @Matches(LABEL_RULE, { each: true, message: 'labels must be 1-30 chars: letters, digits, _ . -' })
  labels?: string[];

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(0)
  @Max(100)
  storyPoints?: number | null;
}

export class TransitionTaskDto {
  @ApiProperty({ example: 'IN_PROGRESS', description: 'Target workflow status key' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(STATUS_KEY_RULE, { message: 'status must be a workflow status key, e.g. IN_PROGRESS' })
  status: string;
}

export class AssignTaskDto {
  @ApiProperty({ nullable: true, description: 'null to unassign' })
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  assigneeId: string | null;
}

export class MoveToSprintDto {
  @ApiProperty({ nullable: true, description: 'null moves the task to the backlog' })
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  sprintId: string | null;
}

export class ListTasksQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Status key' })
  @IsOptional()
  @Matches(STATUS_KEY_RULE)
  status?: string;

  @ApiPropertyOptional({ description: "User id, 'me' or 'unassigned'" })
  @IsOptional()
  @ValidateIf((_, v) => !['me', 'unassigned'].includes(v))
  @IsUUID()
  assignee?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  sprintId?: string;

  @ApiPropertyOptional({ description: 'true = only tasks not in any sprint' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  backlog?: boolean;

  @ApiPropertyOptional({ enum: TaskType })
  @IsOptional()
  @IsEnum(TaskType)
  type?: TaskType;

  @ApiPropertyOptional({ enum: TaskPriority })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional({ description: 'Search in title and key' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ enum: ['createdAt', 'updatedAt', 'priority'], default: 'createdAt' })
  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'priority'])
  sort?: 'createdAt' | 'updatedAt' | 'priority';
}

export class BoardQueryDto {
  @ApiPropertyOptional({ description: "Filter cards by assignee: user id, 'me' or 'unassigned'" })
  @IsOptional()
  @ValidateIf((_, v) => !['me', 'unassigned'].includes(v))
  @IsUUID()
  assignee?: string;
}

