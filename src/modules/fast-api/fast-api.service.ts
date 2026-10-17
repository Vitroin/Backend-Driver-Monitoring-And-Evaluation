import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConfigNames } from '@config';

@Injectable()
export class FastApiService {
  private readonly baseUrl: string;
  private readonly serviceToken: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.getOrThrow<string>(ConfigNames.FASTAPI_URL);
    this.serviceToken = this.config.getOrThrow<string>(ConfigNames.SERVICE_TOKEN);
  }

  async FastApiHealthCheck() {

    const response = await fetch(`${this.baseUrl}/health/health-check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Token': this.serviceToken,
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      throw new Error(`Failed to connect to FastAPI: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getCoachingTips(){
    const response = await fetch(`${this.baseUrl}/coach/coachingTips`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Token': this.serviceToken,
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to connect to FastAPI: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getWhatWentWell(){
    const response = await fetch(`${this.baseUrl}/coach/whatWentWell`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Token': this.serviceToken,
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to connect to FastAPI: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getWhatToImprove(){
    const response = await fetch(`${this.baseUrl}/coach/whatToImprove`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Token': this.serviceToken,
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to connect to FastAPI: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }
  
  async getrecommendations(){
    const response = await fetch(`${this.baseUrl}/coach/recommendations`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Token': this.serviceToken,
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to connect to FastAPI: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }
}
