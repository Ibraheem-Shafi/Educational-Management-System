export type InstitutionType = 'coaching' | 'school' | 'college';

export interface TerminologyMap {
  batch: string;
  program: string;
  assessment: string;
  session: string;
}

export interface FeatureFlags {
  timetable: boolean;
  formBuilder: boolean;
  aiAttendance: boolean;
  parentPortal: boolean;
  studentPortal: boolean;
  rankings: boolean;
  assessmentSeries: boolean;
}

export interface InstitutionSettings {
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
  institutionType: InstitutionType;
  terminology: TerminologyMap;
  featureFlags: FeatureFlags;
  updatedAt: string;
}
