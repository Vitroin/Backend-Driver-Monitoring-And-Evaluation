import { Test, TestingModule } from '@nestjs/testing';
import { FastApiController } from './fast-api.controller';
import { FastApiService } from './fast-api.service';

describe('FastApiController', () => {
  let controller: FastApiController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FastApiController],
      providers: [FastApiService],
    }).compile();

    controller = module.get<FastApiController>(FastApiController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
