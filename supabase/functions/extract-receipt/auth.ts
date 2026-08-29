import { SafeHttpError } from './errors.ts';
import { readJsonResponseLimited } from './http.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_AUTH_RESPONSE_BYTES = 64 * 1024;

export interface AccessVerifier {
  authenticate(request: Request, signal: AbortSignal): Promise<{ userId: string }>;
  verifyTripMembership(userId: string, tripId: string, signal: AbortSignal): Promise<void>;
}

type SupabaseAccessConfig = {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
};

export class SupabaseAccessVerifier implements AccessVerifier {
  private readonly baseUrl: URL;

  constructor(
    private readonly config: SupabaseAccessConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.baseUrl = validateSupabaseUrl(config.url);
    if (!config.anonKey || !config.serviceRoleKey) throw new Error('missing Supabase configuration');
  }

  async authenticate(request: Request, signal: AbortSignal): Promise<{ userId: string }> {
    const authorization = request.headers.get('authorization') ?? '';
    if (!/^Bearer [^\s]{20,8192}$/i.test(authorization)) {
      throw new SafeHttpError(401, 'authentication_required', 'Sign in to scan a receipt.');
    }

    const userId = await this.verifyJwt(authorization, signal);
    const accountApproved = await this.hasApprovedAccount(userId, signal);
    if (!accountApproved) {
      throw new SafeHttpError(
        403,
        'account_access_denied',
        'Your account is not approved for receipt scanning.',
      );
    }
    return { userId };
  }

  async verifyTripMembership(userId: string, tripId: string, signal: AbortSignal): Promise<void> {
    if (!UUID_PATTERN.test(tripId)) {
      throw new SafeHttpError(400, 'invalid_request', 'A valid trip is required.');
    }
    const membershipApproved = await this.hasApprovedMembership(userId, tripId, signal);
    if (!membershipApproved) {
      throw new SafeHttpError(403, 'trip_access_denied', 'You are not an approved member of this trip.');
    }
  }

  private async verifyJwt(authorization: string, signal: AbortSignal): Promise<string> {
    const url = new URL('/auth/v1/user', this.baseUrl);
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: 'GET',
        headers: {
          authorization,
          apikey: this.config.anonKey,
        },
        signal,
      });
    } catch (error) {
      if (signal.aborted) throw error;
      throw new SafeHttpError(503, 'extraction_unavailable', 'Authentication is temporarily unavailable.');
    }

    if (response.status === 401 || response.status === 403) {
      await response.body?.cancel().catch(() => undefined);
      throw new SafeHttpError(401, 'authentication_required', 'Sign in to scan a receipt.');
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw new SafeHttpError(503, 'extraction_unavailable', 'Authentication is temporarily unavailable.');
    }

    let payload: unknown;
    try {
      payload = await readJsonResponseLimited(response, MAX_AUTH_RESPONSE_BYTES);
    } catch {
      throw new SafeHttpError(503, 'extraction_unavailable', 'Authentication is temporarily unavailable.');
    }
    const id = isRecord(payload) ? payload.id : undefined;
    if (typeof id !== 'string' || !UUID_PATTERN.test(id)) {
      throw new SafeHttpError(401, 'authentication_required', 'Sign in to scan a receipt.');
    }
    return id;
  }

  private hasApprovedAccount(userId: string, signal: AbortSignal): Promise<boolean> {
    return this.restExists('account_access', {
      user_id: `eq.${userId}`,
      status: 'eq.approved',
    }, signal);
  }

  private hasApprovedMembership(userId: string, tripId: string, signal: AbortSignal): Promise<boolean> {
    return this.restExists('members', {
      user_id: `eq.${userId}`,
      trip_id: `eq.${tripId}`,
      status: 'eq.approved',
    }, signal);
  }

  private async restExists(
    table: 'account_access' | 'members',
    filters: Record<string, string>,
    signal: AbortSignal,
  ): Promise<boolean> {
    const url = new URL(`/rest/v1/${table}`, this.baseUrl);
    url.searchParams.set('select', table === 'members' ? 'id' : 'user_id');
    for (const [name, value] of Object.entries(filters)) url.searchParams.set(name, value);
    url.searchParams.set('limit', '1');

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        headers: {
          authorization: `Bearer ${this.config.serviceRoleKey}`,
          apikey: this.config.serviceRoleKey,
          accept: 'application/json',
        },
        signal,
      });
    } catch (error) {
      if (signal.aborted) throw error;
      throw new SafeHttpError(
        503,
        'extraction_unavailable',
        'Membership verification is temporarily unavailable.',
      );
    }

    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw new SafeHttpError(
        503,
        'extraction_unavailable',
        'Membership verification is temporarily unavailable.',
      );
    }

    try {
      const payload = await readJsonResponseLimited(response, MAX_AUTH_RESPONSE_BYTES);
      return Array.isArray(payload) && payload.length === 1;
    } catch {
      throw new SafeHttpError(
        503,
        'extraction_unavailable',
        'Membership verification is temporarily unavailable.',
      );
    }
  }
}

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function validateSupabaseUrl(value: string): URL {
  const url = new URL(value);
  const localHttp = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !localHttp) throw new Error('invalid Supabase URL');
  if (url.username || url.password || url.search || url.hash) throw new Error('invalid Supabase URL');
  return url;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
