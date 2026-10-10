import { NextResponse } from 'next/server';
import { HttpError } from './errors';

export function fail(error: unknown): NextResponse {
  if (error instanceof HttpError) {
    return NextResponse.json(
      { error: error.message, pinRequired: error.pinRequired || undefined },
      { status: error.status },
    );
  }
  console.error(error);
  return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
}

export function api(handler: (request: Request) => Promise<Response> | Response) {
  return async (request: Request) => {
    try {
      return await handler(request);
    } catch (error) {
      return fail(error);
    }
  };
}

export async function readBody(request: Request): Promise<Record<string, unknown>> {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'The request could not be read.');
  }
  return body as Record<string, unknown>;
}
