import { BaseRepository } from '@common/repositories';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Consent, ConsentDocument } from './consent.model';

// A consent with its organization's name loaded (null if the organization was deleted)
export type ConsentWithOrganization = Omit<ConsentDocument, 'organization'> & {
  organization: { _id: Types.ObjectId; name: string } | null;
};

@Injectable()
export class ConsentsRepository extends BaseRepository<Consent> {
  constructor(@InjectModel(Consent.name) private readonly consentModel: Model<Consent>) {
    super(consentModel);
  }

  // The driver's consents, newest first, revoked ones included
  async findForDriver(driverId: Types.ObjectId): Promise<ConsentWithOrganization[]> {
    return this.consentModel
      .find({ driver: driverId })
      .sort({ grantedAt: -1 })
      .populate<Pick<ConsentWithOrganization, 'organization'>>('organization', 'name')
      .exec();
  }

  async findByIdWithOrganization(id: Types.ObjectId): Promise<ConsentWithOrganization | null> {
    return this.consentModel.findById(id).populate<Pick<ConsentWithOrganization, 'organization'>>('organization', 'name').exec();
  }

  async findActive(driverId: Types.ObjectId, organizationId: Types.ObjectId): Promise<ConsentDocument | null> {
    return this.consentModel.findOne({ driver: driverId, organization: organizationId, revokedAt: null }).exec();
  }
}