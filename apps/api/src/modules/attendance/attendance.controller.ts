import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchId, CurrentUser, Permissions } from '../../common/decorators/auth.decorators';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import {
  attendanceSheetQuerySchema,
  attendanceGridQuerySchema,
  bulkAttendanceSchema,
  attendanceHistoryQuerySchema,
  staffAttendanceSheetQuerySchema,
  bulkStaffAttendanceSchema,
} from '@eims/shared';
import type { AuthUser } from '@eims/types';
import type {
  AttendanceSheetQuery,
  AttendanceGridQuery,
  BulkAttendanceInput,
  AttendanceHistoryQuery,
  StaffAttendanceSheetQuery,
  BulkStaffAttendanceInput,
} from '@eims/shared';

@ApiTags('attendance')
@ApiBearerAuth()
@Controller('attendance')
@UseGuards(AuthGuard, BranchGuard, PermissionsGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get('stats')
  @Permissions('attendance.read')
  getStats(@BranchId() branchId: string | null) {
    return this.attendanceService.getStats(branchId);
  }

  @Get('trend')
  @Permissions('attendance.read')
  getTrend(
    @Query('month') month: string,
    @BranchId() branchId: string | null,
  ) {
    const effectiveMonth = month ?? new Date().toISOString().slice(0, 7);
    return this.attendanceService.getTrend(branchId, effectiveMonth);
  }

  @Get('sheet')
  @Permissions('attendance.read')
  getSheet(
    @Query(createZodPipe(attendanceSheetQuerySchema)) query: AttendanceSheetQuery,
    @BranchId() branchId: string | null,
  ) {
    return this.attendanceService.getSheet(query, branchId);
  }

  @Get('grid')
  @Permissions('attendance.read')
  getGrid(
    @Query(createZodPipe(attendanceGridQuerySchema)) query: AttendanceGridQuery,
    @BranchId() branchId: string | null,
  ) {
    return this.attendanceService.getGrid(query, branchId);
  }

  @Get('history')
  @Permissions('attendance.read')
  getHistory(
    @Query(createZodPipe(attendanceHistoryQuerySchema)) query: AttendanceHistoryQuery,
    @BranchId() branchId: string | null,
  ) {
    return this.attendanceService.getHistory(query, branchId);
  }

  @Post('bulk')
  @HttpCode(HttpStatus.OK)
  @Permissions('attendance.mark')
  bulkMark(
    @Body(createZodPipe(bulkAttendanceSchema)) body: BulkAttendanceInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.attendanceService.bulkMark(body, user);
  }

  @Get('staff-sheet')
  @Permissions('attendance.read')
  getStaffSheet(
    @Query(createZodPipe(staffAttendanceSheetQuerySchema)) query: StaffAttendanceSheetQuery,
    @BranchId() branchId: string | null,
  ) {
    return this.attendanceService.getStaffSheet(query, branchId);
  }

  @Post('staff-bulk')
  @HttpCode(HttpStatus.OK)
  @Permissions('attendance.mark')
  bulkMarkStaff(
    @Body(createZodPipe(bulkStaffAttendanceSchema)) body: BulkStaffAttendanceInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.attendanceService.bulkMarkStaff(body, user);
  }
}
