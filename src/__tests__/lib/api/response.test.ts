/**
 * API Response Utilities Tests
 *
 * Tests for standardized API response formatting.
 */

import { NextResponse } from 'next/server';
import { successResponse, errorResponse, paginatedResponse } from '@/lib/api/response';
import {
  ApiError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  RateLimitError,
  InternalServerError,
} from '@/lib/api/errors';

// Mock NextResponse
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((data, options) => ({
      data,
      status: options?.status || 200,
    })),
  },
}));

describe('API Response Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // successResponse
  // ==========================================================================

  describe('successResponse', () => {
    it('should create success response with data', () => {
      const data = { id: 1, name: 'Test' };
      successResponse(data);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { success: true, data },
        { status: 200 }
      );
    });

    it('should allow custom status code', () => {
      successResponse({ created: true }, 201);

      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
        { status: 201 }
      );
    });

    it('should include meta when provided', () => {
      const data = [{ id: 1 }, { id: 2 }];
      const meta = { page: 1, perPage: 10, total: 100 };

      successResponse(data, 200, meta);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { success: true, data, meta },
        { status: 200 }
      );
    });

    it('should handle null data', () => {
      successResponse(null);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { success: true, data: null },
        { status: 200 }
      );
    });

    it('should handle empty array data', () => {
      successResponse([]);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { success: true, data: [] },
        { status: 200 }
      );
    });
  });

  // ==========================================================================
  // errorResponse
  // ==========================================================================

  describe('errorResponse', () => {
    it('should handle string error', () => {
      errorResponse('Something went wrong');

      expect(NextResponse.json).toHaveBeenCalledWith(
        { success: false, error: { message: 'Something went wrong' } },
        { status: 500 }
      );
    });

    it('should handle string error with custom status', () => {
      errorResponse('Bad request', 400);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { success: false, error: { message: 'Bad request' } },
        { status: 400 }
      );
    });

    it('should handle ApiError', () => {
      const error = new ApiError('Custom error', 418, 'TEAPOT');
      errorResponse(error);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { success: false, error: { message: 'Custom error', code: 'TEAPOT' } },
        { status: 418 }
      );
    });

    it('should handle BadRequestError', () => {
      const error = new BadRequestError('Invalid input', 'INVALID_INPUT');
      errorResponse(error);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { success: false, error: { message: 'Invalid input', code: 'INVALID_INPUT' } },
        { status: 400 }
      );
    });

    it('should handle UnauthorizedError', () => {
      const error = new UnauthorizedError();
      errorResponse(error);

      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ message: 'Unauthorized' }),
        }),
        { status: 401 }
      );
    });

    it('should handle ForbiddenError', () => {
      const error = new ForbiddenError('Access denied');
      errorResponse(error);

      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ message: 'Access denied' }),
        }),
        { status: 403 }
      );
    });

    it('should handle NotFoundError', () => {
      const error = new NotFoundError('Resource not found');
      errorResponse(error);

      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ message: 'Resource not found' }),
        }),
        { status: 404 }
      );
    });

    it('should handle ConflictError', () => {
      const error = new ConflictError('Duplicate entry');
      errorResponse(error);

      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ message: 'Duplicate entry' }),
        }),
        { status: 409 }
      );
    });

    it('should handle ValidationError with field errors', () => {
      const error = new ValidationError('Validation failed', {
        email: ['Invalid email format'],
        password: ['Too short', 'Must contain number'],
      });
      errorResponse(error);

      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          success: false,
          error: {
            message: 'Validation failed',
            code: 'VALIDATION_ERROR',
            errors: {
              email: ['Invalid email format'],
              password: ['Too short', 'Must contain number'],
            },
          },
        },
        { status: 422 }
      );
    });

    it('should handle RateLimitError', () => {
      const error = new RateLimitError();
      errorResponse(error);

      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Too Many Requests',
            code: 'RATE_LIMIT_EXCEEDED',
          }),
        }),
        { status: 429 }
      );
    });

    it('should handle InternalServerError', () => {
      const error = new InternalServerError();
      errorResponse(error);

      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Internal Server Error',
            code: 'INTERNAL_ERROR',
          }),
        }),
        { status: 500 }
      );
    });

    it('should hide error details in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new Error('Sensitive database error');
      errorResponse(error);

      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Internal Server Error',
            code: 'INTERNAL_ERROR',
          }),
        }),
        { status: 500 }
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should show error details in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new Error('Detailed error message');
      errorResponse(error);

      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Detailed error message',
          }),
        }),
        { status: 500 }
      );

      process.env.NODE_ENV = originalEnv;
    });
  });

  // ==========================================================================
  // paginatedResponse
  // ==========================================================================

  describe('paginatedResponse', () => {
    it('should create paginated response with correct meta', () => {
      const data = [{ id: 1 }, { id: 2 }, { id: 3 }];
      paginatedResponse(data, 1, 10, 25);

      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          success: true,
          data,
          meta: {
            page: 1,
            perPage: 10,
            total: 25,
            totalPages: 3,
          },
        },
        { status: 200 }
      );
    });

    it('should calculate totalPages correctly', () => {
      paginatedResponse([], 1, 10, 100);

      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({ totalPages: 10 }),
        }),
        expect.any(Object)
      );
    });

    it('should handle partial last page', () => {
      paginatedResponse([], 1, 10, 25);

      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({ totalPages: 3 }),
        }),
        expect.any(Object)
      );
    });

    it('should handle zero total', () => {
      paginatedResponse([], 1, 10, 0);

      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({
            total: 0,
            totalPages: 0,
          }),
        }),
        expect.any(Object)
      );
    });

    it('should handle single item total', () => {
      paginatedResponse([{ id: 1 }], 1, 10, 1);

      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({ totalPages: 1 }),
        }),
        expect.any(Object)
      );
    });
  });
});

