import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Min } from 'class-validator';
import { STATUS_KEY_RULE } from '../../roles/dto/role.dto';
import { StatusCategory } from '../workflow-status.entity';

export class CreateStatusDto {
  @ApiProperty({ example: 'BLOCKED', description: 'UPPER_SNAKE_CASE, unique within project' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(STATUS_KEY_RULE, { message: 'key must be UPPER_SNAKE_CASE (max 40 chars)' })
  key: string;

  @ApiProperty({ example: 'Blocked' })
  @IsString()
  @Length(1, 60)
  name: string;

  @ApiProperty({ enum: StatusCategory })
  @IsEnum(StatusCategory)
  category: StatusCategory;

  @ApiPropertyOptional({ description: 'Column index; appended at the end if omitted' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;
}

export class UpdateStatusDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 60)
  name?: string;

  @ApiPropertyOptional({ enum: StatusCategory })
  @IsOptional()
  @IsEnum(StatusCategory)
  category?: StatusCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;
}

export class CreateTransitionDto {
  @ApiProperty()
  @IsUUID()
  fromStatusId: string;

  @ApiProperty()
  @IsUUID()
  toStatusId: string;
}
