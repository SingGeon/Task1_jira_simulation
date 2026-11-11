import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Task } from '../tasks/task.entity';
import { User } from '../users/user.entity';

/**
 * One row per changed field, e.g. {field: 'status', fromValue: 'To Do', toValue: 'In Progress'}.
 * Several fields changed in the same request share one `createdAt` so the frontend can group
 * them under a single "actor · when" entry, like Jira's History tab.
 */
@Entity('task_activities')
export class TaskActivity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  taskId: string;

  @ManyToOne(() => Task, { onDelete: 'CASCADE' })
  @JoinColumn()
  task: Task;

  @Index()
  @Column('uuid')
  actorId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn()
  actor: User;

  /** Snapshot of the actor's name — stays readable even if the account is later renamed. */
  @Column({ length: 120 })
  actorName: string;

  /** Internal field key ('status', 'assignee', 'title', ...); the frontend maps this to a label. */
  @Column({ length: 40 })
  field: string;

  @Column({ type: 'text', nullable: true })
  fromValue: string | null;

  @Column({ type: 'text', nullable: true })
  toValue: string | null;

  @Index()
  @Column({ type: 'timestamptz' })
  createdAt: Date;
}
