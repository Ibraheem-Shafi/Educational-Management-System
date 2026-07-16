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

type ApiBody = BodyInit | Record<string, unknown> | unknown[] | null;

function isBodyInit(value: unknown): value is BodyInit {
  return (
    typeof value === 'string' ||
    value instanceof Blob ||
    value instanceof FormData ||
    value instanceof ArrayBuffer ||
    ArrayBuffer.isView(value) ||
    value instanceof URLSearchParams ||
    (typeof ReadableStream !== 'undefined' && value instanceof ReadableStream)
  );
}

export async function apiClient<T>(
  path: string,
  options: Omit<RequestInit, 'body'> & {
    token?: string | null;
    body?: ApiBody;
  } = {},
): Promise<T> {
  const { token, body, ...fetchOptions } = options;

  const serializedBody =
    body === undefined || body === null
      ? undefined
      : isBodyInit(body)
        ? body
        : JSON.stringify(body);

  const response = await fetch(`${API_URL}/api/v1${path}`, {
    ...fetchOptions,
    body: serializedBody,
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
