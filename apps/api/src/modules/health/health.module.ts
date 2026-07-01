import { Controller, Get, Module } from '@nestjs/common';
import { Public } from '../../common/decorators/auth.decorators';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
