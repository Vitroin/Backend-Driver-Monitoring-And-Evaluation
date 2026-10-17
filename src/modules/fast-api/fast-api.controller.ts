import { Controller, Get } from '@nestjs/common';
import { FastApiService } from './fast-api.service';
import { AllowedRoles, Public } from '@common';
import { UserRole } from '@common/enums';
import { ApiBearerAuth } from '@nestjs/swagger';

@Controller('fast-api')
export class FastApiController {
  constructor(private readonly fastApiService: FastApiService) {}
  @Public()
  @Get('health-check')
  async healthCheck() {
    return await this.fastApiService.FastApiHealthCheck();
  }
  
  @ApiBearerAuth()
  @AllowedRoles([UserRole.DRIVER])
  @Get('coachingTips')
  async coachingTips() {
    return await this.fastApiService.getCoachingTips();
  }

  @ApiBearerAuth()
  @AllowedRoles([UserRole.DRIVER])
  @Get('whatToImprove')
  async whatToImprove() {
    return await this.fastApiService.getWhatToImprove();
  }


  @ApiBearerAuth()
  @AllowedRoles([UserRole.DRIVER])
  @Get('whatWentWell')
  async whatWentWell() {
    return await this.fastApiService.getWhatWentWell();
  }

  @ApiBearerAuth()
  @AllowedRoles([UserRole.DRIVER])
  @Get('recommendations')
  async recommendations() {
    return await this.fastApiService.getrecommendations();
  }
}
