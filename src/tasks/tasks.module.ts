import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityModule } from '../activity/activity.module';
import { Project } from '../projects/project.entity';
import { SprintsModule } from '../sprints/sprints.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { Task } from './task.entity';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Task, Project]), WorkflowModule, SprintsModule, ActivityModule],
  providers: [TasksService],
  controllers: [TasksController],
  exports: [TasksService],
})
export class TasksModule {}
