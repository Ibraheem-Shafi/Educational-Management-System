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
import { AcademicOpsService } from './academic-ops.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeParam, CurrentUser, Permissions } from '../../common/decorators/auth.decorators';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createAcademicActionSchema,
  createClassroomObservationSchema,
  createDisciplineIncidentSchema,
  createLessonPlanSchema,
  createSchoolEventSchema,
  createStaffTrainingSchema,
  createSyllabusUnitSchema,
  listAcademicActionsQuerySchema,
  listClassroomObservationsQuerySchema,
  listDisciplineIncidentsQuerySchema,
  listLessonPlansQuerySchema,
  listSchoolEventsQuerySchema,
  listStaffTrainingsQuerySchema,
  listSyllabusUnitsQuerySchema,
  updateAcademicActionSchema,
  updateClassroomObservationSchema,
  updateDisciplineIncidentSchema,
  updateLessonPlanSchema,
  updateSchoolEventSchema,
  updateStaffTrainingSchema,
  updateSyllabusUnitSchema,
} from '@eims/shared';
import type { AuthUser } from '@eims/types';
import type {
  CreateAcademicActionInput,
  CreateClassroomObservationInput,
  CreateDisciplineIncidentInput,
  CreateLessonPlanInput,
  CreateSchoolEventInput,
  CreateStaffTrainingInput,
  CreateSyllabusUnitInput,
  ListAcademicActionsQuery,
  ListClassroomObservationsQuery,
  ListDisciplineIncidentsQuery,
  ListLessonPlansQuery,
  ListSchoolEventsQuery,
  ListStaffTrainingsQuery,
  ListSyllabusUnitsQuery,
  UpdateAcademicActionInput,
  UpdateClassroomObservationInput,
  UpdateDisciplineIncidentInput,
  UpdateLessonPlanInput,
  UpdateSchoolEventInput,
  UpdateStaffTrainingInput,
  UpdateSyllabusUnitInput,
} from '@eims/shared';

@ApiTags('academic-ops')
@ApiBearerAuth()
@Controller('academic-ops')
@UseGuards(AuthGuard, BranchGuard, PermissionsGuard)
export class AcademicOpsController {
  constructor(private readonly academicOps: AcademicOpsService) {}

  @Get('syllabus-units')
  @Permissions('academic.read')
  listSyllabus(
    @Query(createZodPipe(listSyllabusUnitsQuerySchema)) query: ListSyllabusUnitsQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.academicOps.listSyllabusUnits(query, scope);
  }

  @Post('syllabus-units')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('academic.manage')
  createSyllabus(
    @Body(createZodPipe(createSyllabusUnitSchema)) body: CreateSyllabusUnitInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.academicOps.createSyllabusUnit(body, user);
  }

  @Patch('syllabus-units/:id')
  @Permissions('academic.manage')
  updateSyllabus(
    @Param('id') id: string,
    @Body(createZodPipe(updateSyllabusUnitSchema)) body: UpdateSyllabusUnitInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.academicOps.updateSyllabusUnit(id, body, user, scope);
  }

  @Delete('syllabus-units/:id')
  @Permissions('academic.manage')
  removeSyllabus(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.academicOps.removeSyllabusUnit(id, user, scope);
  }

  @Get('lesson-plans')
  @Permissions('academic.read')
  listLessons(
    @Query(createZodPipe(listLessonPlansQuerySchema)) query: ListLessonPlansQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.academicOps.listLessonPlans(query, scope);
  }

  @Post('lesson-plans')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('academic.manage')
  createLesson(
    @Body(createZodPipe(createLessonPlanSchema)) body: CreateLessonPlanInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.academicOps.createLessonPlan(body, user);
  }

  @Patch('lesson-plans/:id')
  @Permissions('academic.manage')
  updateLesson(
    @Param('id') id: string,
    @Body(createZodPipe(updateLessonPlanSchema)) body: UpdateLessonPlanInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.academicOps.updateLessonPlan(id, body, user, scope);
  }

  @Delete('lesson-plans/:id')
  @Permissions('academic.manage')
  removeLesson(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.academicOps.removeLessonPlan(id, user, scope);
  }

  @Get('observations')
  @Permissions('academic.read')
  listObservations(
    @Query(createZodPipe(listClassroomObservationsQuerySchema)) query: ListClassroomObservationsQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.academicOps.listObservations(query, scope);
  }

