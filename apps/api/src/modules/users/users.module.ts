import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AuditModule } from '../audit/audit.module';
import { AccessModule } from '../access/access.module';

@Module({
  imports: [AuditModule, AccessModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
