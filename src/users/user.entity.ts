import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';

/**
 * Global (system-wide) role. Deliberately tiny: only ADMIN vs USER.
 * Everything project-related is governed by project roles (see Role entity).
 */
export enum SystemRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

@Entity('users')
export class User extends BaseEntity {
  @Index({ unique: true })
  @Column({ length: 255 })
  email: string;

  @Column({ select: false })
  passwordHash: string;

  @Column({ length: 120 })
  fullName: string;

  @Column({ type: 'enum', enum: SystemRole, default: SystemRole.USER })
  systemRole: SystemRole;

  @Column({ default: true })
  isActive: boolean;
}
