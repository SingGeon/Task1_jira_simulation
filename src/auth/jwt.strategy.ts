import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { APP_CONFIG, AppConfig } from '../config/configuration';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';

interface JwtPayload {
  sub: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(APP_CONFIG) config: AppConfig,
    private readonly users: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.jwt.secret,
    });
  }

  /**
   * The user is reloaded on every request so that deactivation or
   * system-role changes take effect immediately (token holds only the id).
   */
  async validate(payload: JwtPayload): Promise<User> {
    const user = await this.users.findById(payload.sub).catch(() => null);
    if (!user || !user.isActive) throw new UnauthorizedException('Account is inactive or no longer exists');
    return user;
  }
}
