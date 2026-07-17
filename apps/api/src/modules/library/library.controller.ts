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
import { BranchId, CurrentUser, Permissions } from '../../common/decorators/auth.decorators';
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
    @BranchId() branchId: string | null,
  ) {
    return this.libraryService.getStats(branchId);
  }

  // --- Categories ---

  @Get('categories')
  @Permissions('library.read')
  findAllCategories(
    @Query(createZodPipe(listLibraryCategoriesQuerySchema)) query: ListLibraryCategoriesQuery,
    @BranchId() branchId: string | null,
  ) {
    return this.libraryService.findAllCategories(query, branchId);
  }

  @Get('categories/:id')
  @Permissions('library.read')
  findOneCategory(@Param('id') id: string, @BranchId() branchId: string | null) {
    return this.libraryService.findOneCategory(id, branchId);
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
    @BranchId() branchId: string | null,
  ) {
    return this.libraryService.updateCategory(id, body, user, branchId);
  }

  @Delete('categories/:id')
  @Permissions('library.manage')
  removeCategory(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchId() branchId: string | null,
  ) {
    return this.libraryService.removeCategory(id, user, branchId);
  }

  // --- Books ---

  @Get('books')
  @Permissions('library.read')
  findAllBooks(
    @Query(createZodPipe(listLibraryBooksQuerySchema)) query: ListLibraryBooksQuery,
    @BranchId() branchId: string | null,
  ) {
    return this.libraryService.findAllBooks(query, branchId);
  }

  @Get('books/:id')
  @Permissions('library.read')
  findOneBook(@Param('id') id: string, @BranchId() branchId: string | null) {
    return this.libraryService.findOneBook(id, branchId);
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
    @BranchId() branchId: string | null,
  ) {
    return this.libraryService.updateBook(id, body, user, branchId);
  }

  @Delete('books/:id')
  @Permissions('library.manage')
  removeBook(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchId() branchId: string | null,
  ) {
    return this.libraryService.removeBook(id, user, branchId);
  }

  // --- Copies ---

  @Post('copies')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('library.manage')
  createCopy(
    @Body(createZodPipe(createLibraryCopySchema)) body: CreateLibraryCopyInput,
    @CurrentUser() user: AuthUser,
    @BranchId() branchId: string | null,
  ) {
    return this.libraryService.createCopy(body, user, branchId);
  }

  @Patch('copies/:id')
  @Permissions('library.manage')
  updateCopy(
    @Param('id') id: string,
    @Body(createZodPipe(updateLibraryCopySchema)) body: UpdateLibraryCopyInput,
    @CurrentUser() user: AuthUser,
    @BranchId() branchId: string | null,
  ) {
    return this.libraryService.updateCopy(id, body, user, branchId);
  }

  // --- Loans ---

  @Get('loans')
  @Permissions('library.read')
  findAllLoans(
    @Query(createZodPipe(listLibraryLoansQuerySchema)) query: ListLibraryLoansQuery,
    @BranchId() branchId: string | null,
  ) {
    return this.libraryService.findAllLoans(query, branchId);
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
    @BranchId() branchId: string | null,
  ) {
    return this.libraryService.returnLoan(id, user, branchId);
  }

  @Post('loans/:id/renew')
  @Permissions('library.manage')
  renewLoan(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchId() branchId: string | null,
  ) {
    return this.libraryService.renewLoan(id, user, branchId);
  }

  // --- Reservations ---

  @Get('reservations')
  @Permissions('library.read')
  findAllReservations(
    @Query(createZodPipe(listLibraryReservationsQuerySchema)) query: ListLibraryReservationsQuery,
    @BranchId() branchId: string | null,
  ) {
    return this.libraryService.findAllReservations(query, branchId);
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
    @BranchId() branchId: string | null,
  ) {
    return this.libraryService.updateReservation(id, body, user, branchId);
  }

  @Delete('reservations/:id')
  @Permissions('library.manage')
  removeReservation(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchId() branchId: string | null,
  ) {
    return this.libraryService.removeReservation(id, user, branchId);
  }

  // --- Fines ---

  @Get('fines')
  @Permissions('library.read')
  findAllFines(
    @Query(createZodPipe(listLibraryFinesQuerySchema)) query: ListLibraryFinesQuery,
    @BranchId() branchId: string | null,
  ) {
    return this.libraryService.findAllFines(query, branchId);
  }

  @Patch('fines/:id')
  @Permissions('library.manage')
  updateFine(
    @Param('id') id: string,
    @Body(createZodPipe(updateLibraryFineSchema)) body: UpdateLibraryFineInput,
    @CurrentUser() user: AuthUser,
    @BranchId() branchId: string | null,
  ) {
    return this.libraryService.updateFine(id, body, user, branchId);
  }
}
