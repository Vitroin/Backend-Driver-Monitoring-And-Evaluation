import { Module } from '@nestjs/common';
import { SupervisionService } from './supervision.service';
import { SupervisionController } from './supervision.controller';
import { OrganizationsModule } from '@modules/organizations/organizations.module';
import { UsersModule } from '@modules/users/users.module';
import { SupervisionRepository } from './supervision.repository';
import { MongooseModule } from '@nestjs/mongoose';
import { Supervision, SupervisionSchema } from './supervision.model';

@Module({
  imports: [MongooseModule.forFeature([{name: Supervision.name, schema: SupervisionSchema}]),UsersModule, OrganizationsModule],
  controllers: [SupervisionController],
  providers: [SupervisionService, SupervisionRepository],

})
export class SupervisionModule {}
