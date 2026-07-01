import type { InstitutionSettings } from '../../entities/institution-settings';
export type InstitutionSettingsResponse = InstitutionSettings;
export interface UpdateInstitutionSettingsRequest {
    name?: string;
    logoUrl?: string | null;
    faviconUrl?: string | null;
    primaryColor?: string;
    address?: string | null;
    city?: string | null;
    province?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    terminology?: Partial<InstitutionSettings['terminology']>;
    featureFlags?: Partial<InstitutionSettings['featureFlags']>;
}
//# sourceMappingURL=institution-settings.response.d.ts.map