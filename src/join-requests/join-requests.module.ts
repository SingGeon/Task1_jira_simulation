import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../projects/project.entity';
import { ProjectMember } from '../projects/project-member.entity';
import { ProjectsModule } from '../projects/projects.module';
import { RolesModule } from '../roles/roles.module';
import { JoinRequest } from './join-request.entity';
import { JoinRequestsService } from './join-requests.service';
import { JoinRequestsController } from './join-requests.controller';

@Module({
  imports: [TypeOrmModule.forFeature([JoinRequest, Project, ProjectMember]), ProjectsModule, RolesModule],
  providers: [JoinRequestsService],
  controllers: [JoinRequestsController],
})
export class JoinRequestsModule {}
