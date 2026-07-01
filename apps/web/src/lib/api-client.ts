import type { ApiError } from '@eims/types';

export class ApiClientError extends Error {
  statusCode: number;
  details?: Record<string, string[]>;

  constructor(error: ApiError) {
    super(error.message);
    this.name = 'ApiClientError';
    this.statusCode = error.statusCode;
    this.details = error.details;
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function apiClient<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, ...fetchOptions } = options;

  const response = await fetch(`${API_URL}/api/v1${path}`, {
    ...fetchOptions,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...fetchOptions.headers,
    },
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => ({
      statusCode: response.status,
      message: response.statusText,
    }))) as ApiError;
    throw new ApiClientError(error);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
