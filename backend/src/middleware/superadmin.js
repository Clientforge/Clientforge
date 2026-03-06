const requireSuperAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Forbidden — superadmin access required' });
  }
  next();
};

module.exports = requireSuperAdmin;
