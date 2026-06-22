import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should expose the backend overview', () => {
      const overview = appController.getOverview();

      expect(overview.name).toBe('Deliverse Backend');
      expect(overview.status).toBe('ok');
      expect(overview.modules).toContain('business-orders');
    });
  });
});
