import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateInviteDto {
  @ApiProperty({ description: 'Account being invited' })
  @IsUUID()
  userId: string;

  @ApiProperty({ description: 'Role they will get if they accept' })
  @IsUUID()
  roleId: string;
}
