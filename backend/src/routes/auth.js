import { Router } from 'express';
import { User } from '../models/User.js';

const router = Router();

router.post('/register', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password || password.length < 8) {
      return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Email and 8+ char password required.' } });
    }
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ error: { code: 'EMAIL_TAKEN', message: 'Email already registered.' } });
    const passwordHash = await User.hashPassword(password);
    const user = await User.create({ email, passwordHash });
    req.session.userId = user._id.toString();
    res.status(201).json({ id: user._id, email: user.email });
  } catch (err) { next(err); }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: (email || '').toLowerCase() });
    if (!user || !(await user.verifyPassword(password))) {
      return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' } });
    }
    req.session.userId = user._id.toString();
    res.json({ id: user._id, email: user.email });
  } catch (err) { next(err); }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/me', (req, res) => {
  if (!req.session?.userId) return res.status(401).json({ error: { code: 'UNAUTHENTICATED' } });
  res.json({ id: req.session.userId });
});

export default router;
