import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../projects/project.entity';
import { ProjectMember } from '../projects/project-member.entity';
import { AccessControlService } from './access-control.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Project, ProjectMember])],
  providers: [AccessControlService],
  exports: [AccessControlService],
})
export class AccessModule {}
