import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectMember } from '../projects/project-member.entity';
import { ProjectsModule } from '../projects/projects.module';
import { RolesModule } from '../roles/roles.module';
import { UsersModule } from '../users/users.module';
import { ProjectInvite } from './invite.entity';
import { InvitesService } from './invites.service';
import { InvitesController } from './invites.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ProjectInvite, ProjectMember]), ProjectsModule, RolesModule, UsersModule],
  providers: [InvitesService],
  controllers: [InvitesController],
})
export class InvitesModule {}
