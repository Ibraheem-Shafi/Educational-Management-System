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
import { BranchId, CurrentUser, Permissions } from '../../common/decorators/auth.decorators';
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
    @BranchId() branchId: string | null,
  ) {
    return this.accountingService.findAllAccounts(query, branchId);
  }

  @Post('accounts')
  @Permissions('accounting.manage')
  createAccount(
    @Body(createZodPipe(createAccountSchema)) body: CreateAccountInput,
    @CurrentUser() user: AuthUser,
    @BranchId() branchId: string | null,
  ) {
    return this.accountingService.createAccount(body, user, branchId);
  }

  @Patch('accounts/:id')
  @Permissions('accounting.manage')
  updateAccount(
    @Param('id') id: string,
    @Body(createZodPipe(updateAccountSchema)) body: UpdateAccountInput,
    @CurrentUser() user: AuthUser,
    @BranchId() branchId: string | null,
  ) {
    return this.accountingService.updateAccount(id, body, user, branchId);
  }

  @Delete('accounts/:id')
  @HttpCode(HttpStatus.OK)
  @Permissions('accounting.manage')
  removeAccount(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchId() branchId: string | null,
  ) {
    return this.accountingService.removeAccount(id, user, branchId);
  }

  @Get('vouchers')
  @Permissions('accounting.read')
  findAllVouchers(
    @Query(createZodPipe(listVouchersQuerySchema)) query: ListVouchersQuery,
    @BranchId() branchId: string | null,
  ) {
    return this.accountingService.findAllVouchers(query, branchId);
  }

  @Get('vouchers/:id')
  @Permissions('accounting.read')
  findVoucher(@Param('id') id: string, @BranchId() branchId: string | null) {
    return this.accountingService.findVoucher(id, branchId);
  }

  @Post('vouchers')
  @Permissions('accounting.manage')
  createVoucher(
    @Body(createZodPipe(createVoucherSchema)) body: CreateVoucherInput,
    @CurrentUser() user: AuthUser,
    @BranchId() branchId: string | null,
  ) {
    return this.accountingService.createVoucher(body, user, branchId);
  }

  @Patch('vouchers/:id')
  @Permissions('accounting.manage')
  updateVoucher(
    @Param('id') id: string,
    @Body(createZodPipe(updateVoucherSchema)) body: UpdateVoucherInput,
    @CurrentUser() user: AuthUser,
    @BranchId() branchId: string | null,
  ) {
    return this.accountingService.updateVoucher(id, body, user, branchId);
  }

  @Delete('vouchers/:id')
  @HttpCode(HttpStatus.OK)
  @Permissions('accounting.manage')
  removeVoucher(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchId() branchId: string | null,
  ) {
    return this.accountingService.removeVoucher(id, user, branchId);
  }

  @Post('vouchers/:id/post')
  @Permissions('accounting.manage')
  postVoucher(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchId() branchId: string | null,
  ) {
    return this.accountingService.postVoucher(id, user, branchId);
  }

  @Post('vouchers/:id/unpost')
  @Permissions('accounting.manage')
  unpostVoucher(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchId() branchId: string | null,
  ) {
    return this.accountingService.unpostVoucher(id, user, branchId);
  }

  @Get('budgets')
  @Permissions('accounting.read')
  findAllBudgets(
    @Query(createZodPipe(listBudgetsQuerySchema)) query: ListBudgetsQuery,
    @BranchId() branchId: string | null,
  ) {
    return this.accountingService.findAllBudgets(query, branchId);
  }

  @Post('budgets')
  @Permissions('accounting.manage')
  createBudget(
    @Body(createZodPipe(createBudgetSchema)) body: CreateBudgetInput,
    @CurrentUser() user: AuthUser,
    @BranchId() branchId: string | null,
  ) {
    return this.accountingService.createBudget(body, user, branchId);
  }

  @Patch('budgets/:id')
  @Permissions('accounting.manage')
  updateBudget(
    @Param('id') id: string,
    @Body(createZodPipe(updateBudgetSchema)) body: UpdateBudgetInput,
    @CurrentUser() user: AuthUser,
    @BranchId() branchId: string | null,
  ) {
    return this.accountingService.updateBudget(id, body, user, branchId);
  }

  @Delete('budgets/:id')
  @HttpCode(HttpStatus.OK)
  @Permissions('accounting.manage')
  removeBudget(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchId() branchId: string | null,
  ) {
    return this.accountingService.removeBudget(id, user, branchId);
  }

  @Get('reports/trial-balance')
  @Permissions('accounting.read')
  trialBalance(
    @Query(createZodPipe(trialBalanceQuerySchema)) query: TrialBalanceQuery,
    @BranchId() branchId: string | null,
  ) {
    return this.accountingService.trialBalance(query, branchId);
  }

  @Get('reports/income-expense')
  @Permissions('accounting.read')
  incomeExpense(
    @Query(createZodPipe(incomeExpenseQuerySchema)) query: IncomeExpenseQuery,
    @BranchId() branchId: string | null,
  ) {
    return this.accountingService.incomeExpense(query, branchId);
  }

  @Get('reports/account-statement')
  @Permissions('accounting.read')
  accountStatement(
    @Query(createZodPipe(accountStatementQuerySchema)) query: AccountStatementQuery,
    @BranchId() branchId: string | null,
  ) {
    return this.accountingService.accountStatement(query, branchId);
  }

  @Get('reports/budget-vs-actual')
  @Permissions('accounting.read')
  budgetVsActual(
    @Query(createZodPipe(budgetVsActualQuerySchema)) query: BudgetVsActualQuery,
    @BranchId() branchId: string | null,
  ) {
    return this.accountingService.budgetVsActual(query, branchId);
  }
}
