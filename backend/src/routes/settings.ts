import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { User } from '../models';
import { protect, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(protect);

// PATCH /api/settings
router.patch('/', [
  body('minBalance').optional().isFloat({ min: 0 }),
  body('currency').optional().isString().isLength({ max: 5 }),
  body('name').optional().trim().isLength({ min: 2, max: 100 }),
], async (req: AuthRequest, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  try {
    const updates: Record<string, unknown> = {};
    if (req.body.minBalance !== undefined) updates.minBalance = req.body.minBalance;
    if (req.body.currency) updates.currency = req.body.currency;
    if (req.body.name) updates.name = req.body.name;

    const user = await User.findByIdAndUpdate(req.userId, updates, { new: true }).select('-password');
    res.json({ id: user!._id, name: user!.name, email: user!.email, minBalance: user!.minBalance, currency: user!.currency });
  } catch {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;