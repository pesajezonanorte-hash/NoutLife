export type TransactionType = 'INCOME' | 'EXPENSE';
export type TransactionCategory =
  | 'FOOD'
  | 'TRANSPORT'
  | 'ENTERTAINMENT'
  | 'SAVINGS'
  | 'INVESTMENT'
  | 'HEALTH'
  | 'EDUCATION'
  | 'CLOTHING'
  | 'UTILITIES'
  | 'HOUSING'
  | 'SUBSCRIPTIONS'
  | 'SALARY'
  | 'FREELANCE'
  | 'BUSINESS'
  | 'SALES'
  | 'GIFT'
  | 'RENTAL'
  | 'OTHER';

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  currency: string;
  category: TransactionCategory;
  description?: string;
  date: string;
  createdAt: string;
}

export interface Budget {
  id: string;
  userId: string;
  category: TransactionCategory;
  amount: number;
  month: number;
  year: number;
  currency: string;
  spent?: number;
}

export interface FinancialGoal {
  id: string;
  userId: string;
  title: string;
  description?: string;
  targetAmount: number;
  currentAmount: number;
  currency: string;
  deadline?: string;
  isCompleted: boolean;
}
