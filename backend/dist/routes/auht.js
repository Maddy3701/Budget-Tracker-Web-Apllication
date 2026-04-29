"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const models_1 = require("../models");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// POST /api/auth/register
router.post('/register', [
    (0, express_validator_1.body)('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
    (0, express_validator_1.body)('email').isEmail().normalizeEmail().withMessage('Invalid email'),
    (0, express_validator_1.body)('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
], async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }
    try {
        const { name, email, password } = req.body;
        const existing = await models_1.User.findOne({ email });
        if (existing) {
            res.status(409).json({ error: 'Email already registered' });
            return;
        }
        const user = await models_1.User.create({ name, email, password });
        const token = (0, auth_1.generateToken)(user._id.toString());
        res.status(201).json({
            token,
            user: { id: user._id, name: user.name, email: user.email, minBalance: user.minBalance, currency: user.currency },
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Registration failed' });
    }
});
// POST /api/auth/login
router.post('/login', [
    (0, express_validator_1.body)('email').isEmail().normalizeEmail(),
    (0, express_validator_1.body)('password').notEmpty(),
], async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }
    try {
        const { email, password } = req.body;
        const user = await models_1.User.findOne({ email });
        if (!user || !(await user.comparePassword(password))) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }
        const token = (0, auth_1.generateToken)(user._id.toString());
        res.json({
            token,
            user: { id: user._id, name: user.name, email: user.email, minBalance: user.minBalance, currency: user.currency },
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Login failed' });
    }
});
// GET /api/auth/me
router.get('/me', auth_1.protect, (req, res) => {
    const u = req.user;
    res.json({ id: u._id, name: u.name, email: u.email, minBalance: u.minBalance, currency: u.currency });
});
exports.default = router;
