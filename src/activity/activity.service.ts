import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { paginate } from '../common/dto/pagination.dto';
import { User } from '../users/user.entity';
import { ListActivityQueryDto } from './dto/activity.dto';
import { TaskActivity } from './task-activity.entity';

export interface ActivityEntry {
  field: string;
  from: string | null;
  to: string | null;
}

/** `diff('status', 'To Do', 'In Progress')` -> one entry; returns [] if nothing actually changed. */
export function diff(field: string, from: string | null, to: string | null): ActivityEntry[] {
  return from === to ? [] : [{ field, from, to }];
}

@Injectable()
export class ActivityService {
  constructor(@InjectRepository(TaskActivity) private readonly activities: Repository<TaskActivity>) {}

  /** Records every changed field from one request as a single moment in time (same actor, same timestamp). */
  async record(taskId: string, actor: User, entries: ActivityEntry[]): Promise<void> {
    if (entries.length === 0) return;
    const at = new Date();
    await this.activities.save(
      entries.map((e) =>
        this.activities.create({
          taskId,
          actorId: actor.id,
          actorName: actor.fullName,
          field: e.field,
          fromValue: e.from,
          toValue: e.to,
          createdAt: at,
        }),
      ),
    );
  }

  listForTask(taskId: string): Promise<TaskActivity[]> {
    return this.activities.find({ where: { taskId }, order: { createdAt: 'DESC' } });
  }

  async listAll(q: ListActivityQueryDto) {
    const qb = this.activities
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.task', 'task')
      .leftJoinAndSelect('task.project', 'project');
    if (q.projectId) qb.andWhere('task.projectId = :projectId', { projectId: q.projectId });
    if (q.actorId) qb.andWhere('a.actorId = :actorId', { actorId: q.actorId });
    qb.orderBy('a.createdAt', 'DESC');
    const [items, total] = await qb.skip((q.page - 1) * q.limit).take(q.limit).getManyAndCount();
    return paginate(items, total, q);
  }
}
