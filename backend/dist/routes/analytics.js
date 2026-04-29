"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mongoose_1 = __importDefault(require("mongoose"));
const models_1 = require("../models");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.protect);
// GET /api/analytics/daily?year=2024&month=3
router.get('/daily', async (req, res) => {
    try {
        const now = new Date();
        const year = parseInt(req.query.year) || now.getFullYear();
        const month = parseInt(req.query.month) || now.getMonth() + 1;
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0, 23, 59, 59);
        const data = await models_1.Transaction.aggregate([
            {
                $match: {
                    userId: new mongoose_1.default.Types.ObjectId(req.userId),
                    date: { $gte: start, $lte: end },
                },
            },
            {
                $group: {
                    _id: { day: { $dayOfMonth: '$date' }, type: '$type' },
                    total: { $sum: '$amount' },
                },
            },
            { $sort: { '_id.day': 1 } },
        ]);
        // Build a full month map
        const daysInMonth = new Date(year, month, 0).getDate();
        const result = Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const income = data.find(d => d._id.day === day && d._id.type === 'income')?.total || 0;
            const expense = data.find(d => d._id.day === day && d._id.type === 'expense')?.total || 0;
            return { day, income, expense };
        });
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to get daily analytics' });
    }
});
// GET /api/analytics/weekly?year=2024
router.get('/weekly', async (req, res) => {
    try {
        const year = parseInt(req.query.year) || new Date().getFullYear();
        const start = new Date(year, 0, 1);
        const end = new Date(year, 11, 31, 23, 59, 59);
        const data = await models_1.Transaction.aggregate([
            {
                $match: {
                    userId: new mongoose_1.default.Types.ObjectId(req.userId),
                    date: { $gte: start, $lte: end },
                },
            },
            {
                $group: {
                    _id: { week: { $isoWeek: '$date' }, type: '$type' },
                    total: { $sum: '$amount' },
                },
            },
            { $sort: { '_id.week': 1 } },
        ]);
        // Last 12 weeks
        const weeks = Array.from({ length: 12 }, (_, i) => i + 1);
        const result = weeks.map(week => ({
            week: `W${week}`,
            income: data.find(d => d._id.week === week && d._id.type === 'income')?.total || 0,
            expense: data.find(d => d._id.week === week && d._id.type === 'expense')?.total || 0,
        }));
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to get weekly analytics' });
    }
});
// GET /api/analytics/monthly?year=2024
router.get('/monthly', async (req, res) => {
    try {
        const year = parseInt(req.query.year) || new Date().getFullYear();
        const start = new Date(year, 0, 1);
        const end = new Date(year, 11, 31, 23, 59, 59);
        const data = await models_1.Transaction.aggregate([
            {
                $match: {
                    userId: new mongoose_1.default.Types.ObjectId(req.userId),
                    date: { $gte: start, $lte: end },
                },
            },
            {
                $group: {
                    _id: { month: { $month: '$date' }, type: '$type' },
                    total: { $sum: '$amount' },
                },
            },
            { $sort: { '_id.month': 1 } },
        ]);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const result = months.map((name, i) => ({
            month: name,
            income: data.find(d => d._id.month === i + 1 && d._id.type === 'income')?.total || 0,
            expense: data.find(d => d._id.month === i + 1 && d._id.type === 'expense')?.total || 0,
        }));
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to get monthly analytics' });
    }
});
// GET /api/analytics/category-breakdown
router.get('/category-breakdown', async (req, res) => {
    try {
        const data = await models_1.Transaction.aggregate([
            {
                $match: {
                    userId: new mongoose_1.default.Types.ObjectId(req.userId),
                    type: 'expense',
                },
            },
            {
                $group: {
                    _id: '$category',
                    total: { $sum: '$amount' },
                    count: { $sum: 1 },
                },
            },
            { $sort: { total: -1 } },
        ]);
        res.json(data.map(d => ({ category: d._id, total: d.total, count: d.count })));
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to get category breakdown' });
    }
});
exports.default = router;
