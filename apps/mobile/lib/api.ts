import { API_URL } from './config';

export class ApiError extends Error {
  statusCode: number;
  details?: Record<string, string[]>;

  constructor(message: string, statusCode: number, details?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

type ApiBody = BodyInit | Record<string, unknown> | unknown[] | null;

function isBodyInit(value: unknown): value is BodyInit {
  return (
    typeof value === 'string' ||
    value instanceof Blob ||
    value instanceof FormData ||
    value instanceof ArrayBuffer ||
    ArrayBuffer.isView(value) ||
    value instanceof URLSearchParams
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
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(fetchOptions.headers as Record<string, string> | undefined),
    },
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => ({
      statusCode: response.status,
      message: response.statusText,
    }))) as { message?: string; statusCode?: number; details?: Record<string, string[]> };
    throw new ApiError(error.message ?? 'Request failed', error.statusCode ?? response.status, error.details);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
