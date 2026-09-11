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
import { FinanceOpsService } from './finance-ops.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeParam, CurrentUser, Permissions } from '../../common/decorators/auth.decorators';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createBankStatementLineSchema,
  createBankStatementSchema,
  createBudgetForecastLineSchema,
  createFixedAssetSchema,
  createPettyCashFundSchema,
  createPettyCashVoucherSchema,
  createPurchaseOrderSchema,
  createVendorBillSchema,
  createVendorSchema,
  financeOpsReportQuerySchema,
  listBankStatementsQuerySchema,
  listBudgetForecastLinesQuerySchema,
  listFixedAssetsQuerySchema,
  listPettyCashFundsQuerySchema,
  listPettyCashVouchersQuerySchema,
  listPurchaseOrdersQuerySchema,
  listVendorBillsQuerySchema,
  listVendorsQuerySchema,
  matchBankStatementLineSchema,
  payVendorBillSchema,
  receivePurchaseOrderSchema,
  updateBankStatementSchema,
  updateBudgetForecastLineSchema,
  updateFixedAssetSchema,
  updatePettyCashFundSchema,
  updatePurchaseOrderSchema,
  updateVendorBillSchema,
  updateVendorSchema,
} from '@eims/shared';
import type { AuthUser } from '@eims/types';
import type {
  CreateBankStatementInput,
  CreateBankStatementLineInput,
  CreateBudgetForecastLineInput,
  CreateFixedAssetInput,
  CreatePettyCashFundInput,
  CreatePettyCashVoucherInput,
  CreatePurchaseOrderInput,
  CreateVendorBillInput,
  CreateVendorInput,
  FinanceOpsReportQuery,
  ListBankStatementsQuery,
  ListBudgetForecastLinesQuery,
  ListFixedAssetsQuery,
  ListPettyCashFundsQuery,
  ListPettyCashVouchersQuery,
  ListPurchaseOrdersQuery,
  ListVendorBillsQuery,
  ListVendorsQuery,
  MatchBankStatementLineInput,
  PayVendorBillInput,
  ReceivePurchaseOrderInput,
  UpdateBankStatementInput,
  UpdateBudgetForecastLineInput,
  UpdateFixedAssetInput,
  UpdatePettyCashFundInput,
  UpdatePurchaseOrderInput,
  UpdateVendorBillInput,
  UpdateVendorInput,
} from '@eims/shared';

@ApiTags('finance-ops')
@ApiBearerAuth()
@Controller('finance-ops')
@UseGuards(AuthGuard, BranchGuard, PermissionsGuard)
export class FinanceOpsController {
  constructor(private readonly financeOps: FinanceOpsService) {}

  @Get('vendors')
  @Permissions('accounting.read')
  listVendors(
    @Query(createZodPipe(listVendorsQuerySchema)) query: ListVendorsQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.financeOps.listVendors(query, scope);
  }

  @Post('vendors')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('accounting.manage')
  createVendor(
    @Body(createZodPipe(createVendorSchema)) body: CreateVendorInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.financeOps.createVendor(body, user);
  }

  @Patch('vendors/:id')
  @Permissions('accounting.manage')
  updateVendor(
    @Param('id') id: string,
    @Body(createZodPipe(updateVendorSchema)) body: UpdateVendorInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.financeOps.updateVendor(id, body, user, scope);
  }

  @Delete('vendors/:id')
  @Permissions('accounting.manage')
  removeVendor(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.financeOps.removeVendor(id, user, scope);
  }

  @Get('vendor-bills')
  @Permissions('accounting.read')
  listBills(
    @Query(createZodPipe(listVendorBillsQuerySchema)) query: ListVendorBillsQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.financeOps.listBills(query, scope);
  }

  @Post('vendor-bills')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('accounting.manage')
  createBill(
    @Body(createZodPipe(createVendorBillSchema)) body: CreateVendorBillInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.financeOps.createBill(body, user);
  }

