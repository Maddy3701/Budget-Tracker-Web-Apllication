import { Router, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import { Transaction, User } from '../models';
import { protect, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(protect);

// Helper: compute current balance for a user
const getUserBalance = async (userId: string): Promise<number> => {
  const result = await Transaction.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: null,
        income: { $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] } },
        expense: { $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] } },
      },
    },
  ]);
  if (!result.length) return 0;
  return result[0].income - result[0].expense;
};

// GET /api/transactions
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('type').optional().isIn(['income', 'expense']),
  query('category').optional().isString(),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
], async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { userId: req.userId };
    if (req.query.type) filter.type = req.query.type;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.startDate || req.query.endDate) {
      filter.date = {};
      if (req.query.startDate) (filter.date as Record<string, unknown>).$gte = new Date(req.query.startDate as string);
      if (req.query.endDate) (filter.date as Record<string, unknown>).$lte = new Date(req.query.endDate as string);
    }

    const [transactions, total, balance] = await Promise.all([
      Transaction.find(filter).sort({ date: -1 }).skip(skip).limit(limit).lean(),
      Transaction.countDocuments(filter),
      getUserBalance(req.userId!),
    ]);

    res.json({ transactions, total, page, pages: Math.ceil(total / limit), balance });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// POST /api/transactions
router.post('/', [
  body('type').isIn(['income', 'expense']).withMessage('Type must be income or expense'),
  body('category').isIn(['Pocket Money', 'Salary', 'Other', 'Food', 'Travel', 'Fun', 'Self']).withMessage('Invalid category'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be positive'),
  body('date').optional().isISO8601().withMessage('Invalid date'),
  body('note').optional().isString().isLength({ max: 500 }),
], async (req: AuthRequest, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }

  try {
    const { type, category, amount, note, date } = req.body;

    // Business rule: expense cannot create negative balance
    if (type === 'expense') {
      const currentBalance = await getUserBalance(req.userId!);
      if (currentBalance - amount < 0) {
        res.status(400).json({
          error: 'Insufficient balance',
          message: `This transaction would make your balance negative. Current balance: ${currentBalance.toFixed(2)}`,
        });
        return;
      }
    }

    const transaction = await Transaction.create({
      userId: req.userId,
      type,
      category,
      amount,
      note,
      date: date ? new Date(date) : new Date(),
    });

    const newBalance = await getUserBalance(req.userId!);
    const user = await User.findById(req.userId).select('minBalance');
    const belowMinBalance = user ? newBalance < user.minBalance : false;

    res.status(201).json({ transaction, newBalance, belowMinBalance });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

// DELETE /api/transactions/:id
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const transaction = await Transaction.findOne({ _id: req.params.id, userId: req.userId });
    if (!transaction) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    // If deleting income, ensure balance doesn't go negative
    if (transaction.type === 'income') {
      const currentBalance = await getUserBalance(req.userId!);
      if (currentBalance - transaction.amount < 0) {
        res.status(400).json({ error: 'Cannot delete: would result in negative balance' });
        return;
      }
    }

    await transaction.deleteOne();
    const newBalance = await getUserBalance(req.userId!);
    res.json({ message: 'Transaction deleted', newBalance });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

// GET /api/transactions/summary — dashboard totals
router.get('/summary', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await Transaction.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(req.userId!) } },
      {
        $group: {
          _id: null,
          totalIncome: { $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] } },
          totalExpense: { $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] } },
          count: { $sum: 1 },
        },
      },
    ]);

    const user = await User.findById(req.userId).select('minBalance currency');
    const summary = result[0] || { totalIncome: 0, totalExpense: 0, count: 0 };
    const balance = summary.totalIncome - summary.totalExpense;

    res.json({
      totalIncome: summary.totalIncome,
      totalExpense: summary.totalExpense,
      balance,
      transactionCount: summary.count,
      minBalance: user?.minBalance || 0,
      currency: user?.currency || '₹',
      belowMinBalance: balance < (user?.minBalance || 0),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get summary' });
  }
});

export default router;