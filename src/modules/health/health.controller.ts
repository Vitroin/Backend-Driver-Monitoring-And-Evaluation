import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, HealthIndicatorService, MongooseHealthIndicator } from '@nestjs/terminus';
import { Public } from '@common';
import { CacheService } from '@infrastructure/cache';
import { FastApiService } from '@modules/fast-api/fast-api.service';

const CHECK_TIMEOUT_MS = 1500;

// For load balancers, container orchestrators and uptime monitors. 200 when healthy, 503 when not.
@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly mongoose: MongooseHealthIndicator,
    private readonly indicators: HealthIndicatorService,
    private readonly cacheService: CacheService,
    private readonly fastApiService: FastApiService,
  ) {}

  @ApiOperation({ summary: 'Whether the API can serve requests: MongoDB and Redis answer' })
  @ApiResponse({ status: 200, description: 'Healthy' })
  @ApiResponse({ status: 503, description: 'MongoDB or Redis is down' })
  @HealthCheck()
  @Get()
  check() {
    return this.health.check([
      () => this.mongoose.pingCheck('mongodb').withTimeout(CHECK_TIMEOUT_MS),
      () =>
        this.indicators
          .check('redis')
          .attempt(async () => {
            await this.cacheService.set({ key: 'health:ping', value: true, ttl: 10 });
            if ((await this.cacheService.get<boolean>('health:ping')) !== true) throw new Error('Redis did not return the value it was given');
          })
          .withTimeout(CHECK_TIMEOUT_MS),
    ]);
  }

  // Separate from the main check: the coaching service being down makes coaching unavailable, not the whole API
  @ApiOperation({ summary: 'Whether the FastAPI coaching service answers' })
  @ApiResponse({ status: 200, description: 'Healthy' })
  @ApiResponse({ status: 503, description: 'The coaching service is down' })
  @HealthCheck()
  @Get('coaching')
  checkCoaching() {
    return this.health.check([
      () =>
        this.indicators
          .check('fastapi')
          .attempt(async () => {
            await this.fastApiService.ping();
          })
          .withTimeout(CHECK_TIMEOUT_MS * 2),
    ]);
  }
}
