import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConfigNames } from '@config';
import { getFetch } from './helpers';
import { fastapiEndpoints } from '@common/constant/fastApi';

@Injectable()
export class FastApiService {
  private readonly baseUrl: string;
  private readonly serviceToken: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.getOrThrow<string>(ConfigNames.FASTAPI_URL);
    this.serviceToken = this.config.getOrThrow<string>(ConfigNames.SERVICE_TOKEN);
  }

  async FastApiHealthCheck() {
    const response = await getFetch(this.baseUrl, this.serviceToken, fastapiEndpoints.healthCheck, 'GET');
    if (!response.ok) throw new Error(`Failed to connect to FastAPI: ${response.status} ${response.statusText}`);

    return response.json();
  }

  async getCoachingTips() {
    const response = await getFetch(this.baseUrl, this.serviceToken, fastapiEndpoints.coachingTips, 'GET');
    if (!response.ok) throw new Error(`Failed to connect to FastAPI: ${response.status} ${response.statusText}`);

    return response.json();
  }

  async getWhatWentWell() {
    const response = await getFetch(this.baseUrl, this.serviceToken, fastapiEndpoints.whatWentWell, 'GET');
    if (!response.ok) throw new Error(`Failed to connect to FastAPI: ${response.status} ${response.statusText}`);

    return response.json();
  }

  async getWhatToImprove() {
    const response = await getFetch(this.baseUrl, this.serviceToken, fastapiEndpoints.whatToImprove, 'GET');
    if (!response.ok) throw new Error(`Failed to connect to FastAPI: ${response.status} ${response.statusText}`);

    return response.json();
  }

  async getrecommendations() {
    const response = await getFetch(this.baseUrl, this.serviceToken, fastapiEndpoints.recommendations, 'GET');
    if (!response.ok) throw new Error(`Failed to connect to FastAPI: ${response.status} ${response.statusText}`);

    return response.json();
  }
}
