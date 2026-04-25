import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, AlertCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useDemo } from "@/contexts/DemoContext";
import { useDemoData } from "@/hooks/useDemoData";

export default function Budgets() {
  const { isDemoMode } = useDemo();
  const { demoData, saveDemoData } = useDemoData();
  const { data: _budgets = [], refetch } = trpc.budgets.list.useQuery(undefined, { enabled: !isDemoMode });
  const { data: _categories = [] } = trpc.categories.list.useQuery(undefined, { enabled: !isDemoMode });
  const { data: _transactions = [] } = trpc.transactions.list.useQuery(undefined, { enabled: !isDemoMode });
  const budgets = isDemoMode ? demoData.budgets : _budgets;
  const categories = isDemoMode ? demoData.categories : _categories;
  const transactions = isDemoMode ? demoData.transactions : _transactions;
  const createMutation = trpc.budgets.create.useMutation();
  const deleteMutation = trpc.budgets.delete.useMutation();

  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    categoryId: '',
    monthlyLimit: '',
    alertThreshold: '80',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.categoryId || !formData.monthlyLimit) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (isDemoMode) {
      const newBudget = {
        id: Date.now(),
        userId: 999,
        categoryId: parseInt(formData.categoryId),
        monthlyLimit: formData.monthlyLimit,
        alertThreshold: parseInt(formData.alertThreshold),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      saveDemoData({ ...demoData, budgets: [...demoData.budgets, newBudget as any] });
      toast.success('Budget created successfully');
      setFormData({ categoryId: '', monthlyLimit: '', alertThreshold: '80' });
      setOpen(false);
      return;
    }

    try {
      await createMutation.mutateAsync({
        categoryId: parseInt(formData.categoryId),
        monthlyLimit: formData.monthlyLimit,
        alertThreshold: parseInt(formData.alertThreshold),
      });

      toast.success('Budget created successfully');
      setFormData({
        categoryId: '',
        monthlyLimit: '',
        alertThreshold: '80',
      });
      setOpen(false);
      refetch();
    } catch (error) {
      toast.error('Failed to create budget');
    }
  };

  const handleDelete = async (id: number) => {
    if (isDemoMode) {
      saveDemoData({ ...demoData, budgets: demoData.budgets.filter(b => b.id !== id) });
      toast.success('Budget deleted');
      return;
    }
    try {
      await deleteMutation.mutateAsync({ id });
      toast.success('Budget deleted');
      refetch();
    } catch (error) {
      toast.error('Failed to delete budget');
    }
  };

  // Calculate spending per category for this month
  const getCurrentMonthSpending = (categoryId: number) => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    return transactions
      .filter(t => 
        t.categoryId === categoryId && 
        t.type === 'expense' && 
        new Date(t.date) >= monthStart
      )
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
  };

  const categoryMap = Object.fromEntries(categories.map(c => [c.id, c]));
  const expenseCategories = categories.filter(c => c.type === 'expense');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Budget & Alerts</h1>
          <p className="text-muted-foreground mt-2">Set monthly spending limits and get alerts</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Set Budget
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Budget</DialogTitle>
              <DialogDescription>Set a monthly spending limit for a category</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="category">Category</Label>
                <Select value={formData.categoryId} onValueChange={(value) => setFormData({ ...formData, categoryId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="limit">Monthly Limit</Label>
                <Input
                  id="limit"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.monthlyLimit}
                  onChange={(e) => setFormData({ ...formData, monthlyLimit: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="threshold">Alert Threshold (%)</Label>
                <Input
                  id="threshold"
                  type="number"
                  min="1"
                  max="100"
                  value={formData.alertThreshold}
                  onChange={(e) => setFormData({ ...formData, alertThreshold: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">Alert when spending reaches this % of budget</p>
              </div>

              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Budget'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Budgets List */}
      <div className="space-y-4">
        {budgets.length > 0 ? (
          budgets.map((budget) => {
            const spending = getCurrentMonthSpending(budget.categoryId);
            const limit = parseFloat(budget.monthlyLimit);
            const percentage = (spending / limit) * 100;
            const isAlert = percentage >= budget.alertThreshold;
            const isExceeded = percentage >= 100;

            return (
              <Card key={budget.id} className={isExceeded ? 'border-red-500 bg-red-50 dark:bg-red-950' : isAlert ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isAlert && <AlertCircle className={`h-5 w-5 ${isExceeded ? 'text-red-600' : 'text-yellow-600'}`} />}
                      <CardTitle className="text-lg">{categoryMap[budget.categoryId]?.name ?? `Category ${budget.categoryId}`}</CardTitle>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(budget.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Spending</span>
                      <span className={`font-semibold ${isExceeded ? 'text-red-600' : 'text-foreground'}`}>
                        ${spending.toFixed(2)} / ${limit.toFixed(2)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          isExceeded ? 'bg-red-600' : isAlert ? 'bg-yellow-600' : 'bg-green-600'
                        }`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      ></div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {percentage.toFixed(0)}% of budget used
                      {isAlert && (
                        <span className={`ml-2 ${isExceeded ? 'text-red-600 font-semibold' : 'text-yellow-600 font-semibold'}`}>
                          {isExceeded ? '⚠️ Budget exceeded!' : `⚠️ Alert at ${budget.alertThreshold}%`}
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No budgets set yet. Create your first budget to start tracking spending!
            </CardContent>
          </Card>
        )}
      </div>

      {/* Budget Tips */}
      <Card>
        <CardHeader>
          <CardTitle>Budget Tips</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>Set realistic budgets based on your spending patterns. Common approach:</p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>Review your last 3 months of spending per category</li>
            <li>Set budgets 10-15% lower than your average to encourage savings</li>
            <li>Adjust alert threshold to get notified early (e.g., 70-80%)</li>
            <li>Review budgets monthly and adjust as needed</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
