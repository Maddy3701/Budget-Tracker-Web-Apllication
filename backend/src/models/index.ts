import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

// ─── User ───────────────────────────────────────────────────────────────────
export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  minBalance: number;
  currency: string;
  createdAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  minBalance: { type: Number, default: 1000, min: 0 },
  currency: { type: String, default: '₹' },
  createdAt: { type: Date, default: Date.now },
});

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

UserSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

export const User = mongoose.model<IUser>('User', UserSchema);

// ─── Transaction ─────────────────────────────────────────────────────────────
export type TransactionType = 'income' | 'expense';
export type IncomeCategory = 'Pocket Money' | 'Salary' | 'Other';
export type ExpenseCategory = 'Food' | 'Travel' | 'Fun' | 'Self' | 'Other';
export type Category = IncomeCategory | ExpenseCategory;

export interface ITransaction extends Document {
  userId: mongoose.Types.ObjectId;
  type: TransactionType;
  category: Category;
  amount: number;
  note?: string;
  date: Date;
  createdAt: Date;
}

const TransactionSchema = new Schema<ITransaction>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['income', 'expense'], required: true },
  category: {
    type: String,
    enum: ['Pocket Money', 'Salary', 'Other', 'Food', 'Travel', 'Fun', 'Self'],
    required: true,
  },
  amount: { type: Number, required: true, min: 0.01 },
  note: { type: String, trim: true, maxlength: 500 },
  date: { type: Date, required: true, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

// Compound index for efficient analytics queries
TransactionSchema.index({ userId: 1, date: -1 });
TransactionSchema.index({ userId: 1, type: 1, date: -1 });

export const Transaction = mongoose.model<ITransaction>('Transaction', TransactionSchema);

// ─── Goal ────────────────────────────────────────────────────────────────────
export interface IGoal extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  targetAmount: number;
  savedAmount: number;
  deadline?: Date;
  completed: boolean;
  completedAt?: Date;
  emoji: string;
  createdAt: Date;
}

const GoalSchema = new Schema<IGoal>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 200 },
  targetAmount: { type: Number, required: true, min: 1 },
  savedAmount: { type: Number, default: 0, min: 0 },
  deadline: { type: Date },
  completed: { type: Boolean, default: false },
  completedAt: { type: Date },
  emoji: { type: String, default: '🎯' },
  createdAt: { type: Date, default: Date.now },
});

export const Goal = mongoose.model<IGoal>('Goal', GoalSchema);