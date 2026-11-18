const jwt = require("jsonwebtoken");
const pool = require("../config/db");
require("dotenv").config();

const verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      status_code: 401,
      message: "Akses ditolak. Token Bearer diperlukan.",
      data: null,
      errors: { name: "Unauthorized" },
    });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });
    req.user = decoded; // Berisi { uid, username, role } dari Yii2
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      status_code: 401,
      message: "Token tidak valid atau sudah kedaluwarsa.",
      data: null,
      errors: { name: "Unauthorized", detail: err.message },
    });
  }
};

const authorizePermissions = (...permissions) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        status_code: 401,
        message: "Autentikasi diperlukan.",
        data: null,
        errors: { name: "Unauthorized" },
      });
    }

    if (req.user.role === "ADMIN") return next();

    try {
      const { rowCount } = await pool.query(
        `SELECT 1 FROM role_permissions
         WHERE role = $1 AND permission = ANY($2::varchar[])
         LIMIT 1`,
        [req.user.role, permissions],
      );
      if (rowCount > 0) return next();

      return res.status(403).json({
        success: false,
        status_code: 403,
        message: "Role Anda belum memiliki hak akses untuk fitur ini.",
        data: null,
        errors: { name: "Forbidden" },
      });
    } catch (error) {
      return next(error);
    }
  };
};

module.exports = { verifyToken, authorizePermissions };
