export class ForbiddenError extends Error {
  readonly statusCode = 403;

  constructor(message = 'אין הרשאה') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends Error {
  readonly statusCode = 404;

  constructor(message = 'לא נמצא') {
    super(message);
    this.name = 'NotFoundError';
  }
}
