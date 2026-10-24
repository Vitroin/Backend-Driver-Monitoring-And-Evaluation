import { applyDecorators, Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { CurrentUser } from '@common';
import type { DataResponseDto } from '@common';
import { driverIdParamSchema, type DriverIdParam } from '@modules/users/list-users.dto';
import { FastApiService } from './fast-api.service';

const driverIdParam = ApiParam({ name: 'driverId', type: String, description: 'A driver id, or `me`', example: 'me' });
const withErrors = applyDecorators(
  ApiResponse({ status: 502, description: 'The coaching service is unavailable or failed' }),
  ApiResponse({ status: 504, description: 'The coaching service did not answer in time' }),
);

// The AI coaching for one driver (`me` is the logged-in user), answered by the FastAPI service.
// The FastAPI health is part of GET /health/coaching.
@ApiBearerAuth()
@Controller('drivers/:driverId/coaching')
export class CoachingController {
  constructor(private readonly fastApiService: FastApiService) {}

  @driverIdParam
  @ApiOperation({ summary: 'Coaching tips for the driver' })
  @withErrors
  @Get('tips')
  async tips(@CurrentUser('id') userId: string, @Param({ schema: driverIdParamSchema }) { driverId }: DriverIdParam): Promise<DataResponseDto<unknown>> {
    return { message: 'Coaching tips', data: await this.fastApiService.getCoachingTips(driverId === 'me' ? userId : driverId) };
  }

  @driverIdParam
  @ApiOperation({ summary: 'What the driver should improve' })
  @withErrors
  @Get('what-to-improve')
  async whatToImprove(@CurrentUser('id') userId: string, @Param({ schema: driverIdParamSchema }) { driverId }: DriverIdParam): Promise<DataResponseDto<unknown>> {
    return { message: 'What to improve', data: await this.fastApiService.getWhatToImprove(driverId === 'me' ? userId : driverId) };
  }

  @driverIdParam
  @ApiOperation({ summary: 'What the driver did well' })
  @withErrors
  @Get('what-went-well')
  async whatWentWell(@CurrentUser('id') userId: string, @Param({ schema: driverIdParamSchema }) { driverId }: DriverIdParam): Promise<DataResponseDto<unknown>> {
    return { message: 'What went well', data: await this.fastApiService.getWhatWentWell(driverId === 'me' ? userId : driverId) };
  }

  @driverIdParam
  @ApiOperation({ summary: 'Recommendations for the driver' })
  @withErrors
  @Get('recommendations')
  async recommendations(@CurrentUser('id') userId: string, @Param({ schema: driverIdParamSchema }) { driverId }: DriverIdParam): Promise<DataResponseDto<unknown>> {
    return { message: 'Recommendations', data: await this.fastApiService.getRecommendations(driverId === 'me' ? userId : driverId) };
  }
}
