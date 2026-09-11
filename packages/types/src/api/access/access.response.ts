export interface AccessModuleCatalogItem {
  id: string;
  label: string;
  group: string;
  groupLabel: string;
  viewOnly: boolean;
}

export interface AccessCatalogGroup {
  id: string;
  label: string;
  modules: AccessModuleCatalogItem[];
}

export interface AccessCatalogResponse {
  groups: AccessCatalogGroup[];
}

export interface AccessModuleFlagDto {
  moduleId: string;
  view: boolean;
  edit: boolean;
}

export interface AccessRoleSummary {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isLocked: boolean;
  userCount: number;
  modules: AccessModuleFlagDto[];
}

export interface AccessRolesResponse {
  data: AccessRoleSummary[];
}

export interface UserAccessResponse {
  userId: string;
  role: { id: string; code: string; name: string } | null;
  isLocked: boolean;
  template: AccessModuleFlagDto[];
  effective: AccessModuleFlagDto[];
  overrides: AccessModuleFlagDto[];
  differsFromTemplate: boolean;
}
