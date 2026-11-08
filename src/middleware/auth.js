const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Authentication token required',
    });
  }

  const token = authorization.slice(7);
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    return res.status(500).json({
      error: 'Authentication service is not configured',
    });
  }

  try {
    req.user = jwt.verify(token, secret, {
      algorithms: ['HS256'],
    });

    return next();
  } catch {
    return res.status(401).json({
      error: 'Invalid or expired authentication token',
    });
  }
}

function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
      });
    }

    return next();
  };
}

module.exports = { authenticate, authorize };
