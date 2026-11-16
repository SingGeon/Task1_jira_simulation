import { ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { APP_CONFIG, AppConfig } from '../config/configuration';
import { UsersService } from '../users/users.service';
import { SystemRole, User } from '../users/user.entity';
import { LoginDto, RegisterDto } from './dto/auth.dto';

export interface AuthResponse {
  accessToken: string;
  user: User;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    if (!this.config.registrationEnabled) {
      throw new ForbiddenException('Self-registration is disabled. Ask an administrator for an account.');
    }
    // Lowest access: plain USER, no project memberships.
    const user = await this.users.create({ ...dto, systemRole: SystemRole.USER });
    return this.issue(user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const found = await this.users.findByEmailWithPassword(dto.email);
    // Same message for unknown e-mail and wrong password (no user enumeration).
    if (!found || !(await bcrypt.compare(dto.password, found.passwordHash))) {
      throw new UnauthorizedException('Invalid e-mail or password');
    }
    if (!found.isActive) throw new UnauthorizedException('Account is deactivated');
    return this.issue(await this.users.findById(found.id));
  }

  private async issue(user: User): Promise<AuthResponse> {
    const accessToken = await this.jwt.signAsync({ sub: user.id });
    return { accessToken, user };
  }
}
