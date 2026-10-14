// auth/decorators/allowed-roles.decorator.ts
import { UserRole } from '@common/enums';
import { Reflector } from '@nestjs/core';

export const AllowedRoles = Reflector.createDecorator<UserRole[]>();
