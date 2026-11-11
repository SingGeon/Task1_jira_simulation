import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { CredentialsBase } from '../../users/dto/user.dto';

/** Self-registration never lets the caller choose a role. */
export class RegisterDto extends CredentialsBase {}

export class LoginDto {
  @ApiProperty({ example: 'admin@tracker.local' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Admin123!' })
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  refreshToken: string;
}
