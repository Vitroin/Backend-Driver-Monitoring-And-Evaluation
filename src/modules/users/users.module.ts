import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './user.model';
import { UsersRepository } from './users.repository';
import { UsersFactory } from './users.factory';
import { UserRole } from '@common/enums';
import { Instructor, InstructorSchema } from '@modules/instructors/instructors.model';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: User.name,
        schema: UserSchema,
        discriminators: [{ name: Instructor.name, schema: InstructorSchema, value: UserRole.DRIVER_INSTRUCTOR }],
      },
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository, UsersFactory],
  exports: [UsersService, MongooseModule],
})
export class UsersModule {}
