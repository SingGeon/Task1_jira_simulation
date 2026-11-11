import { ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { APP_CONFIG, AppConfig } from '../config/configuration';
import { UsersService } from '../users/users.service';
import { SystemRole, User } from '../users/user.entity';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { RefreshToken } from './refresh-token.entity';

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface SessionView {
  id: string;
  userAgent: string | null;
  createdAt: Date;
  expiresAt: Date;
}

const DURATION_RE = /^(\d+)\s*(ms|s|m|h|d|w)$/i;
const UNIT_MS: Record<string, number> = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 };

/** Parses the same shorthand durations jsonwebtoken accepts ("15m", "30d", ...) into milliseconds. */
function parseDurationMs(input: string): number {
  const match = DURATION_RE.exec(input.trim());
  if (!match) throw new Error(`Invalid duration: "${input}"`);
  return Number(match[1]) * UNIT_MS[match[2].toLowerCase()];
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @InjectRepository(RefreshToken) private readonly refreshTokens: Repository<RefreshToken>,
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto, userAgent?: string): Promise<AuthResponse> {
    if (!this.config.registrationEnabled) {
      throw new ForbiddenException('Self-registration is disabled. Ask an administrator for an account.');
    }
    // Lowest access: plain USER, no project memberships.
    const user = await this.users.create({ ...dto, systemRole: SystemRole.USER });
    return this.issuePair(user, userAgent);
  }

  async login(dto: LoginDto, userAgent?: string): Promise<AuthResponse> {
    const found = await this.users.findByEmailWithPassword(dto.email);
    // Same message for unknown e-mail and wrong password (no user enumeration).
    if (!found || !(await bcrypt.compare(dto.password, found.passwordHash))) {
      throw new UnauthorizedException('Invalid e-mail or password');
    }
    if (!found.isActive) throw new UnauthorizedException('Account is deactivated');
    return this.issuePair(await this.users.findById(found.id), userAgent);
  }

  /**
   * Rotates the refresh token: the presented one is revoked and a brand new pair is issued.
   * If the presented token was already revoked (i.e. reused), that's a signal it may have
   * leaked — every session for that user is revoked so a genuine login is required again.
   */
  async refresh(rawToken: string, userAgent?: string): Promise<AuthResponse> {
    const row = await this.refreshTokens.findOne({ where: { tokenHash: this.hash(rawToken) } });
    if (!row) throw new UnauthorizedException('Invalid refresh token');
    if (row.revokedAt) {
      await this.refreshTokens.update({ userId: row.userId, revokedAt: IsNull() }, { revokedAt: new Date() });
      throw new UnauthorizedException('This session was revoked; please log in again');
    }
    if (row.expiresAt < new Date()) throw new UnauthorizedException('Refresh token expired');

    await this.refreshTokens.update(row.id, { revokedAt: new Date() });
    const user = await this.users.findById(row.userId);
    if (!user.isActive) throw new UnauthorizedException('Account is inactive or no longer exists');
    return this.issuePair(user, userAgent);
  }

  /** Revokes one session. Always succeeds (no error on an unknown/already-revoked token) to avoid leaking which tokens exist. */
  async logout(rawToken: string): Promise<void> {
    await this.refreshTokens.update({ tokenHash: this.hash(rawToken), revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  async logoutAll(user: User): Promise<void> {
    await this.refreshTokens.update({ userId: user.id, revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  async listSessions(user: User): Promise<SessionView[]> {
    const rows = await this.refreshTokens.find({
      where: { userId: user.id, revokedAt: IsNull(), expiresAt: MoreThan(new Date()) },
      order: { createdAt: 'DESC' },
    });
    return rows.map((r) => ({ id: r.id, userAgent: r.userAgent, createdAt: r.createdAt, expiresAt: r.expiresAt }));
  }

  async revokeSession(user: User, id: string): Promise<void> {
    const row = await this.refreshTokens.findOne({ where: { id, userId: user.id } });
    if (!row) return; // not yours (or gone) — no-op, same as an already-revoked session
    await this.refreshTokens.update(row.id, { revokedAt: new Date() });
  }

  private async issuePair(user: User, userAgent?: string): Promise<AuthResponse> {
    const accessToken = await this.jwt.signAsync({ sub: user.id });
    const refreshToken = await this.createRefreshToken(user.id, userAgent);
    return { accessToken, refreshToken, user };
  }

  private async createRefreshToken(userId: string, userAgent?: string): Promise<string> {
    const raw = randomBytes(32).toString('base64url');
    await this.refreshTokens.save(
      this.refreshTokens.create({
        userId,
        tokenHash: this.hash(raw),
        userAgent: userAgent?.slice(0, 300) ?? null,
        expiresAt: new Date(Date.now() + parseDurationMs(this.config.jwt.refreshExpiresIn)),
        revokedAt: null,
        createdAt: new Date(),
      }),
    );
    return raw;
  }

  private hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }
}
