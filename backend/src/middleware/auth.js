export function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in required.' } });
  }
  next();
}
