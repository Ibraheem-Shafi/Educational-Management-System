import type { ApiError } from '@eims/types';
import { ApiClientError } from '@/lib/api-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function serverApiClient<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${API_URL}/api/v1${path}`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
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
