import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { PermissionGrant } from '../access/permission.enum';

/**
 * Project role (Jira "project role + permission scheme" merged into one).
 * Roles are global definitions; a user gets a role *per project* via ProjectMember.
 */
@Entity('roles')
export class Role extends BaseEntity {
  @Index({ unique: true })
  @Column({ length: 60 })
  name: string;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  grants: PermissionGrant[];

  /** Seeded roles: cannot be deleted or renamed (their grants stay editable). */
  @Column({ default: false })
  isSystem: boolean;

  /** Role given when a member is added without an explicit role. Exactly one. */
  @Column({ default: false })
  isDefault: boolean;
}
