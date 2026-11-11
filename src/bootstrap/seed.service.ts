import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { APP_CONFIG, AppConfig } from '../config/configuration';
import { Role } from '../roles/role.entity';
import { SYSTEM_ROLES } from '../roles/system-roles';
import { SystemRole, User } from '../users/user.entity';
import { UsersService } from '../users/users.service';

/**
 * Idempotent startup seeding:
 *  - system roles are created if missing (existing ones are never overwritten,
 *    so an admin's edits to their grants survive restarts);
 *  - the bootstrap admin is created only if there is no admin at all.
 */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly usersService: UsersService,
  ) {}

  async onApplicationBootstrap() {
    await this.seedRoles();
    await this.seedAdmin();
  }

  private async seedRoles() {
    const hasDefault = await this.roles.exist({ where: { isDefault: true } });
    for (const seed of SYSTEM_ROLES) {
      if (await this.roles.exist({ where: { name: seed.name } })) continue;
      await this.roles.save(
        this.roles.create({ ...seed, isSystem: true, isDefault: seed.isDefault && !hasDefault }),
      );
      this.logger.log(`Seeded system role '${seed.name}'`);
    }
  }

  private async seedAdmin() {
    if (await this.users.exist({ where: { systemRole: SystemRole.ADMIN } })) return;
    const { email, password, name } = this.config.admin;
    if (!email || !password) {
      this.logger.warn('No administrator exists and ADMIN_EMAIL/ADMIN_PASSWORD are not set');
      return;
    }
    await this.usersService.create({ email, password, fullName: name, systemRole: SystemRole.ADMIN });
    this.logger.log(`Created bootstrap administrator ${email}`);
  }
}
