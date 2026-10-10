// auth/decorators/allowed-roles.decorator.ts
import { Roles } from '@common/enums';
import { Reflector } from '@nestjs/core';

export const AllowedRoles = Reflector.createDecorator<Roles[]>();