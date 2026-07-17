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
import { PayrollService } from './payroll.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchId, CurrentUser, Permissions } from '../../common/decorators/auth.decorators';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import {
  adjustPayrollLineSchema,
  createPayrollRunSchema,
  createSalaryStructureSchema,
  exportPayrollRunQuerySchema,
  listPayrollRunsQuerySchema,
  listSalaryStructuresQuerySchema,
  updateSalaryStructureSchema,
} from '@eims/shared';
import type { AuthUser } from '@eims/types';
import type {
  AdjustPayrollLineInput,
  CreatePayrollRunInput,
  CreateSalaryStructureInput,
  ExportPayrollRunQuery,
  ListPayrollRunsQuery,
  ListSalaryStructuresQuery,
  UpdateSalaryStructureInput,
} from '@eims/shared';

@ApiTags('payroll')
@ApiBearerAuth()
@Controller('payroll')
@UseGuards(AuthGuard, BranchGuard, PermissionsGuard)
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get('structures')
  @Permissions('payroll.read')
  findStructures(
    @Query(createZodPipe(listSalaryStructuresQuerySchema)) query: ListSalaryStructuresQuery,
    @BranchId() branchId: string | null,
  ) {
    return this.payrollService.findStructures(query, branchId);
  }

  @Get('structures/:id')
  @Permissions('payroll.read')
  findStructure(@Param('id') id: string, @BranchId() branchId: string | null) {
    return this.payrollService.findStructure(id, branchId);
  }

  @Post('structures')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('payroll.manage')
  createStructure(
    @Body(createZodPipe(createSalaryStructureSchema)) body: CreateSalaryStructureInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.payrollService.createStructure(body, user);
  }

  @Patch('structures/:id')
  @Permissions('payroll.manage')
  updateStructure(
    @Param('id') id: string,
    @Body(createZodPipe(updateSalaryStructureSchema)) body: UpdateSalaryStructureInput,
    @CurrentUser() user: AuthUser,
    @BranchId() branchId: string | null,
  ) {
    return this.payrollService.updateStructure(id, body, user, branchId);
  }

  @Delete('structures/:id')
  @Permissions('payroll.manage')
  removeStructure(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchId() branchId: string | null,
  ) {
    return this.payrollService.removeStructure(id, user, branchId);
  }

  @Get('runs')
  @Permissions('payroll.read')
  findRuns(
    @Query(createZodPipe(listPayrollRunsQuerySchema)) query: ListPayrollRunsQuery,
    @BranchId() branchId: string | null,
  ) {
    return this.payrollService.findRuns(query, branchId);
  }

  @Post('runs')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('payroll.manage')
  createRun(
    @Body(createZodPipe(createPayrollRunSchema)) body: CreatePayrollRunInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.payrollService.createRun(body, user);
  }

  @Get('runs/:id')
  @Permissions('payroll.read')
  findRun(@Param('id') id: string, @BranchId() branchId: string | null) {
    return this.payrollService.findRun(id, branchId);
  }

  @Post('runs/:id/generate')
  @Permissions('payroll.manage')
  generateRun(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchId() branchId: string | null,
  ) {
    return this.payrollService.generateRun(id, user, branchId);
  }

  @Post('runs/:id/submit-approval')
  @Permissions('payroll.manage')
  submitApproval(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchId() branchId: string | null,
  ) {
    return this.payrollService.submitApproval(id, user, branchId);
  }

  @Post('runs/:id/approve')
  @Permissions('payroll.approve')
  approveRun(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchId() branchId: string | null,
  ) {
    return this.payrollService.approveRun(id, user, branchId);
  }

  @Post('runs/:id/finalize')
  @Permissions('payroll.approve')
  finalizeRun(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchId() branchId: string | null,
  ) {
    return this.payrollService.finalizeRun(id, user, branchId);
  }

  @Get('runs/:id/export')
  @Permissions('payroll.read')
  exportRun(
    @Param('id') id: string,
    @Query(createZodPipe(exportPayrollRunQuerySchema)) query: ExportPayrollRunQuery,
    @BranchId() branchId: string | null,
  ) {
    return this.payrollService.exportRun(id, query, branchId);
  }

  @Patch('lines/:id')
  @Permissions('payroll.manage')
  adjustLine(
    @Param('id') id: string,
    @Body(createZodPipe(adjustPayrollLineSchema)) body: AdjustPayrollLineInput,
    @CurrentUser() user: AuthUser,
    @BranchId() branchId: string | null,
  ) {
    return this.payrollService.adjustLine(id, body, user, branchId);
  }

  @Get('lines/:id/print-data')
  @Permissions('payroll.read')
  getLinePrintData(@Param('id') id: string, @BranchId() branchId: string | null) {
    return this.payrollService.getLinePrintData(id, branchId);
  }
}
