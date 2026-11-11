import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateJoinRequestDto {
  @ApiProperty({ description: 'Project to join, or a project you are already a member of to request a role change' })
  @IsUUID()
  projectId: string;

  @ApiProperty({ description: 'Requested project role (if already a member, this is treated as a role-change request)' })
  @IsUUID()
  roleId: string;

  @ApiPropertyOptional({ example: 'I worked on the backend for this team before.' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(500)
  message?: string;
}
