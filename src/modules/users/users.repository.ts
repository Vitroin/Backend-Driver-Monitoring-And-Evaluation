import { BaseRepository } from '@common/repositories';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from './user.model';
import { Model } from 'mongoose';
import type { OrganizationTypes } from '@modules/organizations/organizations.enum';

@Injectable()
export class UsersRepository extends BaseRepository<User> {
  constructor(@InjectModel(User.name) private readonly userModel: Model<User>) {
    super(userModel);
  }

  override create(data: Partial<User>): Promise<UserDocument> {
    return new this.userModel(data).save();
  }


  findWithOrganization(id: string) {
    return this.userModel
      .findById(id)
      .select('organization')
      .populate<{ organization: { id: string; name: string; organizationType: OrganizationTypes } | null }>({
        path: 'organization',
        select: 'name organizationType',
      })
      .exec();
  }
}
