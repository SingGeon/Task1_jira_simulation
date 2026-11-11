import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from '../tasks/task.entity';
import { WorkflowStatus } from './workflow-status.entity';
import { WorkflowTransition } from './workflow-transition.entity';
import { WorkflowService } from './workflow.service';
import { WorkflowController } from './workflow.controller';

@Module({
  imports: [TypeOrmModule.forFeature([WorkflowStatus, WorkflowTransition, Task])],
  providers: [WorkflowService],
  controllers: [WorkflowController],
  exports: [WorkflowService],
})
export class WorkflowModule {}
