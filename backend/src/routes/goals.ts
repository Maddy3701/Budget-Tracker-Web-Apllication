import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { Goal, User } from '../models';
import { protect, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(protect);

// GET /api/goals
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const goals = await Goal.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json(goals);
  } catch {
    res.status(500).json({ error: 'Failed to fetch goals' });
  }
});

// POST /api/goals
router.post('/', [
  body('name').trim().isLength({ min: 1, max: 200 }),
  body('targetAmount').isFloat({ min: 1 }),
  body('emoji').optional().isString().isLength({ max: 10 }),
  body('deadline').optional().isISO8601(),
], async (req: AuthRequest, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  try {
    const { name, targetAmount, emoji, deadline } = req.body;
    const goal = await Goal.create({
      userId: req.userId,
      name,
      targetAmount,
      emoji: emoji || '🎯',
      deadline: deadline ? new Date(deadline) : undefined,
    });
    res.status(201).json(goal);
  } catch {
    res.status(500).json({ error: 'Failed to create goal' });
  }
});

// PATCH /api/goals/:id/complete
router.patch('/:id/complete', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const goal = await Goal.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { completed: true, completedAt: new Date() },
      { new: true }
    );
    if (!goal) { res.status(404).json({ error: 'Goal not found' }); return; }
    res.json(goal);
  } catch {
    res.status(500).json({ error: 'Failed to complete goal' });
  }
});

// DELETE /api/goals/:id
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const goal = await Goal.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!goal) { res.status(404).json({ error: 'Goal not found' }); return; }
    res.json({ message: 'Goal deleted' });
  } catch {
    res.status(500).json({ error: 'Failed to delete goal' });
  }
});

export default router;