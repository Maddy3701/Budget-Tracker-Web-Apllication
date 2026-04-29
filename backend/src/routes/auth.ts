import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { User } from '../models';
import { generateToken, protect, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /api/auth/register
router.post('/register', [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
], async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }

  try {
    const { name, email, password } = req.body;
    const existing = await User.findOne({ email });
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const user = await User.create({ name, email, password });
    const token = generateToken(user._id.toString());
    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email, minBalance: user.minBalance, currency: user.currency },
    });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }

  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = generateToken(user._id.toString());
    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, minBalance: user.minBalance, currency: user.currency },
    });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me
router.get('/me', protect, (req: AuthRequest, res: Response) => {
  const u = req.user!;
  res.json({ id: u._id, name: u.name, email: u.email, minBalance: u.minBalance, currency: u.currency });
});

export default router;