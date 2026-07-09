const jwt = require('jsonwebtoken');

const decodeToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split(' ')[1];
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
};

const attachRoleContext = (req, decoded) => {
  req.user = decoded;
  if (decoded.role === 'admin') req.admin = decoded;
  if (decoded.role === 'client') req.client = decoded;
  if (decoded.role === 'gestionnaire') req.gestionnaire = decoded;
};

// Middleware générique : accepte n'importe quel rôle connu, utile pour les
// routes partagées (ex: messagerie) qui appliquent leurs propres règles d'accès.
const authenticateAny = (req, res, next) => {
  const decoded = decodeToken(req);
  if (!decoded || !decoded.role) {
    return res.status(401).json({ error: 'Token manquant ou invalide' });
  }
  attachRoleContext(req, decoded);
  next();
};

// Factory : middleware qui n'autorise qu'un rôle précis.
const requireRole = (role) => (req, res, next) => {
  const decoded = decodeToken(req);
  if (!decoded) {
    return res.status(401).json({ error: 'Token manquant ou invalide' });
  }
  if (decoded.role !== role) {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  attachRoleContext(req, decoded);
  next();
};

// Export par défaut : comportement historique (admin uniquement),
// pour ne rien changer dans les fichiers qui font `const auth = require('../middleware/auth')`.
module.exports = requireRole('admin');
module.exports.requireRole = requireRole;
module.exports.authenticateAny = authenticateAny;
