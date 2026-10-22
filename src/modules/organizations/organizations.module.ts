import { Module } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { OrganizationsController } from './organizations.controller';
import { Organization, OrganizationSchema } from './organization.model';
import { MongooseModule } from '@nestjs/mongoose';
import { OrganizationsRepository } from './organization.repository';
import { OrganizationsFactory } from './organization.factory';
import { UsersModule } from '@modules/users/users.module';
import { TransactionsModule } from '@shared/modules/transactions/transactions.module';
import { AuthModule } from '@modules/auth/auth.module';

@Module({
  imports: [MongooseModule.forFeature([{ name: Organization.name, schema: OrganizationSchema }]), UsersModule, TransactionsModule, AuthModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrganizationsRepository, OrganizationsFactory],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
