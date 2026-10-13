export class AppError extends Error {
  constructor(message, { status = 400, code = 'CATALOG_ERROR', details = null } = {}) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function errorBody(error, requestId = null) {
  return {
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: error.message || 'Internal server error',
      request_id: requestId,
      ...(error.details ? { details: error.details } : {})
    }
  };
}
