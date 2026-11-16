import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessControlService } from '../access/access-control.service';
import { Permission } from '../access/permission.enum';
import { TasksService } from '../tasks/tasks.service';
import { User } from '../users/user.entity';
import { Comment } from './comment.entity';
import { CommentBodyDto } from './dto/comment.dto';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment) private readonly comments: Repository<Comment>,
    private readonly tasks: TasksService,
    private readonly acl: AccessControlService,
  ) {}

  async list(user: User, taskIdOrKey: string) {
    const { task } = await this.tasks.load(user, taskIdOrKey);
    return this.comments.find({ where: { taskId: task.id }, relations: { author: true }, order: { createdAt: 'ASC' } });
  }

  async create(user: User, taskIdOrKey: string, dto: CommentBodyDto) {
    const { task, access } = await this.tasks.load(user, taskIdOrKey);
    access.assert(Permission.COMMENT_CREATE);
    const c = await this.comments.save(this.comments.create({ taskId: task.id, authorId: user.id, body: dto.body }));
    return this.get(c.id);
  }

  async update(user: User, commentId: string, dto: CommentBodyDto) {
    const c = await this.authorize(user, commentId);
    await this.comments.update(c.id, { body: dto.body });
    return this.get(c.id);
  }

  async remove(user: User, commentId: string) {
    const c = await this.authorize(user, commentId);
    await this.comments.delete(c.id);
  }

  /** Authors may edit/delete their own comments; others need 'comment.manage'. */
  private async authorize(user: User, commentId: string): Promise<Comment> {
    const c = await this.comments.findOne({ where: { id: commentId }, relations: { task: true } });
    if (!c) throw new NotFoundException('Comment not found');
    const access = await this.acl.forProject(user, c.task.projectId);
    if (c.authorId !== user.id && !access.can(Permission.COMMENT_MANAGE)) {
      throw new ForbiddenException("Only the author or a role with 'comment.manage' can change this comment");
    }
    return c;
  }

  private get(id: string) {
    return this.comments.findOneOrFail({ where: { id }, relations: { author: true } });
  }
}
