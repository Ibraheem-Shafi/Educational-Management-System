import { Global, Module } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { BranchGuard } from './branch.guard';
import { PermissionsGuard } from './permissions.guard';
import { SuperAdminGuard } from './super-admin.guard';
import { TtlCacheService } from '../cache/ttl-cache.service';
import { LookupCacheService } from '../lookup/lookup-cache.service';
import { AuthCacheService } from '../auth/auth-cache.service';
import { JwtVerifyService } from '../auth/jwt-verify.service';

@Global()
@Module({
  providers: [
    TtlCacheService,
    LookupCacheService,
    AuthCacheService,
    JwtVerifyService,
    AuthGuard,
    BranchGuard,
    PermissionsGuard,
    SuperAdminGuard,
  ],
  exports: [
    TtlCacheService,
    LookupCacheService,
    AuthCacheService,
    JwtVerifyService,
    AuthGuard,
    BranchGuard,
    PermissionsGuard,
    SuperAdminGuard,
  ],
})
export class GuardsModule {}
