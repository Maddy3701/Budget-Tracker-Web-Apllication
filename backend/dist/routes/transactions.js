"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const mongoose_1 = __importDefault(require("mongoose"));
const models_1 = require("../models");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.protect);
// Helper: compute current balance for a user
const getUserBalance = async (userId) => {
    const result = await models_1.Transaction.aggregate([
        { $match: { userId: new mongoose_1.default.Types.ObjectId(userId) } },
        {
            $group: {
                _id: null,
                income: { $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] } },
                expense: { $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] } },
            },
        },
    ]);
    if (!result.length)
        return 0;
    return result[0].income - result[0].expense;
};
// GET /api/transactions
router.get('/', [
    (0, express_validator_1.query)('page').optional().isInt({ min: 1 }),
    (0, express_validator_1.query)('limit').optional().isInt({ min: 1, max: 100 }),
    (0, express_validator_1.query)('type').optional().isIn(['income', 'expense']),
    (0, express_validator_1.query)('category').optional().isString(),
    (0, express_validator_1.query)('startDate').optional().isISO8601(),
    (0, express_validator_1.query)('endDate').optional().isISO8601(),
], async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const filter = { userId: req.userId };
        if (req.query.type)
            filter.type = req.query.type;
        if (req.query.category)
            filter.category = req.query.category;
        if (req.query.startDate || req.query.endDate) {
            filter.date = {};
            if (req.query.startDate)
                filter.date.$gte = new Date(req.query.startDate);
            if (req.query.endDate)
                filter.date.$lte = new Date(req.query.endDate);
        }
        const [transactions, total, balance] = await Promise.all([
            models_1.Transaction.find(filter).sort({ date: -1 }).skip(skip).limit(limit).lean(),
            models_1.Transaction.countDocuments(filter),
            getUserBalance(req.userId),
        ]);
        res.json({ transactions, total, page, pages: Math.ceil(total / limit), balance });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});
// POST /api/transactions
router.post('/', [
    (0, express_validator_1.body)('type').isIn(['income', 'expense']).withMessage('Type must be income or expense'),
    (0, express_validator_1.body)('category').isIn(['Pocket Money', 'Salary', 'Other', 'Food', 'Travel', 'Fun', 'Self']).withMessage('Invalid category'),
    (0, express_validator_1.body)('amount').isFloat({ min: 0.01 }).withMessage('Amount must be positive'),
    (0, express_validator_1.body)('date').optional().isISO8601().withMessage('Invalid date'),
    (0, express_validator_1.body)('note').optional().isString().isLength({ max: 500 }),
], async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }
    try {
        const { type, category, amount, note, date } = req.body;
        // Business rule: expense cannot create negative balance
        if (type === 'expense') {
            const currentBalance = await getUserBalance(req.userId);
            if (currentBalance - amount < 0) {
                res.status(400).json({
                    error: 'Insufficient balance',
                    message: `This transaction would make your balance negative. Current balance: ${currentBalance.toFixed(2)}`,
                });
                return;
            }
        }
        const transaction = await models_1.Transaction.create({
            userId: req.userId,
            type,
            category,
            amount,
            note,
            date: date ? new Date(date) : new Date(),
        });
        const newBalance = await getUserBalance(req.userId);
        const user = await models_1.User.findById(req.userId).select('minBalance');
        const belowMinBalance = user ? newBalance < user.minBalance : false;
        res.status(201).json({ transaction, newBalance, belowMinBalance });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to create transaction' });
    }
});
// DELETE /api/transactions/:id
router.delete('/:id', async (req, res) => {
    try {
        const transaction = await models_1.Transaction.findOne({ _id: req.params.id, userId: req.userId });
        if (!transaction) {
            res.status(404).json({ error: 'Transaction not found' });
            return;
        }
        // If deleting income, ensure balance doesn't go negative
        if (transaction.type === 'income') {
            const currentBalance = await getUserBalance(req.userId);
            if (currentBalance - transaction.amount < 0) {
                res.status(400).json({ error: 'Cannot delete: would result in negative balance' });
                return;
            }
        }
        await transaction.deleteOne();
        const newBalance = await getUserBalance(req.userId);
        res.json({ message: 'Transaction deleted', newBalance });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to delete transaction' });
    }
});
// GET /api/transactions/summary — dashboard totals
router.get('/summary', async (req, res) => {
    try {
        const result = await models_1.Transaction.aggregate([
            { $match: { userId: new mongoose_1.default.Types.ObjectId(req.userId) } },
            {
                $group: {
                    _id: null,
                    totalIncome: { $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] } },
                    totalExpense: { $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] } },
                    count: { $sum: 1 },
                },
            },
        ]);
        const user = await models_1.User.findById(req.userId).select('minBalance currency');
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
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to get summary' });
    }
});
exports.default = router;
