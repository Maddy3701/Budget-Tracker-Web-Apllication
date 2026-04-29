"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Seed script — populates DB with demo user + sample transactions + goals
 * Run: npm run seed
 */
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const models_1 = require("./models");
dotenv_1.default.config();
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/budget_tracker';
const seed = async () => {
    await mongoose_1.default.connect(MONGO_URI);
    console.log('Connected to MongoDB');
    // Clear existing demo data
    await models_1.User.deleteMany({ email: 'demo@budget.app' });
    const user = await models_1.User.create({
        name: 'Demo User',
        email: 'demo@budget.app',
        password: 'demo1234',
        minBalance: 5000,
        currency: '₹',
    });
    const uid = user._id;
    const now = new Date();
    // Generate 3 months of sample transactions
    const transactions = [];
    for (let m = 0; m < 3; m++) {
        const month = now.getMonth() - m;
        const year = now.getFullYear();
        // Income
        transactions.push({ userId: uid, type: 'income', category: 'Salary', amount: 50000, date: new Date(year, month, 1), note: 'Monthly salary' }, { userId: uid, type: 'income', category: 'Pocket Money', amount: 5000, date: new Date(year, month, 5), note: 'Extra pocket money' });
        // Expenses
        const expenses = [
            { category: 'Food', amounts: [800, 1200, 600, 900, 750, 1100, 850] },
            { category: 'Travel', amounts: [500, 300, 1500, 200] },
            { category: 'Fun', amounts: [2000, 1500, 800] },
            { category: 'Self', amounts: [3000, 1200, 500] },
        ];
        for (const exp of expenses) {
            for (let i = 0; i < exp.amounts.length; i++) {
                transactions.push({
                    userId: uid,
                    type: 'expense',
                    category: exp.category,
                    amount: exp.amounts[i],
                    date: new Date(year, month, (i + 1) * 3),
                    note: `${exp.category} expense`,
                });
            }
        }
    }
    await models_1.Transaction.insertMany(transactions);
    // Goals
    await models_1.Goal.insertMany([
        { userId: uid, name: 'Buy New Laptop', targetAmount: 80000, savedAmount: 35000, emoji: '💻' },
        { userId: uid, name: 'Vacation to Goa', targetAmount: 25000, savedAmount: 10000, emoji: '🏖️', deadline: new Date(now.getFullYear(), now.getMonth() + 3, 1) },
        { userId: uid, name: 'Emergency Fund', targetAmount: 100000, savedAmount: 60000, emoji: '🛡️' },
    ]);
    console.log('✅ Seed complete!');
    console.log('   Email: demo@budget.app');
    console.log('   Password: demo1234');
    await mongoose_1.default.disconnect();
};
seed().catch(console.error);
