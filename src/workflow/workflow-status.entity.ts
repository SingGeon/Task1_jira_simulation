import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { Project } from '../projects/project.entity';

/** Category groups statuses the way Jira does (drives "done" logic, sprint completion). */
export enum StatusCategory {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
}

/** A column on the board. Each project owns its own workflow. */
@Entity('workflow_statuses')
@Unique(['projectId', 'key'])
export class WorkflowStatus extends BaseEntity {
  @Column('uuid')
  projectId: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn()
  project: Project;

  /** Stable identifier referenced by role grants, e.g. "IN_QA". */
  @Column({ length: 40 })
  key: string;

  @Column({ length: 60 })
  name: string;

  @Column({ type: 'enum', enum: StatusCategory })
  category: StatusCategory;

  /** Board column order; the lowest position is the initial status of new tasks. */
  @Column({ type: 'int' })
  position: number;
}
