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
import { LibraryService } from './library.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchId, BranchScopeParam, CurrentUser, Permissions } from '../../common/decorators/auth.decorators';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createLibraryBookSchema,
  createLibraryCategorySchema,
  createLibraryCopySchema,
  createLibraryReservationSchema,
  issueLibraryLoanSchema,
  listLibraryBooksQuerySchema,
  listLibraryCategoriesQuerySchema,
  listLibraryFinesQuerySchema,
  listLibraryLoansQuerySchema,
  listLibraryReservationsQuerySchema,
  libraryStatsQuerySchema,
  updateLibraryBookSchema,
  updateLibraryCategorySchema,
  updateLibraryCopySchema,
  updateLibraryFineSchema,
  updateLibraryReservationSchema,
} from '@eims/shared';
import type { AuthUser } from '@eims/types';
import type {
  CreateLibraryBookInput,
  CreateLibraryCategoryInput,
  CreateLibraryCopyInput,
  CreateLibraryReservationInput,
  IssueLibraryLoanInput,
  ListLibraryBooksQuery,
  ListLibraryCategoriesQuery,
  ListLibraryFinesQuery,
  ListLibraryLoansQuery,
  ListLibraryReservationsQuery,
  LibraryStatsQuery,
  UpdateLibraryBookInput,
  UpdateLibraryCategoryInput,
  UpdateLibraryCopyInput,
  UpdateLibraryFineInput,
  UpdateLibraryReservationInput,
} from '@eims/shared';

@ApiTags('library')
@ApiBearerAuth()
@Controller('library')
@UseGuards(AuthGuard, BranchGuard, PermissionsGuard)
export class LibraryController {
  constructor(private readonly libraryService: LibraryService) {}

  @Get('stats')
  @Permissions('library.read')
  getStats(
    @Query(createZodPipe(libraryStatsQuerySchema)) _query: LibraryStatsQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.libraryService.getStats(scope);
  }

  // --- Categories ---

  @Get('categories')
  @Permissions('library.read')
  findAllCategories(
    @Query(createZodPipe(listLibraryCategoriesQuerySchema)) query: ListLibraryCategoriesQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.libraryService.findAllCategories(query, scope);
  }

  @Get('categories/:id')
  @Permissions('library.read')
  findOneCategory(@Param('id') id: string, @BranchScopeParam() scope: BranchScope) {
    return this.libraryService.findOneCategory(id, scope);
  }

  @Post('categories')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('library.manage')
  createCategory(
    @Body(createZodPipe(createLibraryCategorySchema)) body: CreateLibraryCategoryInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.libraryService.createCategory(body, user);
  }

  @Patch('categories/:id')
  @Permissions('library.manage')
  updateCategory(
    @Param('id') id: string,
    @Body(createZodPipe(updateLibraryCategorySchema)) body: UpdateLibraryCategoryInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.libraryService.updateCategory(id, body, user, scope);
  }

  @Delete('categories/:id')
  @Permissions('library.manage')
  removeCategory(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.libraryService.removeCategory(id, user, scope);
  }

  // --- Books ---

  @Get('books')
  @Permissions('library.read')
  findAllBooks(
    @Query(createZodPipe(listLibraryBooksQuerySchema)) query: ListLibraryBooksQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.libraryService.findAllBooks(query, scope);
  }

  @Get('books/:id')
  @Permissions('library.read')
  findOneBook(@Param('id') id: string, @BranchScopeParam() scope: BranchScope) {
    return this.libraryService.findOneBook(id, scope);
  }

  @Post('books')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('library.manage')
  createBook(
    @Body(createZodPipe(createLibraryBookSchema)) body: CreateLibraryBookInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.libraryService.createBook(body, user);
  }

  @Patch('books/:id')
  @Permissions('library.manage')
  updateBook(
    @Param('id') id: string,
    @Body(createZodPipe(updateLibraryBookSchema)) body: UpdateLibraryBookInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.libraryService.updateBook(id, body, user, scope);
  }

  @Delete('books/:id')
  @Permissions('library.manage')
  removeBook(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.libraryService.removeBook(id, user, scope);
  }

  // --- Copies ---

  @Post('copies')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('library.manage')
  createCopy(
    @Body(createZodPipe(createLibraryCopySchema)) body: CreateLibraryCopyInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.libraryService.createCopy(body, user, scope);
  }

  @Patch('copies/:id')
  @Permissions('library.manage')
  updateCopy(
    @Param('id') id: string,
    @Body(createZodPipe(updateLibraryCopySchema)) body: UpdateLibraryCopyInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.libraryService.updateCopy(id, body, user, scope);
  }

  // --- Loans ---

  @Get('loans')
  @Permissions('library.read')
  findAllLoans(
    @Query(createZodPipe(listLibraryLoansQuerySchema)) query: ListLibraryLoansQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.libraryService.findAllLoans(query, scope);
  }

  @Post('loans/issue')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('library.manage')
  issueLoan(
    @Body(createZodPipe(issueLibraryLoanSchema)) body: IssueLibraryLoanInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.libraryService.issueLoan(body, user);
  }

  @Post('loans/:id/return')
  @Permissions('library.manage')
  returnLoan(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.libraryService.returnLoan(id, user, scope);
  }

  @Post('loans/:id/renew')
  @Permissions('library.manage')
  renewLoan(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.libraryService.renewLoan(id, user, scope);
  }

  // --- Reservations ---

  @Get('reservations')
  @Permissions('library.read')
  findAllReservations(
    @Query(createZodPipe(listLibraryReservationsQuerySchema)) query: ListLibraryReservationsQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.libraryService.findAllReservations(query, scope);
  }

  @Post('reservations')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('library.manage')
  createReservation(
    @Body(createZodPipe(createLibraryReservationSchema)) body: CreateLibraryReservationInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.libraryService.createReservation(body, user);
  }

  @Patch('reservations/:id')
  @Permissions('library.manage')
  updateReservation(
    @Param('id') id: string,
    @Body(createZodPipe(updateLibraryReservationSchema)) body: UpdateLibraryReservationInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.libraryService.updateReservation(id, body, user, scope);
  }

  @Delete('reservations/:id')
  @Permissions('library.manage')
  removeReservation(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.libraryService.removeReservation(id, user, scope);
  }

  // --- Fines ---

  @Get('fines')
  @Permissions('library.read')
  findAllFines(
    @Query(createZodPipe(listLibraryFinesQuerySchema)) query: ListLibraryFinesQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.libraryService.findAllFines(query, scope);
  }

  @Patch('fines/:id')
  @Permissions('library.manage')
  updateFine(
    @Param('id') id: string,
    @Body(createZodPipe(updateLibraryFineSchema)) body: UpdateLibraryFineInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.libraryService.updateFine(id, body, user, scope);
  }
}
