import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsUUID, Length, Matches, MaxLength } from 'class-validator';
import { BoardType } from '../project.entity';

export class CreateProjectDto {
  @ApiProperty({ example: 'WEB', description: '2-10 chars, uppercase letters/digits, starts with a letter' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z][A-Z0-9]{1,9}$/, { message: 'key must be 2-10 uppercase letters/digits starting with a letter' })
  key: string;

  @ApiProperty({ example: 'Website relaunch' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 120)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ enum: BoardType, default: BoardType.SCRUM })
  @IsOptional()
  @IsEnum(BoardType)
  boardType?: BoardType;

  @ApiPropertyOptional({ description: 'User added to the project with the Project Manager role' })
  @IsOptional()
  @IsUUID()
  leadId?: string;
}

export class UpdateProjectDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ enum: BoardType })
  @IsOptional()
  @IsEnum(BoardType)
  boardType?: BoardType;
}

export class AddMemberDto {
  @ApiProperty()
  @IsUUID()
  userId: string;

  @ApiPropertyOptional({ description: 'Defaults to the role marked as default (Viewer)' })
  @IsOptional()
  @IsUUID()
  roleId?: string;
}

export class ChangeMemberRoleDto {
  @ApiProperty()
  @IsUUID()
  roleId: string;
}
