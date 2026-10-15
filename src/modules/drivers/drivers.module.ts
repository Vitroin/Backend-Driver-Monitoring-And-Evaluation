import { Module } from '@nestjs/common';
import { DriversRepository } from './driver.repository';
import { DriversController } from './drivers.controller';
import { DriversService } from './drivers.service';
import { UsersModule } from '@modules/users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [DriversController],
  providers: [DriversService, DriversRepository],
})
export class DriversModule {}