  @Patch('vendor-bills/:id')
  @Permissions('accounting.manage')
  updateBill(
    @Param('id') id: string,
    @Body(createZodPipe(updateVendorBillSchema)) body: UpdateVendorBillInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.financeOps.updateBill(id, body, user, scope);
  }

  @Post('vendor-bills/:id/pay')
  @Permissions('accounting.manage')
  payBill(
    @Param('id') id: string,
    @Body(createZodPipe(payVendorBillSchema)) body: PayVendorBillInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.financeOps.payBill(id, body, user, scope);
  }

  @Delete('vendor-bills/:id')
  @Permissions('accounting.manage')
  removeBill(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.financeOps.removeBill(id, user, scope);
  }

  @Get('petty-cash/funds')
  @Permissions('accounting.read')
  listFunds(
    @Query(createZodPipe(listPettyCashFundsQuerySchema)) query: ListPettyCashFundsQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.financeOps.listFunds(query, scope);
  }

  @Post('petty-cash/funds')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('accounting.manage')
  createFund(
    @Body(createZodPipe(createPettyCashFundSchema)) body: CreatePettyCashFundInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.financeOps.createFund(body, user);
  }

  @Patch('petty-cash/funds/:id')
  @Permissions('accounting.manage')
  updateFund(
    @Param('id') id: string,
    @Body(createZodPipe(updatePettyCashFundSchema)) body: UpdatePettyCashFundInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.financeOps.updateFund(id, body, user, scope);
  }

  @Delete('petty-cash/funds/:id')
  @Permissions('accounting.manage')
  removeFund(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.financeOps.removeFund(id, user, scope);
  }

  @Get('petty-cash/vouchers')
  @Permissions('accounting.read')
  listPettyVouchers(
    @Query(createZodPipe(listPettyCashVouchersQuerySchema)) query: ListPettyCashVouchersQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.financeOps.listPettyVouchers(query, scope);
  }

  @Post('petty-cash/vouchers')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('accounting.manage')
  createPettyVoucher(
    @Body(createZodPipe(createPettyCashVoucherSchema)) body: CreatePettyCashVoucherInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.financeOps.createPettyVoucher(body, user);
  }

  @Delete('petty-cash/vouchers/:id')
  @Permissions('accounting.manage')
  removePettyVoucher(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.financeOps.removePettyVoucher(id, user, scope);
  }

  @Get('bank-statements')
  @Permissions('accounting.read')
  listStatements(
    @Query(createZodPipe(listBankStatementsQuerySchema)) query: ListBankStatementsQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.financeOps.listStatements(query, scope);
  }

  @Post('bank-statements')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('accounting.manage')
  createStatement(
    @Body(createZodPipe(createBankStatementSchema)) body: CreateBankStatementInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.financeOps.createStatement(body, user);
  }

  @Patch('bank-statements/:id')
  @Permissions('accounting.manage')
  updateStatement(
    @Param('id') id: string,
    @Body(createZodPipe(updateBankStatementSchema)) body: UpdateBankStatementInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.financeOps.updateStatement(id, body, user, scope);
  }

  @Post('bank-statements/:id/lines')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('accounting.manage')
  addStatementLine(
    @Param('id') id: string,
    @Body(createZodPipe(createBankStatementLineSchema)) body: CreateBankStatementLineInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.financeOps.addStatementLine(id, body, user, scope);
  }

  @Delete('bank-statements/:id')
  @Permissions('accounting.manage')
  removeStatement(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.financeOps.removeStatement(id, user, scope);
  }

  @Post('bank-lines/:id/match')
  @Permissions('accounting.manage')
  matchLine(
    @Param('id') id: string,
    @Body(createZodPipe(matchBankStatementLineSchema)) body: MatchBankStatementLineInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.financeOps.matchStatementLine(id, body, user, scope);
  }

