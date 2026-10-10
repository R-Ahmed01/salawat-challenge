export class HttpError extends Error {
  status: number;
  pinRequired?: boolean;

  constructor(status: number, message: string, options?: { pinRequired?: boolean }) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.pinRequired = options?.pinRequired;
  }
}
