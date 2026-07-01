import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createSecretKey } from 'crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { getJwtAlg, getJwtPayload } from '../utils/jwt.util';
import { TtlCacheService } from '../cache/ttl-cache.service';

const TOKEN_VERIFY_CACHE_TTL_MS = 30_000;

export interface VerifiedToken {
  supabaseUserId: string;
}

@Injectable()
export class JwtVerifyService {
  private readonly supabase: SupabaseClient;
  private readonly jwtSecret: string | undefined;
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(
    private readonly config: ConfigService,
    private readonly ttlCache: TtlCacheService,
  ) {
    const supabaseUrl = this.config.getOrThrow('SUPABASE_URL');
    this.supabase = createClient(
      supabaseUrl,
      this.config.getOrThrow('SUPABASE_SERVICE_ROLE_KEY'),
    );
    this.jwtSecret = this.config.get<string>('SUPABASE_JWT_SECRET');
    this.jwks = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`));
  }

  async verifyAccessToken(token: string): Promise<VerifiedToken | null> {
    const cacheKey = `jwt:${token.slice(-32)}`;
    const cached = this.ttlCache.get<VerifiedToken>(cacheKey);
    if (cached) return cached;

    const payload = getJwtPayload(token);
    if (!payload) return null;

    const exp = payload.exp;
    if (typeof exp === 'number' && exp * 1000 < Date.now()) return null;

    const supabaseUserId = await this.verifyLocally(token) ?? (await this.verifyViaSupabase(token));
    if (!supabaseUserId) return null;

    const result = { supabaseUserId };
    this.ttlCache.set(cacheKey, result, TOKEN_VERIFY_CACHE_TTL_MS);
    return result;
  }

  private async verifyLocally(token: string): Promise<string | null> {
    const alg = getJwtAlg(token);

    if (alg === 'HS256' && this.jwtSecret) {
      try {
        const secret = createSecretKey(Buffer.from(this.jwtSecret, 'utf8'));
        const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
        return typeof payload.sub === 'string' ? payload.sub : null;
      } catch {
        return null;
      }
    }

    if (alg === 'ES256') {
      try {
        const { payload } = await jwtVerify(token, this.jwks, { algorithms: ['ES256'] });
        return typeof payload.sub === 'string' ? payload.sub : null;
      } catch {
        return null;
      }
    }

    return null;
  }

  private async verifyViaSupabase(token: string): Promise<string | null> {
    const {
      data: { user },
      error,
    } = await this.supabase.auth.getUser(token);
    if (error || !user) return null;
    return user.id;
  }
}
