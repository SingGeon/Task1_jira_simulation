import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';
import { SprintState } from '../sprint.entity';

export class CreateSprintDto {
  @ApiProperty({ example: 'Sprint 1' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 80)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  goal?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date;
}

export class UpdateSprintDto extends PartialType(CreateSprintDto) {}

export class StartSprintDto {
  @ApiPropertyOptional({ type: String, format: 'date-time', description: 'Defaults to now' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Type(() => Date)
  @IsDate()
  endDate: Date;
}

export class CompleteSprintDto {
  @ApiPropertyOptional({ description: 'Planned sprint receiving unfinished tasks; backlog if omitted' })
  @IsOptional()
  @IsUUID()
  moveOpenTasksToSprintId?: string;
}

export class ListSprintsQueryDto {
  @ApiPropertyOptional({ enum: SprintState })
  @IsOptional()
  @IsEnum(SprintState)
  state?: SprintState;
}
