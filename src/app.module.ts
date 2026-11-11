import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessModule } from './access/access.module';
import { ActivityModule } from './activity/activity.module';
import { AuthModule } from './auth/auth.module';
import { SeedService } from './bootstrap/seed.service';
import { CommentsModule } from './comments/comments.module';
import { AdminGuard } from './common/guards/admin.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { ConfigModule } from './config/config.module';
import { APP_CONFIG, AppConfig } from './config/configuration';
import { buildDataSourceOptions } from './database/data-source-options';
import { InvitesModule } from './invites/invites.module';
import { JoinRequestsModule } from './join-requests/join-requests.module';
import { ProjectsModule } from './projects/projects.module';
import { RealtimeModule } from './realtime/realtime.module';
import { Role } from './roles/role.entity';
import { RolesModule } from './roles/roles.module';
import { SprintsModule } from './sprints/sprints.module';
import { TasksModule } from './tasks/tasks.module';
import { User } from './users/user.entity';
import { UsersModule } from './users/users.module';
import { WorkflowModule } from './workflow/workflow.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => buildDataSourceOptions(config.db),
    }),
    TypeOrmModule.forFeature([Role, User]),
    AccessModule,
    RealtimeModule,
    AuthModule,
    UsersModule,
    RolesModule,
    ProjectsModule,
    JoinRequestsModule,
    InvitesModule,
    WorkflowModule,
    SprintsModule,
    TasksModule,
    CommentsModule,
    ActivityModule,
  ],
  providers: [
    SeedService,
    // Order matters: authenticate first, then check admin-only routes.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: AdminGuard },
  ],
})
export class AppModule {}
