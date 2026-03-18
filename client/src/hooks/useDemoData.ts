import { useEffect, useState } from 'react';
import { useDemo } from '@/contexts/DemoContext';

export const DEMO_CATEGORIES = [
  { id: 1, userId: 999, name: 'Salary', type: 'income', color: '#10b981', icon: 'briefcase', createdAt: new Date(), updatedAt: new Date() },
  { id: 2, userId: 999, name: 'Freelance', type: 'income', color: '#3b82f6', icon: 'code', createdAt: new Date(), updatedAt: new Date() },
  { id: 3, userId: 999, name: 'Groceries', type: 'expense', color: '#f59e0b', icon: 'shopping-cart', createdAt: new Date(), updatedAt: new Date() },
  { id: 4, userId: 999, name: 'Utilities', type: 'expense', color: '#ef4444', icon: 'zap', createdAt: new Date(), updatedAt: new Date() },
  { id: 5, userId: 999, name: 'Entertainment', type: 'expense', color: '#8b5cf6', icon: 'film', createdAt: new Date(), updatedAt: new Date() },
  { id: 6, userId: 999, name: 'Transport', type: 'expense', color: '#06b6d4', icon: 'car', createdAt: new Date(), updatedAt: new Date() },
  { id: 7, userId: 999, name: 'Dining', type: 'expense', color: '#ec4899', icon: 'utensils', createdAt: new Date(), updatedAt: new Date() },
];

export const DEMO_TRANSACTIONS = [
  { id: 1, userId: 999, categoryId: 1, type: 'income', amount: '5000', date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), description: 'Monthly salary', createdAt: new Date(), updatedAt: new Date() },
  { id: 2, userId: 999, categoryId: 3, type: 'expense', amount: '120.50', date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), description: 'Weekly groceries', createdAt: new Date(), updatedAt: new Date() },
  { id: 3, userId: 999, categoryId: 4, type: 'expense', amount: '85.00', date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), description: 'Electric bill', createdAt: new Date(), updatedAt: new Date() },
  { id: 4, userId: 999, categoryId: 7, type: 'expense', amount: '45.99', date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), description: 'Dinner with friends', createdAt: new Date(), updatedAt: new Date() },
  { id: 5, userId: 999, categoryId: 5, type: 'expense', amount: '29.99', date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), description: 'Movie tickets', createdAt: new Date(), updatedAt: new Date() },
  { id: 6, userId: 999, categoryId: 6, type: 'expense', amount: '60.00', date: new Date(), description: 'Gas', createdAt: new Date(), updatedAt: new Date() },
  { id: 7, userId: 999, categoryId: 3, type: 'expense', amount: '95.30', date: new Date(), description: 'Groceries', createdAt: new Date(), updatedAt: new Date() },
];

export const DEMO_WISHLIST = [
  { id: 1, userId: 999, name: 'Laptop', estimatedPrice: '1500', priority: 'high', description: 'For work and gaming', targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), purchased: false, createdAt: new Date(), updatedAt: new Date() },
  { id: 2, userId: 999, name: 'Headphones', estimatedPrice: '250', priority: 'medium', description: 'Noise-cancelling', targetDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), purchased: false, createdAt: new Date(), updatedAt: new Date() },
  { id: 3, userId: 999, name: 'Vacation', estimatedPrice: '3000', priority: 'high', description: 'Summer trip', targetDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), purchased: false, createdAt: new Date(), updatedAt: new Date() },
];

export const DEMO_GOALS = [
  { id: 1, userId: 999, name: 'Emergency Fund', targetAmount: '10000', currentAmount: '3500', targetDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), description: '6 months of expenses', createdAt: new Date(), updatedAt: new Date() },
  { id: 2, userId: 999, name: 'Vacation Fund', targetAmount: '5000', currentAmount: '1200', targetDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), description: 'Summer getaway', createdAt: new Date(), updatedAt: new Date() },
];

export const DEMO_BUDGETS = [
  { id: 1, userId: 999, categoryId: 3, monthlyLimit: '400', alertThreshold: 80, createdAt: new Date(), updatedAt: new Date() },
  { id: 2, userId: 999, categoryId: 7, monthlyLimit: '300', alertThreshold: 75, createdAt: new Date(), updatedAt: new Date() },
  { id: 3, userId: 999, categoryId: 5, monthlyLimit: '150', alertThreshold: 80, createdAt: new Date(), updatedAt: new Date() },
];

export const DEMO_RECURRING = [
  { id: 1, userId: 999, categoryId: 1, type: 'income', amount: '5000', frequency: 'monthly', nextOccurrence: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), lastOccurrence: new Date(), description: 'Monthly salary', active: true, createdAt: new Date(), updatedAt: new Date() },
  { id: 2, userId: 999, categoryId: 4, type: 'expense', amount: '85', frequency: 'monthly', nextOccurrence: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), lastOccurrence: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), description: 'Electric bill', active: true, createdAt: new Date(), updatedAt: new Date() },
];

export function useDemoData() {
  const { isDemoMode } = useDemo();
  const [demoData, setDemoData] = useState({
    categories: DEMO_CATEGORIES,
    transactions: DEMO_TRANSACTIONS,
    wishlist: DEMO_WISHLIST,
    goals: DEMO_GOALS,
    budgets: DEMO_BUDGETS,
    recurring: DEMO_RECURRING,
  });

  useEffect(() => {
    if (isDemoMode) {
      // Load demo data from localStorage if it exists
      const saved = localStorage.getItem('finance-tracker-demo-data');
      if (saved) {
        try {
          setDemoData(JSON.parse(saved));
        } catch (e) {
          // Use default demo data
        }
      }
    }
  }, [isDemoMode]);

  const saveDemoData = (newData: typeof demoData) => {
    setDemoData(newData);
    localStorage.setItem('finance-tracker-demo-data', JSON.stringify(newData));
  };

  return { demoData, saveDemoData };
}
