import { NextResponse } from 'next/server';

interface ApiMeta {
  total?: number;
  page?: number;
  pageSize?: number;
  [key: string]: unknown;
}

export function success<T>(data: T, meta?: ApiMeta) {
  return NextResponse.json({ data, error: null, meta: meta || null });
}

export function error(
  code: string,
  message: string,
  status: number = 500,
  details?: unknown
) {
  return NextResponse.json(
    {
      data: null,
      error: { code, message, details: details || null },
      meta: null,
    },
    { status }
  );
}
