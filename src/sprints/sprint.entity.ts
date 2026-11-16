import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { Project } from '../projects/project.entity';

export enum SprintState {
  PLANNED = 'PLANNED',
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED',
}

@Entity('sprints')
// At most one ACTIVE sprint per project, enforced by the database.
@Index('uq_sprint_one_active_per_project', ['projectId'], { unique: true, where: `"state" = 'ACTIVE'` })
export class Sprint extends BaseEntity {
  @Column('uuid')
  projectId: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn()
  project: Project;

  @Column({ length: 80 })
  name: string;

  @Column({ type: 'text', default: '' })
  goal: string;

  @Column({ type: 'enum', enum: SprintState, default: SprintState.PLANNED })
  state: SprintState;

  @Column({ type: 'timestamptz', nullable: true })
  startDate: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  endDate: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;
}
