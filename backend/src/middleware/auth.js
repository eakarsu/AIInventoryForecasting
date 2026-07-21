import jwt from 'jsonwebtoken';

// In-memory token blacklist (for logout)
export const tokenBlacklist = new Set();

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET || '';
  if (secret.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters');
  return secret;
}

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  if (tokenBlacklist.has(token)) {
    return res.status(401).json({ error: 'Token has been revoked' });
  }

  try {
    const decoded = jwt.verify(
      token,
      getJwtSecret(),
      { issuer: 'inventory-forecasting' }
    );
    req.user = decoded;
    req.token = token;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(403).json({ error: 'Invalid token' });
  }
};

export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

// Permission matrix
const permissionMatrix = {
  admin: { products: ['read', 'create', 'update', 'delete'], suppliers: ['read', 'create', 'update', 'delete'], orders: ['read', 'create', 'update', 'delete'], forecasts: ['read', 'create', 'update', 'delete'], analytics: ['read', 'create'], users: ['read', 'create', 'update', 'delete'] },
  manager: { products: ['read', 'create', 'update'], suppliers: ['read', 'create', 'update'], orders: ['read', 'create', 'update'], forecasts: ['read', 'create', 'update'], analytics: ['read', 'create'], users: ['read'] },
  user: { products: ['read'], suppliers: ['read'], orders: ['read'], forecasts: ['read'], analytics: ['read'], users: [] },
};

export const requirePermission = (resource, action) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const role = req.user.role || 'user';
    const permissions = permissionMatrix[role];

    if (!permissions || !permissions[resource] || !permissions[resource].includes(action)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};
