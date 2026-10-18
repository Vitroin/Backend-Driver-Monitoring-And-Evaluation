import { Test, TestingModule } from '@nestjs/testing';
import { FastApiService } from './fast-api.service';

describe('FastApiService', () => {
  let service: FastApiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FastApiService],
    }).compile();

    service = module.get<FastApiService>(FastApiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
