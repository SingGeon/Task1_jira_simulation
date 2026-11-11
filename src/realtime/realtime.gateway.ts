import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AccessControlService } from '../access/access-control.service';
import { UsersService } from '../users/users.service';

interface JwtPayload {
  sub: string;
}

/**
 * Pushes "something changed" pings to everyone looking at a project, so
 * boards/backlogs/sprints refresh live instead of needing a manual reload.
 * Clients authenticate with the same JWT used for the REST API and join a
 * `project:<id>` room after we've verified they actually have access to it.
 */
@WebSocketGateway({ cors: true })
export class RealtimeGateway implements OnGatewayConnection {
  @WebSocketServer() private server: Server;
  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly users: UsersService,
    private readonly acl: AccessControlService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) throw new Error('missing token');
      const payload = await this.jwt.verifyAsync<JwtPayload>(token);
      const user = await this.users.findById(payload.sub);
      if (!user.isActive) throw new Error('inactive account');
      client.data.userId = user.id;
    } catch (err) {
      this.logger.debug(`Rejected socket connection: ${(err as Error).message}`);
      client.disconnect(true);
    }
  }

  @SubscribeMessage('join')
  async onJoin(@ConnectedSocket() client: Socket, @MessageBody() body: { projectId?: string }) {
    const userId = client.data.userId as string | undefined;
    if (!userId || !body?.projectId) return;
    try {
      const user = await this.users.findById(userId);
      await this.acl.forProject(user, body.projectId); // throws if the user has no access
      await client.join(`project:${body.projectId}`);
    } catch {
      /* no access: simply don't join the room */
    }
  }

  @SubscribeMessage('leave')
  onLeave(@ConnectedSocket() client: Socket, @MessageBody() body: { projectId?: string }) {
    if (body?.projectId) client.leave(`project:${body.projectId}`);
  }

  /** Tell everyone watching this project that they should refetch. */
  broadcast(projectId: string) {
    this.server?.to(`project:${projectId}`).emit('changed');
  }
}
