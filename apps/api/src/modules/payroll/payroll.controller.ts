import type { BranchScope } from '@eims/shared';
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
import { BranchScopeParam, CurrentUser, Permissions } from '../../common/decorators/auth.decorators';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import {
  bulkSavePayrollLinesSchema,
  createPayrollRunSchema,
  createSalaryStructureSchema,
  exportPayrollRunQuerySchema,
  listPayrollRunsQuerySchema,
  listSalaryStructuresQuerySchema,
  markPayrollPaidSchema,
  updatePayrollLineSchema,
  updateSalaryStructureSchema,
} from '@eims/shared';
import type { AuthUser } from '@eims/types';
import type {
  BulkSavePayrollLinesInput,
  CreatePayrollRunInput,
  CreateSalaryStructureInput,
  ExportPayrollRunQuery,
  ListPayrollRunsQuery,
  ListSalaryStructuresQuery,
  MarkPayrollPaidInput,
  UpdatePayrollLineInput,
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
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.payrollService.findStructures(query, scope);
  }

  @Get('structures/:id')
  @Permissions('payroll.read')
  findStructure(@Param('id') id: string, @BranchScopeParam() scope: BranchScope) {
    return this.payrollService.findStructure(id, scope);
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
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.payrollService.updateStructure(id, body, user, scope);
  }

  @Delete('structures/:id')
  @Permissions('payroll.manage')
  removeStructure(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.payrollService.removeStructure(id, user, scope);
  }

  @Get('runs')
  @Permissions('payroll.read')
  findRuns(
    @Query(createZodPipe(listPayrollRunsQuerySchema)) query: ListPayrollRunsQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.payrollService.findRuns(query, scope);
  }

  @Post('runs/open-month')
  @Permissions('payroll.manage')
  openMonth(
    @Body(createZodPipe(createPayrollRunSchema)) body: CreatePayrollRunInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.payrollService.openMonth(body, user, scope);
  }

  @Post('runs')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('payroll.manage')
  createRun(
    @Body(createZodPipe(createPayrollRunSchema)) body: CreatePayrollRunInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.payrollService.createRun(body, user, scope);
  }

  @Get('runs/:id')
  @Permissions('payroll.read')
  findRun(@Param('id') id: string, @BranchScopeParam() scope: BranchScope) {
    return this.payrollService.findRun(id, scope);
  }

  @Get('runs/:id/print-data')
  @Permissions('payroll.read')
  getRunPrintData(@Param('id') id: string, @BranchScopeParam() scope: BranchScope) {
    return this.payrollService.getRunPrintData(id, scope);
  }

  @Post('runs/:id/generate')
  @Permissions('payroll.manage')
  generateRun(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.payrollService.generateRun(id, user, scope);
  }

  @Post('runs/:id/lines')
  @Permissions('payroll.manage')
  saveLines(
    @Param('id') id: string,
    @Body(createZodPipe(bulkSavePayrollLinesSchema)) body: BulkSavePayrollLinesInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.payrollService.saveLines(id, body, user, scope);
  }

  @Post('runs/:id/submit-approval')
  @Permissions('payroll.manage')
  submitApproval(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.payrollService.submitApproval(id, user, scope);
  }

  @Post('runs/:id/send-back')
  @Permissions('payroll.manage')
  sendBackToDraft(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.payrollService.sendBackToDraft(id, user, scope);
  }

  @Post('runs/:id/approve')
  @Permissions('payroll.approve')
  approveRun(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.payrollService.approveRun(id, user, scope);
  }

  @Post('runs/:id/finalize')
  @Permissions('payroll.approve')
  finalizeRun(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.payrollService.finalizeRun(id, user, scope);
  }

  @Post('runs/:id/mark-paid')
  @Permissions('payroll.manage')
  markPaid(
    @Param('id') id: string,
    @Body(createZodPipe(markPayrollPaidSchema)) body: MarkPayrollPaidInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.payrollService.markPaid(id, body, user, scope);
  }

  @Get('runs/:id/export')
  @Permissions('payroll.read')
  exportRun(
    @Param('id') id: string,
    @Query(createZodPipe(exportPayrollRunQuerySchema)) query: ExportPayrollRunQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.payrollService.exportRun(id, query, scope);
  }

  @Patch('lines/:id')
  @Permissions('payroll.manage')
  updateLine(
    @Param('id') id: string,
    @Body(createZodPipe(updatePayrollLineSchema)) body: UpdatePayrollLineInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.payrollService.updateLine(id, body, user, scope);
  }

  @Get('lines/:id/print-data')
  @Permissions('payroll.read')
  getLinePrintData(@Param('id') id: string, @BranchScopeParam() scope: BranchScope) {
    return this.payrollService.getLinePrintData(id, scope);
  }
}
