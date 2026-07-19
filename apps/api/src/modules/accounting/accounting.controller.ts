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
import { AccountingService } from './accounting.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchId, BranchScopeParam, CurrentUser, Permissions } from '../../common/decorators/auth.decorators';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import {
  accountStatementQuerySchema,
  budgetVsActualQuerySchema,
  createAccountSchema,
  createBudgetSchema,
  createVoucherSchema,
  incomeExpenseQuerySchema,
  listAccountsQuerySchema,
  listBudgetsQuerySchema,
  listVouchersQuerySchema,
  trialBalanceQuerySchema,
  updateAccountSchema,
  updateBudgetSchema,
  updateVoucherSchema,
} from '@eims/shared';
import type { AuthUser } from '@eims/types';
import type {
  AccountStatementQuery,
  BranchScope,
  BudgetVsActualQuery,
  CreateAccountInput,
  CreateBudgetInput,
  CreateVoucherInput,
  IncomeExpenseQuery,
  ListAccountsQuery,
  ListBudgetsQuery,
  ListVouchersQuery,
  TrialBalanceQuery,
  UpdateAccountInput,
  UpdateBudgetInput,
  UpdateVoucherInput,
} from '@eims/shared';

@ApiTags('accounting')
@ApiBearerAuth()
@Controller('accounting')
@UseGuards(AuthGuard, BranchGuard, PermissionsGuard)
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @Get('accounts')
  @Permissions('accounting.read')
  findAllAccounts(
    @Query(createZodPipe(listAccountsQuerySchema)) query: ListAccountsQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.accountingService.findAllAccounts(query, scope);
  }

  @Post('accounts')
  @Permissions('accounting.manage')
  createAccount(
    @Body(createZodPipe(createAccountSchema)) body: CreateAccountInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.accountingService.createAccount(body, user, scope);
  }

  @Patch('accounts/:id')
  @Permissions('accounting.manage')
  updateAccount(
    @Param('id') id: string,
    @Body(createZodPipe(updateAccountSchema)) body: UpdateAccountInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.accountingService.updateAccount(id, body, user, scope);
  }

  @Delete('accounts/:id')
  @HttpCode(HttpStatus.OK)
  @Permissions('accounting.manage')
  removeAccount(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.accountingService.removeAccount(id, user, scope);
  }

  @Get('vouchers')
  @Permissions('accounting.read')
  findAllVouchers(
    @Query(createZodPipe(listVouchersQuerySchema)) query: ListVouchersQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.accountingService.findAllVouchers(query, scope);
  }

  @Get('vouchers/:id')
  @Permissions('accounting.read')
  findVoucher(@Param('id') id: string, @BranchScopeParam() scope: BranchScope) {
    return this.accountingService.findVoucher(id, scope);
  }

  @Post('vouchers')
  @Permissions('accounting.manage')
  createVoucher(
    @Body(createZodPipe(createVoucherSchema)) body: CreateVoucherInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.accountingService.createVoucher(body, user, scope);
  }

  @Patch('vouchers/:id')
  @Permissions('accounting.manage')
  updateVoucher(
    @Param('id') id: string,
    @Body(createZodPipe(updateVoucherSchema)) body: UpdateVoucherInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.accountingService.updateVoucher(id, body, user, scope);
  }

  @Delete('vouchers/:id')
  @HttpCode(HttpStatus.OK)
  @Permissions('accounting.manage')
  removeVoucher(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.accountingService.removeVoucher(id, user, scope);
  }

  @Post('vouchers/:id/post')
  @Permissions('accounting.manage')
  postVoucher(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.accountingService.postVoucher(id, user, scope);
  }

  @Post('vouchers/:id/unpost')
  @Permissions('accounting.manage')
  unpostVoucher(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.accountingService.unpostVoucher(id, user, scope);
  }

  @Get('budgets')
  @Permissions('accounting.read')
  findAllBudgets(
    @Query(createZodPipe(listBudgetsQuerySchema)) query: ListBudgetsQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.accountingService.findAllBudgets(query, scope);
  }

  @Post('budgets')
  @Permissions('accounting.manage')
  createBudget(
    @Body(createZodPipe(createBudgetSchema)) body: CreateBudgetInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.accountingService.createBudget(body, user, scope);
  }

  @Patch('budgets/:id')
  @Permissions('accounting.manage')
  updateBudget(
    @Param('id') id: string,
    @Body(createZodPipe(updateBudgetSchema)) body: UpdateBudgetInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.accountingService.updateBudget(id, body, user, scope);
  }

  @Delete('budgets/:id')
  @HttpCode(HttpStatus.OK)
  @Permissions('accounting.manage')
  removeBudget(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.accountingService.removeBudget(id, user, scope);
  }

  @Get('reports/trial-balance')
  @Permissions('accounting.read')
  trialBalance(
    @Query(createZodPipe(trialBalanceQuerySchema)) query: TrialBalanceQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.accountingService.trialBalance(query, scope);
  }

  @Get('reports/income-expense')
  @Permissions('accounting.read')
  incomeExpense(
    @Query(createZodPipe(incomeExpenseQuerySchema)) query: IncomeExpenseQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.accountingService.incomeExpense(query, scope);
  }

  @Get('reports/account-statement')
  @Permissions('accounting.read')
  accountStatement(
    @Query(createZodPipe(accountStatementQuerySchema)) query: AccountStatementQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.accountingService.accountStatement(query, scope);
  }

  @Get('reports/budget-vs-actual')
  @Permissions('accounting.read')
  budgetVsActual(
    @Query(createZodPipe(budgetVsActualQuerySchema)) query: BudgetVsActualQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.accountingService.budgetVsActual(query, scope);
  }
}
