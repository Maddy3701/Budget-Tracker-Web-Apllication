"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const models_1 = require("../models");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.protect);
// GET /api/goals
router.get('/', async (req, res) => {
    try {
        const goals = await models_1.Goal.find({ userId: req.userId }).sort({ createdAt: -1 });
        res.json(goals);
    }
    catch {
        res.status(500).json({ error: 'Failed to fetch goals' });
    }
});
// POST /api/goals
router.post('/', [
    (0, express_validator_1.body)('name').trim().isLength({ min: 1, max: 200 }),
    (0, express_validator_1.body)('targetAmount').isFloat({ min: 1 }),
    (0, express_validator_1.body)('emoji').optional().isString().isLength({ max: 10 }),
    (0, express_validator_1.body)('deadline').optional().isISO8601(),
], async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }
    try {
        const { name, targetAmount, emoji, deadline } = req.body;
        const goal = await models_1.Goal.create({
            userId: req.userId,
            name,
            targetAmount,
            emoji: emoji || '🎯',
            deadline: deadline ? new Date(deadline) : undefined,
        });
        res.status(201).json(goal);
    }
    catch {
        res.status(500).json({ error: 'Failed to create goal' });
    }
});
// PATCH /api/goals/:id/complete
router.patch('/:id/complete', async (req, res) => {
    try {
        const goal = await models_1.Goal.findOneAndUpdate({ _id: req.params.id, userId: req.userId }, { completed: true, completedAt: new Date() }, { new: true });
        if (!goal) {
            res.status(404).json({ error: 'Goal not found' });
            return;
        }
        res.json(goal);
    }
    catch {
        res.status(500).json({ error: 'Failed to complete goal' });
    }
});
// DELETE /api/goals/:id
router.delete('/:id', async (req, res) => {
    try {
        const goal = await models_1.Goal.findOneAndDelete({ _id: req.params.id, userId: req.userId });
        if (!goal) {
            res.status(404).json({ error: 'Goal not found' });
            return;
        }
        res.json({ message: 'Goal deleted' });
    }
    catch {
        res.status(500).json({ error: 'Failed to delete goal' });
    }
});
exports.default = router;
