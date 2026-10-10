export class ApiError extends Error {
  status: number;
  pinRequired: boolean;

  constructor(message: string, status: number, pinRequired = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.pinRequired = pinRequired;
  }
}

export function isOfflineError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 0;
}

export async function api<T>(url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const method = init?.method ?? (init?.body ? 'POST' : 'GET');
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
      body: init?.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new ApiError('You are offline.', 0);
  }
  const data = (await response.json().catch(() => ({}))) as { error?: string; pinRequired?: boolean };
  if (response.status === 401 && !data.pinRequired) {
    window.location.assign('/login');
    throw new ApiError(data.error || 'Please log in again.', 401);
  }
  if (!response.ok) {
    throw new ApiError(data.error || 'Something went wrong.', response.status, Boolean(data.pinRequired));
  }
  return data as T;
}
