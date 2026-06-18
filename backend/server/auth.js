import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// Use a fallback JWT Secret for sandboxed environment
const JWT_SECRET = process.env.JWT_SECRET || 'auto_aid_ai_super_secret_key_12345';

// Generate JWT token
export function generateToken(user) {
  return jwt.sign(
    { id: user.id, userId: user.id, email: user.email, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

// Hashing password helper
export function hashPassword(password) {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(password, salt);
}

// Compare password helper
export function comparePassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

// JWT Verification Middleware
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

// Role based Access Control (RBAC) Admin Middleware
export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden. Admin privileges required.' });
    }
    next();
  });
}