  @Post('observations')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('academic.manage')
  createObservation(
    @Body(createZodPipe(createClassroomObservationSchema)) body: CreateClassroomObservationInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.academicOps.createObservation(body, user);
  }

  @Patch('observations/:id')
  @Permissions('academic.manage')
  updateObservation(
    @Param('id') id: string,
    @Body(createZodPipe(updateClassroomObservationSchema)) body: UpdateClassroomObservationInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.academicOps.updateObservation(id, body, user, scope);
  }

  @Delete('observations/:id')
  @Permissions('academic.manage')
  removeObservation(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.academicOps.removeObservation(id, user, scope);
  }

  @Get('events')
  @Permissions('academic.read')
  listEvents(
    @Query(createZodPipe(listSchoolEventsQuerySchema)) query: ListSchoolEventsQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.academicOps.listEvents(query, scope);
  }

  @Post('events')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('academic.manage')
  createEvent(
    @Body(createZodPipe(createSchoolEventSchema)) body: CreateSchoolEventInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.academicOps.createEvent(body, user);
  }

  @Patch('events/:id')
  @Permissions('academic.manage')
  updateEvent(
    @Param('id') id: string,
    @Body(createZodPipe(updateSchoolEventSchema)) body: UpdateSchoolEventInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.academicOps.updateEvent(id, body, user, scope);
  }

  @Delete('events/:id')
  @Permissions('academic.manage')
  removeEvent(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.academicOps.removeEvent(id, user, scope);
  }

  @Get('discipline')
  @Permissions('academic.read')
  listDiscipline(
    @Query(createZodPipe(listDisciplineIncidentsQuerySchema)) query: ListDisciplineIncidentsQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.academicOps.listDiscipline(query, scope);
  }

  @Post('discipline')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('academic.manage')
  createDiscipline(
    @Body(createZodPipe(createDisciplineIncidentSchema)) body: CreateDisciplineIncidentInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.academicOps.createDiscipline(body, user);
  }

  @Patch('discipline/:id')
  @Permissions('academic.manage')
  updateDiscipline(
    @Param('id') id: string,
    @Body(createZodPipe(updateDisciplineIncidentSchema)) body: UpdateDisciplineIncidentInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.academicOps.updateDiscipline(id, body, user, scope);
  }

  @Delete('discipline/:id')
  @Permissions('academic.manage')
  removeDiscipline(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.academicOps.removeDiscipline(id, user, scope);
  }

  @Get('actions')
  @Permissions('academic.read')
  listActions(
    @Query(createZodPipe(listAcademicActionsQuerySchema)) query: ListAcademicActionsQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.academicOps.listActions(query, scope);
  }

  @Post('actions')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('academic.manage')
  createAction(
    @Body(createZodPipe(createAcademicActionSchema)) body: CreateAcademicActionInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.academicOps.createAction(body, user);
  }

  @Patch('actions/:id')
  @Permissions('academic.manage')
  updateAction(
    @Param('id') id: string,
    @Body(createZodPipe(updateAcademicActionSchema)) body: UpdateAcademicActionInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.academicOps.updateAction(id, body, user, scope);
  }

  @Delete('actions/:id')
  @Permissions('academic.manage')
  removeAction(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.academicOps.removeAction(id, user, scope);
  }

  @Get('trainings')
  @Permissions('academic.read')
  listTrainings(
    @Query(createZodPipe(listStaffTrainingsQuerySchema)) query: ListStaffTrainingsQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.academicOps.listTrainings(query, scope);
  }

  @Post('trainings')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('academic.manage')
  createTraining(
    @Body(createZodPipe(createStaffTrainingSchema)) body: CreateStaffTrainingInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.academicOps.createTraining(body, user);
  }

  @Patch('trainings/:id')
  @Permissions('academic.manage')
  updateTraining(
    @Param('id') id: string,
    @Body(createZodPipe(updateStaffTrainingSchema)) body: UpdateStaffTrainingInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.academicOps.updateTraining(id, body, user, scope);
  }

  @Delete('trainings/:id')
  @Permissions('academic.manage')
  removeTraining(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.academicOps.removeTraining(id, user, scope);
  }
}
