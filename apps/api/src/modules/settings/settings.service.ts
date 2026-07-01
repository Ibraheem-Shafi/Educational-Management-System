import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.module';
import { AuditService } from '../audit/audit.service';
import { TtlCacheService } from '../../common/cache/ttl-cache.service';
import { LookupCacheService } from '../../common/lookup/lookup-cache.service';
import type { InstitutionSettingsResponse, UpdateInstitutionSettingsRequest } from '@eims/types';
import type { AuthUser } from '@eims/types';
import type { FeatureFlags, InstitutionType, TerminologyMap } from '@eims/types';

const SETTINGS_CACHE_TTL_MS = 300_000;

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly ttlCache: TtlCacheService,
    private readonly lookupCache: LookupCacheService,
  ) {}

  async getInstitutionSettings(): Promise<InstitutionSettingsResponse> {
    const cached = this.ttlCache.get<InstitutionSettingsResponse>('settings:institution');
    if (cached) return cached;

    const settings = await this.prisma.institutionSettings.findUnique({
      where: { id: 'default' },
    });
    if (!settings) throw new NotFoundException('Institution settings not found');
    const response = this.toResponse(settings);
    this.ttlCache.set('settings:institution', response, SETTINGS_CACHE_TTL_MS);
    return response;
  }

  async getLookups(categoryCode: string) {
    const cacheKey = `settings:lookups:${categoryCode}`;
    const cached = this.ttlCache.get<Awaited<ReturnType<SettingsService['loadLookups']>>>(cacheKey);
    if (cached) return cached;

    const result = await this.loadLookups(categoryCode);
    this.ttlCache.set(cacheKey, result, SETTINGS_CACHE_TTL_MS);
    return result;
  }

  private async loadLookups(categoryCode: string) {
    const category = await this.prisma.lookupCategory.findUnique({
      where: { code: categoryCode },
      include: {
        statuses: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!category) throw new NotFoundException('Lookup category not found');
    return {
      category: category.code,
      statuses: category.statuses.map((s) => ({
        id: s.id,
        code: s.code,
        label: s.label,
        sortOrder: s.sortOrder,
      })),
    };
  }

  async updateLookupStatus(
    categoryCode: string,
    statusId: string,
    input: { label?: string; sortOrder?: number; isActive?: boolean },
    user: AuthUser,
  ) {
    const category = await this.prisma.lookupCategory.findUnique({
      where: { code: categoryCode },
    });
    if (!category) throw new NotFoundException('Lookup category not found');

    const existing = await this.prisma.lookupStatus.findFirst({
      where: { id: statusId, categoryId: category.id },
    });
    if (!existing) throw new NotFoundException('Lookup status not found');

    const status = await this.prisma.lookupStatus.update({
      where: { id: statusId },
      data: {
        ...(input.label !== undefined && { label: input.label }),
        ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'lookup_status.updated',
      entityType: 'LookupStatus',
      entityId: status.id,
      previousValue: existing,
      newValue: status,
    });

    this.ttlCache.delete(`settings:lookups:${categoryCode}`);
    this.lookupCache.invalidate();

    return {
      id: status.id,
      code: status.code,
      label: status.label,
      sortOrder: status.sortOrder,
      isActive: status.isActive,
    };
  }

  async createLookupStatus(
    categoryCode: string,
    input: { code: string; label: string; sortOrder?: number },
    user: AuthUser,
  ) {
    const category = await this.prisma.lookupCategory.findUnique({
      where: { code: categoryCode },
    });
    if (!category) throw new NotFoundException('Lookup category not found');

    const status = await this.prisma.lookupStatus.create({
      data: {
        categoryId: category.id,
        code: input.code,
        label: input.label,
        sortOrder: input.sortOrder ?? 0,
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'lookup_status.created',
      entityType: 'LookupStatus',
      entityId: status.id,
      newValue: status,
    });

    this.ttlCache.delete(`settings:lookups:${categoryCode}`);
    this.lookupCache.invalidate();

    return {
      id: status.id,
      code: status.code,
      label: status.label,
      sortOrder: status.sortOrder,
      isActive: status.isActive,
    };
  }

  async updateInstitutionSettings(
    input: UpdateInstitutionSettingsRequest,
    user: AuthUser,
  ): Promise<InstitutionSettingsResponse> {
    const previous = await this.prisma.institutionSettings.findUnique({
      where: { id: 'default' },
    });

    const settings = await this.prisma.institutionSettings.update({
      where: { id: 'default' },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.logoUrl !== undefined && { logoUrl: input.logoUrl }),
        ...(input.faviconUrl !== undefined && { faviconUrl: input.faviconUrl }),
        ...(input.primaryColor !== undefined && { primaryColor: input.primaryColor }),
        ...(input.address !== undefined && { address: input.address }),
        ...(input.city !== undefined && { city: input.city }),
        ...(input.province !== undefined && { province: input.province }),
        ...(input.phone !== undefined && { phone: input.phone }),
        ...(input.email !== undefined && { email: input.email }),
        ...(input.website !== undefined && { website: input.website }),
        ...(input.timezone !== undefined && { timezone: input.timezone }),
        ...(input.currency !== undefined && { currency: input.currency }),
        ...(input.terminology !== undefined && {
          terminology: {
            ...((previous?.terminology as object) ?? {}),
            ...input.terminology,
          },
        }),
        ...(input.featureFlags !== undefined && {
          featureFlags: {
            ...((previous?.featureFlags as object) ?? {}),
            ...input.featureFlags,
          },
        }),
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'settings.updated',
      entityType: 'InstitutionSettings',
      entityId: settings.id,
      previousValue: previous,
      newValue: settings,
    });

    this.ttlCache.delete('settings:institution');
    return this.toResponse(settings);
  }

  private toResponse(settings: {
    id: string;
    name: string;
    logoUrl: string | null;
    faviconUrl: string | null;
    primaryColor: string;
    address: string | null;
    city: string | null;
    province: string | null;
    country: string;
    phone: string | null;
    email: string | null;
    website: string | null;
    timezone: string;
    currency: string;
    institutionType: string;
    terminology: unknown;
    featureFlags: unknown;
    updatedAt: Date;
  }): InstitutionSettingsResponse {
    return {
      id: settings.id,
      name: settings.name,
      logoUrl: settings.logoUrl,
      faviconUrl: settings.faviconUrl,
      primaryColor: settings.primaryColor,
      address: settings.address,
      city: settings.city,
      province: settings.province,
      country: settings.country,
      phone: settings.phone,
      email: settings.email,
      website: settings.website,
      timezone: settings.timezone,
      currency: settings.currency,
      institutionType: settings.institutionType as InstitutionType,
      terminology: (settings.terminology as TerminologyMap) ?? {
        batch: 'Batch',
        program: 'Program',
        assessment: 'Test',
        session: 'Session',
      },
      featureFlags: (settings.featureFlags as FeatureFlags) ?? {
        timetable: false,
        formBuilder: false,
        aiAttendance: false,
        parentPortal: true,
        studentPortal: true,
        rankings: true,
        assessmentSeries: true,
      },
      updatedAt: settings.updatedAt.toISOString(),
    };
  }
}
