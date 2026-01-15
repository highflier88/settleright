import { NextResponse } from 'next/server';

import { ApiError, ValidationError } from './errors';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    errors?: Record<string, string[]>;
  };
  meta?: {
    page?: number;
    perPage?: number;
    total?: number;
    totalPages?: number;
  };
}

export function successResponse<T>(
  data: T,
  status: number = 200,
  meta?: ApiResponse['meta']
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      ...(meta && { meta }),
    },
    { status }
  );
}

export function errorResponse(
  error: Error | ApiError | string,
  status?: number
): NextResponse<ApiResponse> {
  if (typeof error === 'string') {
    return NextResponse.json(
      {
        success: false,
        error: { message: error },
      },
      { status: status ?? 500 }
    );
  }

  if (error instanceof ValidationError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error.message,
          code: error.code,
          errors: error.errors,
        },
      },
      { status: error.statusCode }
    );
  }

  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error.message,
          code: error.code,
        },
      },
      { status: error.statusCode }
    );
  }

  // Generic error
  const isProd = process.env.NODE_ENV === 'production';
  return NextResponse.json(
    {
      success: false,
      error: {
        message: isProd ? 'Internal Server Error' : error.message,
        code: 'INTERNAL_ERROR',
      },
    },
    { status: status ?? 500 }
  );
}

export function paginatedResponse<T>(
  data: T[],
  page: number,
  perPage: number,
  total: number
): NextResponse<ApiResponse<T[]>> {
  return successResponse(data, 200, {
    page,
    perPage,
    total,
    totalPages: Math.ceil(total / perPage),
  });
}