  @Get('purchase-orders')
  @Permissions('accounting.read')
  listPurchaseOrders(
    @Query(createZodPipe(listPurchaseOrdersQuerySchema)) query: ListPurchaseOrdersQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.financeOps.listPurchaseOrders(query, scope);
  }

  @Post('purchase-orders')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('accounting.manage')
  createPurchaseOrder(
    @Body(createZodPipe(createPurchaseOrderSchema)) body: CreatePurchaseOrderInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.financeOps.createPurchaseOrder(body, user);
  }

  @Patch('purchase-orders/:id')
  @Permissions('accounting.manage')
  updatePurchaseOrder(
    @Param('id') id: string,
    @Body(createZodPipe(updatePurchaseOrderSchema)) body: UpdatePurchaseOrderInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.financeOps.updatePurchaseOrder(id, body, user, scope);
  }

  @Post('purchase-orders/:id/receive')
  @Permissions('accounting.manage')
  receivePurchaseOrder(
    @Param('id') id: string,
    @Body(createZodPipe(receivePurchaseOrderSchema)) body: ReceivePurchaseOrderInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.financeOps.receivePurchaseOrder(id, body, user, scope);
  }

  @Delete('purchase-orders/:id')
  @Permissions('accounting.manage')
  removePurchaseOrder(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.financeOps.removePurchaseOrder(id, user, scope);
  }

  @Get('assets')
  @Permissions('accounting.read')
  listAssets(
    @Query(createZodPipe(listFixedAssetsQuerySchema)) query: ListFixedAssetsQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.financeOps.listAssets(query, scope);
  }

  @Post('assets')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('accounting.manage')
  createAsset(
    @Body(createZodPipe(createFixedAssetSchema)) body: CreateFixedAssetInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.financeOps.createAsset(body, user);
  }

  @Patch('assets/:id')
  @Permissions('accounting.manage')
  updateAsset(
    @Param('id') id: string,
    @Body(createZodPipe(updateFixedAssetSchema)) body: UpdateFixedAssetInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.financeOps.updateAsset(id, body, user, scope);
  }

  @Delete('assets/:id')
  @Permissions('accounting.manage')
  removeAsset(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.financeOps.removeAsset(id, user, scope);
  }

  @Get('forecast-lines')
  @Permissions('accounting.read')
  listForecast(
    @Query(createZodPipe(listBudgetForecastLinesQuerySchema)) query: ListBudgetForecastLinesQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.financeOps.listForecastLines(query, scope);
  }

  @Post('forecast-lines')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('accounting.manage')
  createForecast(
    @Body(createZodPipe(createBudgetForecastLineSchema)) body: CreateBudgetForecastLineInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.financeOps.createForecastLine(body, user);
  }

  @Patch('forecast-lines/:id')
  @Permissions('accounting.manage')
  updateForecast(
    @Param('id') id: string,
    @Body(createZodPipe(updateBudgetForecastLineSchema)) body: UpdateBudgetForecastLineInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.financeOps.updateForecastLine(id, body, user);
  }

  @Delete('forecast-lines/:id')
  @Permissions('accounting.manage')
  removeForecast(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.financeOps.removeForecastLine(id, user);
  }

  @Get('reports/cash-flow')
  @Permissions('accounting.read')
  cashFlow(
    @Query(createZodPipe(financeOpsReportQuerySchema)) query: FinanceOpsReportQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.financeOps.cashFlow(query, scope);
  }

  @Get('reports/profitability')
  @Permissions('accounting.read')
  profitability(
    @Query(createZodPipe(financeOpsReportQuerySchema)) query: FinanceOpsReportQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.financeOps.profitability(query, scope);
  }

  @Get('reports/risk')
  @Permissions('accounting.read')
  risk(
    @Query(createZodPipe(financeOpsReportQuerySchema)) query: FinanceOpsReportQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.financeOps.financialRisk(query, scope);
  }
}
