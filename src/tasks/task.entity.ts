import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { Project } from '../projects/project.entity';
import { User } from '../users/user.entity';
import { WorkflowStatus } from '../workflow/workflow-status.entity';
import { Sprint } from '../sprints/sprint.entity';

export enum TaskType {
  STORY = 'STORY',
  TASK = 'TASK',
  BUG = 'BUG',
}

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

@Entity('tasks')
export class Task extends BaseEntity {
  @Column('uuid')
  projectId: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn()
  project: Project;

  /** Human friendly key, e.g. "WEB-42". */
  @Index({ unique: true })
  @Column({ length: 24 })
  key: string;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({ type: 'enum', enum: TaskType, default: TaskType.TASK })
  type: TaskType;

  @Column({ type: 'enum', enum: TaskPriority, default: TaskPriority.MEDIUM })
  priority: TaskPriority;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  labels: string[];

  @Column({ type: 'int', nullable: true })
  storyPoints: number | null;

  @Index()
  @Column('uuid')
  statusId: string;

  @ManyToOne(() => WorkflowStatus, { onDelete: 'RESTRICT' })
  @JoinColumn()
  status: WorkflowStatus;

  @Index()
  @Column('uuid', { nullable: true })
  assigneeId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn()
  assignee: User | null;

  @Column('uuid')
  reporterId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn()
  reporter: User;

  /** null = task sits in the backlog. */
  @Index()
  @Column('uuid', { nullable: true })
  sprintId: string | null;

  @ManyToOne(() => Sprint, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn()
  sprint: Sprint | null;
}
