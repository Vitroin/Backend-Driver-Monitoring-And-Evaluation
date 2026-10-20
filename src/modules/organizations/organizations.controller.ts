import { Controller, Get } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { Public } from '@common';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Public()
  @Get('/getAllOrganizations')
  async getAllOrganizations() {
    return await this.organizationsService.findAllOrganizations();
  }

}
