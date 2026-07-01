import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TimetableService } from './timetable.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchId, CurrentUser, Permissions } from '../../common/decorators/auth.decorators';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createTimetableSlotSchema,
  listTimetableQuerySchema,
  updateTimetableSlotSchema,
} from '@eims/shared';
import type { AuthUser } from '@eims/types';
import type {
  CreateTimetableSlotInput,
  ListTimetableQuery,
  UpdateTimetableSlotInput,
} from '@eims/shared';

@ApiTags('timetable')
@ApiBearerAuth()
@Controller('timetable')
@UseGuards(AuthGuard, BranchGuard, PermissionsGuard)
export class TimetableController {
  constructor(private readonly timetableService: TimetableService) {}

  @Get()
  @Permissions('timetable.read')
  findAll(
    @Query(createZodPipe(listTimetableQuerySchema)) query: ListTimetableQuery,
    @BranchId() branchId: string | null,
  ) {
    return this.timetableService.findAll(query, branchId);
  }

  @Get('conflicts')
  @Permissions('timetable.read')
  conflicts(
    @Query(createZodPipe(listTimetableQuerySchema)) query: ListTimetableQuery,
    @BranchId() branchId: string | null,
  ) {
    return this.timetableService.getConflicts(query, branchId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions('timetable.manage')
  create(
    @Body(createZodPipe(createTimetableSlotSchema)) body: CreateTimetableSlotInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.timetableService.create(body, user);
  }

  @Patch(':id')
  @Permissions('timetable.manage')
  update(
    @Param('id') id: string,
    @Body(createZodPipe(updateTimetableSlotSchema)) body: UpdateTimetableSlotInput,
    @CurrentUser() user: AuthUser,
    @BranchId() branchId: string | null,
  ) {
    return this.timetableService.update(id, body, user, branchId);
  }

  @Delete(':id')
  @Permissions('timetable.manage')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchId() branchId: string | null,
  ) {
    return this.timetableService.remove(id, user, branchId);
  }
}