// ==========================================================================
// API Error Classes
// ==========================================================================

describe('API Error Classes', () => {
  describe('ApiError', () => {
    it('should create error with message and status', () => {
      const error = new ApiError('Test error', 400, 'TEST_ERROR');

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('TEST_ERROR');
      expect(error.name).toBe('ApiError');
    });

    it('should default to 500 status', () => {
      const error = new ApiError('Server error');

      expect(error.statusCode).toBe(500);
    });
  });

  describe('BadRequestError', () => {
    it('should have 400 status code', () => {
      const error = new BadRequestError();

      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Bad Request');
      expect(error.name).toBe('BadRequestError');
    });
  });

  describe('UnauthorizedError', () => {
    it('should have 401 status code', () => {
      const error = new UnauthorizedError();

      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Unauthorized');
      expect(error.name).toBe('UnauthorizedError');
    });
  });

  describe('ForbiddenError', () => {
    it('should have 403 status code', () => {
      const error = new ForbiddenError();

      expect(error.statusCode).toBe(403);
      expect(error.message).toBe('Forbidden');
      expect(error.name).toBe('ForbiddenError');
    });
  });

  describe('NotFoundError', () => {
    it('should have 404 status code', () => {
      const error = new NotFoundError();

      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Not Found');
      expect(error.name).toBe('NotFoundError');
    });
  });

  describe('ConflictError', () => {
    it('should have 409 status code', () => {
      const error = new ConflictError();

      expect(error.statusCode).toBe(409);
      expect(error.message).toBe('Conflict');
      expect(error.name).toBe('ConflictError');
    });
  });

  describe('ValidationError', () => {
    it('should have 422 status code and validation errors', () => {
      const errors = { field: ['Error 1', 'Error 2'] };
      const error = new ValidationError('Invalid data', errors);

      expect(error.statusCode).toBe(422);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.errors).toEqual(errors);
      expect(error.name).toBe('ValidationError');
    });
  });

  describe('RateLimitError', () => {
    it('should have 429 status code', () => {
      const error = new RateLimitError();

      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(error.name).toBe('RateLimitError');
    });
  });

  describe('InternalServerError', () => {
    it('should have 500 status code', () => {
      const error = new InternalServerError();

      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.name).toBe('InternalServerError');
    });
  });
});
