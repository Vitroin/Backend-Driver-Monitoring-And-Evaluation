import { BadGatewayException, GatewayTimeoutException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConfigNames } from '@config';

type RequestOptions = { method?: 'GET' | 'POST'; query?: Record<string, string>; body?: unknown };

/**
 * Client for the FastAPI service (the AI coaching models). Every call is authenticated with the shared service token,
 * times out after FASTAPI_TIMEOUT_MS, and fails with 502 (unreachable or an error answer) or 504 (too slow),
 * so a problem on that side never looks like a bug in this API.
 */
@Injectable()
export class FastApiService {
  private readonly logger = new Logger(FastApiService.name);
  private readonly baseUrl: string;
  private readonly serviceToken: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    this.baseUrl = config.getOrThrow<string>(ConfigNames.FASTAPI_URL).replace(/\/+$/, '');
    this.serviceToken = config.getOrThrow<string>(ConfigNames.SERVICE_TOKEN);
    this.timeoutMs = config.getOrThrow<number>(ConfigNames.FASTAPI_TIMEOUT_MS);
  }

  ping(): Promise<unknown> {
    return this.request('/health/health-check', { method: 'POST', body: {} });
  }

  // The driver's id is sent with every coaching call, so the answers can be about that driver's driving
  getCoachingTips(driverId: string): Promise<unknown> {
    return this.request('/coach/coachingTips', { query: { driverId } });
  }

  getWhatWentWell(driverId: string): Promise<unknown> {
    return this.request('/coach/whatWentWell', { query: { driverId } });
  }

  getWhatToImprove(driverId: string): Promise<unknown> {
    return this.request('/coach/whatToImprove', { query: { driverId } });
  }

  getRecommendations(driverId: string): Promise<unknown> {
    return this.request('/coach/recommendations', { query: { driverId } });
  }

  private async request<T = unknown>(path: string, { method = 'GET', query, body }: RequestOptions = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value);

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: { 'X-Service-Token': this.serviceToken, ...(body !== undefined && { 'Content-Type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new GatewayTimeoutException('The coaching service did not answer in time');
      }
      this.logger.warn(`FastAPI ${method} ${path} failed: ${error instanceof Error ? error.message : String(error)}`);
      throw new BadGatewayException('The coaching service is unavailable');
    }

    if (!response.ok) {
      this.logger.warn(`FastAPI ${method} ${path} answered ${response.status}`);
      throw new BadGatewayException(`The coaching service failed (${response.status})`);
    }
    return (await response.json()) as T;
  }
}
