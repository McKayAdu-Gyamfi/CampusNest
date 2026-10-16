export const errorHandler = (err, req, res, next) => {
  console.error("Unhandled Error:", err);
  
  const statusCode = err.statusCode || 500;
  // Only deliberate application errors (those carrying their own statusCode)
  // may expose their message; anything else can contain internal detail or
  // secrets (e.g. Convex argument errors echo the whole args object).
  const isDeliberate = Boolean(err.statusCode && err.message);
  const message = isDeliberate ? err.message : "Internal Server Error";

  res.status(statusCode).json({
    success: false,
    message,
    // stack begins with the message, so it is gated the same way
    ...(isDeliberate && process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

export const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Resource not found: ${req.method} ${req.originalUrl}`
  });
};
