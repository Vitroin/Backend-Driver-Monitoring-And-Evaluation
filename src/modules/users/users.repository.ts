import { BaseRepository } from '@common/repositories';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from './user.model';
import { Model, Types } from 'mongoose';
import { UserRole, UserStatus } from '@common/enums';

@Injectable()
export class UsersRepository extends BaseRepository<User> {
  constructor(@InjectModel(User.name) private readonly userModel: Model<User>) {
    super(userModel);
  }

  override create(data: Partial<User>): Promise<UserDocument> {
    return new this.userModel(data).save();
  }

  deactivateUser(userId: string) {
    return this.updateOne(
      { _id: userId, role: { $ne: UserRole.SUPER_ADMIN } },
      { status: UserStatus.INACTIVE, securityStamp: new Types.ObjectId() },
    );
  }

  reactivateUser(userId: string) {
    return this.updateOne({ _id: userId, status: UserStatus.INACTIVE }, { status: UserStatus.ACTIVE });
  }
}
