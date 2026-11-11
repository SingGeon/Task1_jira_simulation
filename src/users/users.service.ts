import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { ILike, Repository } from 'typeorm';
import { paginate } from '../common/dto/pagination.dto';
import { SystemRole, User } from './user.entity';
import { AdminUpdateUserDto, CreateUserDto, ListUsersQueryDto, UpdateMeDto } from './dto/user.dto';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  hashPassword(password: string) {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  async create(dto: CreateUserDto): Promise<User> {
    const email = dto.email.toLowerCase();
    if (await this.users.exist({ where: { email } })) {
      throw new ConflictException('A user with this e-mail already exists');
    }
    const user = this.users.create({
      email,
      fullName: dto.fullName,
      systemRole: dto.systemRole ?? SystemRole.USER,
      passwordHash: await this.hashPassword(dto.password),
    });
    const saved = await this.users.save(user);
    return this.findById(saved.id);
  }

  async findById(id: string): Promise<User> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /** Returns the user including the password hash (only for credential checks). */
  findByEmailWithPassword(email: string) {
    return this.users
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.email = :email', { email: email.toLowerCase() })
      .getOne();
  }

  async list(q: ListUsersQueryDto) {
    const where = q.q
      ? [{ email: ILike(`%${q.q}%`) }, { fullName: ILike(`%${q.q}%`) }]
      : undefined;
    const [items, total] = await this.users.findAndCount({
      where,
      order: { fullName: 'ASC' },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    });
    return paginate(items, total, q);
  }

  async adminUpdate(actor: User, id: string, dto: AdminUpdateUserDto): Promise<User> {
    const user = await this.findById(id);
    const losesAdmin =
      user.systemRole === SystemRole.ADMIN &&
      ((dto.systemRole && dto.systemRole !== SystemRole.ADMIN) || dto.isActive === false);
    if (losesAdmin) {
      const activeAdmins = await this.users.count({
        where: { systemRole: SystemRole.ADMIN, isActive: true },
      });
      if (activeAdmins <= 1) {
        throw new BadRequestException('Cannot demote or deactivate the last active administrator');
      }
    }
    if (actor.id === id && dto.isActive === false) {
      throw new BadRequestException('You cannot deactivate yourself');
    }
    if (dto.fullName !== undefined) user.fullName = dto.fullName;
    if (dto.systemRole !== undefined) user.systemRole = dto.systemRole;
    if (dto.isActive !== undefined) user.isActive = dto.isActive;
    if (dto.password) {
      await this.users.update(id, { passwordHash: await this.hashPassword(dto.password) });
    }
    await this.users.save(user);
    return this.findById(id);
  }

  async remove(actor: User, id: string): Promise<void> {
    const user = await this.findById(id);
    if (actor.id === id) throw new BadRequestException('You cannot delete your own account');
    if (user.systemRole === SystemRole.ADMIN) {
      const activeAdmins = await this.users.count({ where: { systemRole: SystemRole.ADMIN, isActive: true } });
      if (activeAdmins <= 1) throw new BadRequestException('Cannot delete the last active administrator');
    }
    // Fails with 409 (DbExceptionFilter) if the user still has authored tasks/comments —
    // deactivate instead if you need to keep their history.
    await this.users.delete(id);
  }

  async updateMe(me: User, dto: UpdateMeDto): Promise<User> {
    if (dto.fullName !== undefined) await this.users.update(me.id, { fullName: dto.fullName });
    if (dto.newPassword) {
      const withPwd = await this.findByEmailWithPassword(me.email);
      if (!dto.currentPassword || !withPwd || !(await bcrypt.compare(dto.currentPassword, withPwd.passwordHash))) {
        throw new UnauthorizedException('Current password is incorrect');
      }
      await this.users.update(me.id, { passwordHash: await this.hashPassword(dto.newPassword) });
    }
    return this.findById(me.id);
  }
}
