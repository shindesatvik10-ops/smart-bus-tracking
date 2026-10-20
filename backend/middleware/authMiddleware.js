const { auth, isInitialized } = require("../config/firebase");

/**
 * Middleware to verify Firebase Auth ID token from header:
 * Authorization: Bearer <idToken>
 */
async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  // Development bypass helper if token verification is not active yet
  const devRole = req.headers["x-dev-role"];
  const devUid = req.headers["x-dev-uid"];
  if (devRole && (!authHeader || process.env.NODE_ENV !== "production")) {
    req.user = {
      uid: devUid || "dev-user-id",
      role: devRole,
    };
    return next();
  }

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Authorization token missing or invalid format (Bearer <token> required).",
    });
  }

  const idToken = authHeader.split("Bearer ")[1];

  try {
    if (isInitialized && auth) {
      const decodedToken = await auth.verifyIdToken(idToken);
      req.user = decodedToken;
      return next();
    } else {
      // If Firebase Admin isn't connected to service account yet
      req.user = { uid: "unverified-user", email: req.headers["x-user-email"] };
      return next();
    }
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired authorization token.",
      error: err.message,
    });
  }
}

/**
 * Restrict access by role
 */
function requireRole(allowedRoles) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: requires one of the following roles: ${roles.join(", ")}`,
      });
    }
    next();
  };
}

module.exports = {
  verifyToken,
  requireRole,
};
