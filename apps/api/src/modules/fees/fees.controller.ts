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
import { BranchId, BranchScopeParam, CurrentUser, Permissions } from '../../common/decorators/auth.decorators';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createFeeInvoiceSchema,
  listFeeInvoicesQuerySchema,
  listFeeInvoicesByStudentQuerySchema,
  bulkFeeInvoicePrintQuerySchema,
  bulkFeeInvoicePrintBodySchema,
  recordPaymentSchema,
  recordFeePaymentSchema,
  prepareFeePaymentReceiptUploadSchema,
  createFeeStructureSchema,
  updateFeeStructureSchema,
  listFeeStructuresQuerySchema,
  generateBulkInvoicesSchema,
  previewBulkInvoicesSchema,
  createFeeTypeSchema,
  updateFeeTypeSchema,
  listFeeTypesQuerySchema,
  listFeeChallansQuerySchema,
  createFeeChallanSchema,
  updateFeeInvoiceSchema,
  updateFeeChallanSchema,
  incrementFeeRatesSchema,
  updateStudentFeePolicySchema,
} from '@eims/shared';
import type { AuthUser } from '@eims/types';
import type {
  BranchScope,
  CreateFeeInvoiceInput,
  ListFeeInvoicesQuery,
  ListFeeInvoicesByStudentQuery,
  BulkFeeInvoicePrintQuery,
  BulkFeeInvoicePrintBody,
  RecordPaymentInput,
  RecordFeePaymentInput,
  PrepareFeePaymentReceiptUploadInput,
  CreateFeeStructureInput,
  UpdateFeeStructureInput,
  ListFeeStructuresQuery,
  ListFeeTypesQuery,
  GenerateBulkInvoicesInput,
  PreviewBulkInvoicesInput,
  CreateFeeTypeInput,
  UpdateFeeTypeInput,
  ListFeeChallansQuery,
  CreateFeeChallanInput,
  UpdateFeeInvoiceInput,
  UpdateFeeChallanInput,
  IncrementFeeRatesInput,
  UpdateStudentFeePolicyInput,
} from '@eims/shared';

@ApiTags('fees')
@ApiBearerAuth()
@Controller()
@UseGuards(AuthGuard, BranchGuard, PermissionsGuard)
export class FeesController {
  constructor(private readonly feesService: FeesService) {}

  @Get('fees/stats')
  @Permissions('fees.read')
  getStats(@BranchScopeParam() scope: BranchScope) {
    return this.feesService.getStats(scope);
  }

  @Get('fees/revenue-trend')
  @Permissions('fees.read')
  getRevenueTrend(@BranchScopeParam() scope: BranchScope) {
    return this.feesService.getRevenueTrend(scope);
  }

  @Get('fee-types')
  @Permissions('fees.read')
  listTypes(@Query(createZodPipe(listFeeTypesQuerySchema)) query: ListFeeTypesQuery) {
    return this.feesService.listTypes(query);
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
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.feesService.listStructures(query, scope);
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
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.feesService.updateStructure(id, body, user, scope);
  }

  @Delete('fee-structures/:id')
  @Permissions('fees.collect')
  deleteStructure(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.feesService.deleteStructure(id, user, scope);
  }

