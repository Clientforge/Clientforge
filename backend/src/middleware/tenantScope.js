/**
 * Ensures every request has a tenant context.
 * Must be used AFTER the auth middleware.
 * Attaches tenantId to req so services/queries can scope data.
 */
const tenantScope = (req, res, next) => {
  if (!req.user || !req.user.tenantId) {
    return res.status(403).json({ error: 'Tenant context missing' });
  }

  req.tenantId = req.user.tenantId;
  next();
};

module.exports = tenantScope;
