export class AppError extends Error {
  constructor(message, status = 503) {
    super(message);
    this.name = 'AppError';
    this.status = status;
  }
}
