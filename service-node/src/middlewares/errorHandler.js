const errorHandler = (err, req, res, next) => {
  console.error("[Node Service Error]:", err);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    status_code: statusCode,
    message: err.message || "Terjadi kesalahan internal pada server Node.js",
    data: null,
    errors: err.details || { name: err.name || "InternalServerError" },
  });
};

module.exports = errorHandler;
