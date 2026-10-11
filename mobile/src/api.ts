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

export function createApi(server: string, token: string | null, playerToken: string | null) {
  return async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
    const headers: Record<string, string> = { 'X-Salawat-Client': 'app' };
    if (init?.body) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    if (playerToken) headers['X-Salawat-Player'] = playerToken;

    let response: Response;
    try {
      response = await fetch(`${server}${path}`, {
        method: init?.method ?? (init?.body ? 'POST' : 'GET'),
        headers,
        body: init?.body ? JSON.stringify(init.body) : undefined,
      });
    } catch {
      throw new ApiError('Cannot reach the server. Check the address, and that the website is running.', 0);
    }

    const data = (await response.json().catch(() => ({}))) as { error?: string; pinRequired?: boolean };
    if (!response.ok) {
      throw new ApiError(data.error || 'Something went wrong.', response.status, Boolean(data.pinRequired));
    }
    return data as T;
  };
}
