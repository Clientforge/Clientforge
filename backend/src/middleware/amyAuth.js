const jwt = require('jsonwebtoken');
const config = require('../config');

const authenticateAmy = (req, res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = header.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    if (decoded.kind !== 'amy_app') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.amyAuth = true;
    next();
  } catch (_err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports = authenticateAmy;
