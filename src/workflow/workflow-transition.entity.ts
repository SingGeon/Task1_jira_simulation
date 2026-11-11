import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { Project } from '../projects/project.entity';
import { WorkflowStatus } from './workflow-status.entity';

/** Allowed move from one status to another (directed edge of the workflow graph). */
@Entity('workflow_transitions')
@Unique(['fromStatusId', 'toStatusId'])
export class WorkflowTransition extends BaseEntity {
  @Column('uuid')
  projectId: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn()
  project: Project;

  @Column('uuid')
  fromStatusId: string;

  @ManyToOne(() => WorkflowStatus, { onDelete: 'CASCADE' })
  @JoinColumn()
  fromStatus: WorkflowStatus;

  @Column('uuid')
  toStatusId: string;

  @ManyToOne(() => WorkflowStatus, { onDelete: 'CASCADE' })
  @JoinColumn()
  toStatus: WorkflowStatus;
}
