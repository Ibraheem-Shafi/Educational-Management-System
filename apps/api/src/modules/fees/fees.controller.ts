import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FeesService } from './fees.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchId, CurrentUser, Permissions } from '../../common/decorators/auth.decorators';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createFeeInvoiceSchema,
  listFeeInvoicesQuerySchema,
  recordPaymentSchema,
  createFeeStructureSchema,
  updateFeeStructureSchema,
  listFeeStructuresQuerySchema,
  generateBulkInvoicesSchema,
  createFeeTypeSchema,
  updateFeeTypeSchema,
} from '@eims/shared';
import type { AuthUser } from '@eims/types';
import type {
  CreateFeeInvoiceInput,
  ListFeeInvoicesQuery,
  RecordPaymentInput,
  CreateFeeStructureInput,
  UpdateFeeStructureInput,
  ListFeeStructuresQuery,
  GenerateBulkInvoicesInput,
  CreateFeeTypeInput,
  UpdateFeeTypeInput,
} from '@eims/shared';

@ApiTags('fees')
@ApiBearerAuth()
@Controller()
@UseGuards(AuthGuard, BranchGuard, PermissionsGuard)
export class FeesController {
  constructor(private readonly feesService: FeesService) {}

  @Get('fees/stats')
  @Permissions('fees.read')
  getStats(@BranchId() branchId: string | null) {
    return this.feesService.getStats(branchId);
  }

  @Get('fees/revenue-trend')
  @Permissions('fees.read')
  getRevenueTrend(@BranchId() branchId: string | null) {
    return this.feesService.getRevenueTrend(branchId);
  }

  @Get('fee-types')
  @Permissions('fees.read')
  listTypes() {
    return this.feesService.listTypes();
  }

  @Post('fee-types')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('fees.collect')
  createFeeType(
    @Body(createZodPipe(createFeeTypeSchema)) body: CreateFeeTypeInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.feesService.createFeeType(body, user);
  }

  @Patch('fee-types/:id')
  @Permissions('fees.collect')
  updateFeeType(
    @Param('id') id: string,
    @Body(createZodPipe(updateFeeTypeSchema)) body: UpdateFeeTypeInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.feesService.updateFeeType(id, body, user);
  }

  @Get('fee-structures')
  @Permissions('fees.read')
  listStructures(
    @Query(createZodPipe(listFeeStructuresQuerySchema)) query: ListFeeStructuresQuery,
    @BranchId() branchId: string | null,
  ) {
    return this.feesService.listStructures(query, branchId);
  }

  @Post('fee-structures')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('fees.collect')
  createStructure(
    @Body(createZodPipe(createFeeStructureSchema)) body: CreateFeeStructureInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.feesService.createStructure(body, user);
  }

  @Patch('fee-structures/:id')
  @Permissions('fees.collect')
  updateStructure(
    @Param('id') id: string,
    @Body(createZodPipe(updateFeeStructureSchema)) body: UpdateFeeStructureInput,
    @CurrentUser() user: AuthUser,
    @BranchId() branchId: string | null,
  ) {
    return this.feesService.updateStructure(id, body, user, branchId);
  }

  @Delete('fee-structures/:id')
  @Permissions('fees.collect')
  deleteStructure(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchId() branchId: string | null,
  ) {
    return this.feesService.deleteStructure(id, user, branchId);
  }

  @Post('fee-structures/generate-invoices')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('fees.collect')
  generateBulkInvoices(
    @Body(createZodPipe(generateBulkInvoicesSchema)) body: GenerateBulkInvoicesInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.feesService.generateBulkInvoices(body, user);
  }

  @Get('fee-invoices')
  @Permissions('fees.read')
  findAll(
    @Query(createZodPipe(listFeeInvoicesQuerySchema)) query: ListFeeInvoicesQuery,
    @BranchId() branchId: string | null,
  ) {
    return this.feesService.findAll(query, branchId);
  }

  @Get('fee-invoices/:id')
  @Permissions('fees.read')
  getInvoice(@Param('id') id: string, @BranchId() branchId: string | null) {
    return this.feesService.getInvoice(id, branchId);
  }

  @Post('fee-invoices')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('fees.collect')
  create(
    @Body(createZodPipe(createFeeInvoiceSchema)) body: CreateFeeInvoiceInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.feesService.create(body, user);
  }

  @Patch('fee-invoices/:id/pay')
  @Permissions('fees.collect')
  recordPayment(
    @Param('id') id: string,
    @Body(createZodPipe(recordPaymentSchema)) body: RecordPaymentInput,
    @CurrentUser() user: AuthUser,
    @BranchId() branchId: string | null,
  ) {
    return this.feesService.recordPayment(id, body, user, branchId);
  }

  @Get('students/:studentId/fees')
  @Permissions('fees.read')
  getStudentFees(@Param('studentId') studentId: string, @BranchId() branchId: string | null) {
    return this.feesService.getStudentFees(studentId, branchId);
  }
}
