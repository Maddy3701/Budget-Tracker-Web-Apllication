"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const models_1 = require("../models");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.protect);
// PATCH /api/settings
router.patch('/', [
    (0, express_validator_1.body)('minBalance').optional().isFloat({ min: 0 }),
    (0, express_validator_1.body)('currency').optional().isString().isLength({ max: 5 }),
    (0, express_validator_1.body)('name').optional().trim().isLength({ min: 2, max: 100 }),
], async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }
    try {
        const updates = {};
        if (req.body.minBalance !== undefined)
            updates.minBalance = req.body.minBalance;
        if (req.body.currency)
            updates.currency = req.body.currency;
        if (req.body.name)
            updates.name = req.body.name;
        const user = await models_1.User.findByIdAndUpdate(req.userId, updates, { new: true }).select('-password');
        res.json({ id: user._id, name: user.name, email: user.email, minBalance: user.minBalance, currency: user.currency });
    }
    catch {
        res.status(500).json({ error: 'Failed to update settings' });
    }
});
exports.default = router;
