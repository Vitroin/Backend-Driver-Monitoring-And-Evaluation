import { Injectable } from '@nestjs/common';
import type { UserDocument } from '@modules/users/user.model';

import { userResponseSchema, type UserResponseDto } from './response';

@Injectable()
export class AuthFactory {
  /** Maps a user to its public shape. Parsing strips everything not in the schema (password hash, security stamp, ...). */
  toUserResponse(user: UserDocument): UserResponseDto {
    return userResponseSchema.parse(user.toObject());
  }
}
