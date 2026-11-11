import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class ListActivityQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Only activity for this project' })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({ description: 'Only activity performed by this user' })
  @IsOptional()
  @IsUUID()
  actorId?: string;
}
