import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { Task } from '../tasks/task.entity';
import { User } from '../users/user.entity';

@Entity('comments')
export class Comment extends BaseEntity {
  @Index()
  @Column('uuid')
  taskId: string;

  @ManyToOne(() => Task, { onDelete: 'CASCADE' })
  @JoinColumn()
  task: Task;

  @Column('uuid')
  authorId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn()
  author: User;

  @Column({ type: 'text' })
  body: string;
}
