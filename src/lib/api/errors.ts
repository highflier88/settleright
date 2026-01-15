export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class BadRequestError extends ApiError {
  constructor(message: string = 'Bad Request', code?: string) {
    super(message, 400, code);
    this.name = 'BadRequestError';
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message: string = 'Unauthorized', code?: string) {
    super(message, 401, code);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends ApiError {
  constructor(message: string = 'Forbidden', code?: string) {
    super(message, 403, code);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string = 'Not Found', code?: string) {
    super(message, 404, code);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends ApiError {
  constructor(message: string = 'Conflict', code?: string) {
    super(message, 409, code);
    this.name = 'ConflictError';
  }
}

export class ValidationError extends ApiError {
  constructor(
    message: string = 'Validation Error',
    public errors?: Record<string, string[]>
  ) {
    super(message, 422, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class RateLimitError extends ApiError {
  constructor(message: string = 'Too Many Requests') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
    this.name = 'RateLimitError';
  }
}

export class InternalServerError extends ApiError {
  constructor(message: string = 'Internal Server Error') {
    super(message, 500, 'INTERNAL_ERROR');
    this.name = 'InternalServerError';
  }
}
