import { Router } from 'express';
import { User } from '../models/User.js';
import { signToken, requireAuth } from '../middleware/auth.js';

const router = Router();

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    if (await User.exists({ email: email.toLowerCase() })) {
      return res.status(409).json({ error: 'That email is already registered' });
    }

    const user = await User.create({
      name,
      email,
      passwordHash: await User.hashPassword(password),
    });

    res.cookie('token', signToken(user), cookieOptions);
    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email?.toLowerCase() }).select('+passwordHash');
    if (!user || !(await user.verifyPassword(password))) {
      // Same response either way, so the endpoint cannot be used to test
      // whether an email is registered.
      return res.status(401).json({ error: 'Incorrect email or password' });
    }

    res.cookie('token', signToken(user), cookieOptions);
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token', { ...cookieOptions, maxAge: undefined });
  res.status(204).end();
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
