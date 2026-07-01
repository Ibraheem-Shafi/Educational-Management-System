import { Injectable } from '@nestjs/common';
import type { AuthUser } from '@eims/types';
import { TtlCacheService } from '../cache/ttl-cache.service';

const AUTH_CACHE_TTL_MS = 60_000;

export interface CachedAuthContext extends AuthUser {
  isActive: boolean;
}

@Injectable()
export class AuthCacheService {
  constructor(private readonly ttlCache: TtlCacheService) {}

  getBySupabaseUserId(supabaseUserId: string): CachedAuthContext | undefined {
    return this.ttlCache.get<CachedAuthContext>(`auth:supabase:${supabaseUserId}`);
  }

  setBySupabaseUserId(supabaseUserId: string, context: CachedAuthContext): void {
    this.ttlCache.set(`auth:supabase:${supabaseUserId}`, context, AUTH_CACHE_TTL_MS);
  }

  invalidateUser(userId: string): void {
    this.ttlCache.deleteByPrefix(`auth:user:${userId}`);
  }

  invalidateSupabaseUser(supabaseUserId: string): void {
    this.ttlCache.delete(`auth:supabase:${supabaseUserId}`);
  }

  invalidateAll(): void {
    this.ttlCache.deleteByPrefix('auth:');
  }
}
