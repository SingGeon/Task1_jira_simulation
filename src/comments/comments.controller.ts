import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { CommentsService } from './comments.service';
import { CommentBodyDto } from './dto/comment.dto';

@ApiTags('comments')
@ApiBearerAuth()
@Controller()
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get('tasks/:idOrKey/comments')
  list(@CurrentUser() user: User, @Param('idOrKey') idOrKey: string) {
    return this.comments.list(user, idOrKey);
  }

  @Post('tasks/:idOrKey/comments')
  create(@CurrentUser() user: User, @Param('idOrKey') idOrKey: string, @Body() dto: CommentBodyDto) {
    return this.comments.create(user, idOrKey, dto);
  }

  @Patch('comments/:id')
  update(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CommentBodyDto) {
    return this.comments.update(user, id, dto);
  }

  @Delete('comments/:id')
  @HttpCode(204)
  remove(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.comments.remove(user, id);
  }
}
