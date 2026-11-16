import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { GrantScope, Permission } from '../../access/permission.enum';

export const STATUS_KEY_RULE = /^[A-Z][A-Z0-9_]{0,39}$/;

export class PermissionGrantDto {
  @ApiProperty({ enum: Permission })
  @IsEnum(Permission)
  permission: Permission;

  @ApiPropertyOptional({ enum: GrantScope, default: GrantScope.ANY })
  @IsOptional()
  @IsEnum(GrantScope)
  scope?: GrantScope;

  @ApiPropertyOptional({ type: [String], example: ['IN_QA'], description: 'Task must be in one of these statuses' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(50)
  @Matches(STATUS_KEY_RULE, { each: true, message: 'each status must be an UPPER_SNAKE_CASE key' })
  statuses?: string[];
}

export class CreateRoleDto {
  @ApiProperty({ example: 'Tech Lead' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 60)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ type: [PermissionGrantDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PermissionGrantDto)
  grants: PermissionGrantDto[];

  @ApiPropertyOptional({ description: 'Make this the default role for newly added members' })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateRoleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 60)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ type: [PermissionGrantDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PermissionGrantDto)
  grants?: PermissionGrantDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
