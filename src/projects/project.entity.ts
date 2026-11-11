import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { ProjectMember } from './project-member.entity';

export enum BoardType {
  SCRUM = 'SCRUM', // board shows the active sprint; work is planned in sprints
  KANBAN = 'KANBAN', // board shows every task; continuous flow, no sprints
}

@Entity('projects')
export class Project extends BaseEntity {
  /** Short uppercase key used as task prefix, e.g. "WEB" -> WEB-1, WEB-2 */
  @Index({ unique: true })
  @Column({ length: 10 })
  key: string;

  @Column({ length: 120 })
  name: string;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({ type: 'enum', enum: BoardType, default: BoardType.SCRUM })
  boardType: BoardType;

  /** Monotonic counter for task numbers (never reused, even after deletions). */
  @Column({ type: 'int', default: 0 })
  taskCounter: number;

  @OneToMany(() => ProjectMember, (m) => m.project)
  members: ProjectMember[];
}
