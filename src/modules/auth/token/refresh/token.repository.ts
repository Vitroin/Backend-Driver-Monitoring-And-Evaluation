import { BaseRepository } from '@common/repositories';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RefreshToken, RefreshTokenDocument } from './token.model';

@Injectable()
export class TokenRepository extends BaseRepository<RefreshToken> {
  constructor(@InjectModel(RefreshToken.name) model: Model<RefreshToken>) {
    super(model);
  }

  /** Creates the session document, using the sid as its _id. */
  async createSession(data: {
    sid: string;
    userId: string;
    securityStamp: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.model.create({
      ...data,
      _id: data.sid,
      userId: new Types.ObjectId(data.userId),
      securityStamp: new Types.ObjectId(data.securityStamp),
    });
  }
  findByTokenHash(tokenHash: string): Promise<RefreshTokenDocument | null> {
    return this.model.findOne({ tokenHash }).exec();
  }

  /**
   * Swaps the session's token hash, but only if it still holds `currentHash`. The conditional update is atomic,
   * so when the same refresh token is presented twice concurrently, only one caller gets `true`.
   */
  async rotate(id: string, currentHash: string, update: { tokenHash: string; expiresAt: Date }): Promise<boolean> {
    const result = await this.model.updateOne({ _id: id, tokenHash: currentHash }, update).exec();
    return result.modifiedCount > 0;
  }

  async deleteAllForUser(userId: string): Promise<void> {
    await this.model.deleteMany({ userId: new Types.ObjectId(userId) }).exec();
  }

  async deleteExpiredForUser(userId: string): Promise<void> {
    await this.model.deleteMany({ userId: new Types.ObjectId(userId), expiresAt: { $lt: new Date() } }).exec();
  }

  /** @returns How many documents were deleted. */
  async deleteExpired(): Promise<number> {
    const result = await this.model.deleteMany({ expiresAt: { $lt: new Date() } }).exec();
    return result.deletedCount;
  }
}