  @Post('fee-structures/preview-invoices')
  @Permissions('fees.collect')
  previewBulkInvoices(
    @Body(createZodPipe(previewBulkInvoicesSchema)) body: PreviewBulkInvoicesInput,
  ) {
    return this.feesService.previewBulkInvoices(body);
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

  @Post('fee-structures/increment')
  @Permissions('fees.collect')
  incrementFeeRates(
    @Body(createZodPipe(incrementFeeRatesSchema)) body: IncrementFeeRatesInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.feesService.incrementFeeRates(body, user, scope);
  }

  @Get('fee-invoices')
  @Permissions('fees.read')
  findAll(
    @Query(createZodPipe(listFeeInvoicesQuerySchema)) query: ListFeeInvoicesQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.feesService.findAll(query, scope);
  }

  @Get('fee-invoices/by-student')
  @Permissions('fees.read')
  findAllByStudent(
    @Query(createZodPipe(listFeeInvoicesByStudentQuerySchema)) query: ListFeeInvoicesByStudentQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.feesService.findAllByStudent(query, scope);
  }

  @Get('fee-invoices/print-data')
  @Permissions('fees.read')
  getInvoicePrintDataBulk(
    @Query(createZodPipe(bulkFeeInvoicePrintQuerySchema)) query: BulkFeeInvoicePrintQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.feesService.getInvoicePrintDataBulk(query.ids, scope);
  }

  @Post('fee-invoices/print-data')
  @HttpCode(HttpStatus.OK)
  @Permissions('fees.read')
  getInvoicePrintDataBulkPost(
    @Body(createZodPipe(bulkFeeInvoicePrintBodySchema)) body: BulkFeeInvoicePrintBody,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.feesService.getInvoicePrintDataBulk(body.ids, scope);
  }

  @Get('fee-invoices/:id')
  @Permissions('fees.read')
  getInvoice(@Param('id') id: string, @BranchScopeParam() scope: BranchScope) {
    return this.feesService.getInvoice(id, scope);
  }

  @Get('fee-invoices/:id/print-data')
  @Permissions('fees.read')
  getInvoicePrintData(@Param('id') id: string, @BranchScopeParam() scope: BranchScope) {
    return this.feesService.getInvoicePrintData(id, scope);
  }

  @Get('fee-payments/:id/print-data')
  @Permissions('fees.read')
  getPaymentPrintData(@Param('id') id: string, @BranchScopeParam() scope: BranchScope) {
    return this.feesService.getPaymentPrintData(id, scope);
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

  @Patch('fee-invoices/:id')
  @Permissions('fees.collect')
  updateInvoice(
    @Param('id') id: string,
    @Body(createZodPipe(updateFeeInvoiceSchema)) body: UpdateFeeInvoiceInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.feesService.updateInvoice(id, body, user, scope);
  }

  @Patch('fee-invoices/:id/pay')
  @Permissions('fees.collect')
  recordPayment(
    @Param('id') id: string,
    @Body(createZodPipe(recordPaymentSchema)) body: RecordPaymentInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.feesService.recordPayment(id, body, user, scope);
  }

  @Post('fee-invoices/:id/payment-receipt/upload-url')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('fees.collect')
  preparePaymentReceiptUpload(
    @Param('id') id: string,
    @Body(createZodPipe(prepareFeePaymentReceiptUploadSchema))
    body: PrepareFeePaymentReceiptUploadInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.feesService.preparePaymentReceiptUpload(id, body, user, scope);
  }

  @Post('fee-invoices/:id/payments')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('fees.collect')
  recordFeePayment(
    @Param('id') id: string,
    @Body(createZodPipe(recordFeePaymentSchema)) body: RecordFeePaymentInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.feesService.recordFeePayment(id, body, user, scope);
  }

  @Patch('fee-invoices/:id/waive')
  @Permissions('fees.collect')
  waiveInvoice(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.feesService.waiveInvoice(id, user, scope);
  }

  @Patch('fee-invoices/:id/unwaive')
  @Permissions('fees.collect')
  unwaiveInvoice(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.feesService.unwaiveInvoice(id, user, scope);
  }

  @Get('students/:studentId/fees')
  @Permissions('fees.read')
  getStudentFees(@Param('studentId') studentId: string, @BranchScopeParam() scope: BranchScope) {
    return this.feesService.getStudentFees(studentId, scope);
  }

  @Patch('students/:studentId/fee-policy')
  @Permissions('fees.collect')
  updateStudentFeePolicy(
    @Param('studentId') studentId: string,
    @Body(createZodPipe(updateStudentFeePolicySchema)) body: UpdateStudentFeePolicyInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.feesService.updateStudentFeePolicy(studentId, body, user, scope);
  }

  @Get('fee-challans')
  @Permissions('fees.read')
  listChallans(
    @Query(createZodPipe(listFeeChallansQuerySchema)) query: ListFeeChallansQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.feesService.listChallans(query, scope);
  }

  @Post('fee-challans')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('fees.collect')
  createChallan(
    @Body(createZodPipe(createFeeChallanSchema)) body: CreateFeeChallanInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.feesService.createChallan(body, user);
  }

  @Patch('fee-challans/:id')
  @Permissions('fees.collect')
  updateChallan(
    @Param('id') id: string,
    @Body(createZodPipe(updateFeeChallanSchema)) body: UpdateFeeChallanInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.feesService.updateChallan(id, body, user, scope);
  }

  @Get('fee-challans/:id/print-data')
  @Permissions('fees.read')
  getChallanPrintData(@Param('id') id: string, @BranchScopeParam() scope: BranchScope) {
    return this.feesService.getChallanPrintData(id, scope);
  }
}
