// Typed business errors. API handlers turn these into HTTP responses with the message shown to users.
export class AppError extends Error {
  constructor(code, message, status = 400, details = undefined) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const notFound = (what) => new AppError("NOT_FOUND", `${what} not found`, 404);
export const forbidden = (msg = "You do not have permission to do this") => new AppError("FORBIDDEN", msg, 403);
export const invalid = (msg, details) => new AppError("INVALID", msg, 400, details);
export const conflict = (msg, details) => new AppError("CONFLICT", msg, 409, details);
