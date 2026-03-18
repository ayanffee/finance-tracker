import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Transactions() {
  const { data: transactions = [], refetch } = trpc.transactions.list.useQuery();
  const { data: categories = [] } = trpc.categories.list.useQuery();
  const createMutation = trpc.transactions.create.useMutation();
  const deleteMutation = trpc.transactions.delete.useMutation();

  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    type: 'expense',
    categoryId: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.categoryId || !formData.amount) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      await createMutation.mutateAsync({
        categoryId: parseInt(formData.categoryId),
        type: formData.type as 'income' | 'expense',
        amount: formData.amount,
        date: new Date(formData.date),
        description: formData.description || undefined,
      });

      toast.success('Transaction added successfully');
      setFormData({
        type: 'expense',
        categoryId: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
      });
      setOpen(false);
      refetch();
    } catch (error) {
      toast.error('Failed to add transaction');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync({ id });
      toast.success('Transaction deleted');
      refetch();
    } catch (error) {
      toast.error('Failed to delete transaction');
    }
  };

  const expenseCategories = categories.filter(c => c.type === 'expense');
  const incomeCategories = categories.filter(c => c.type === 'income');
  const relevantCategories = formData.type === 'income' ? incomeCategories : expenseCategories;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground mt-2">Manage your income and expenses</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Transaction
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Transaction</DialogTitle>
              <DialogDescription>Record a new income or expense</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="type">Type</Label>
                <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value, categoryId: '' })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="category">Category</Label>
                <Select value={formData.categoryId} onValueChange={(value) => setFormData({ ...formData, categoryId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {relevantCategories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Optional description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Adding...' : 'Add Transaction'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Transactions List */}
      <Card>
        <CardHeader>
          <CardTitle>All Transactions</CardTitle>
          <CardDescription>Your complete transaction history</CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length > 0 ? (
            <div className="space-y-2">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-medium">{transaction.description || 'Transaction'}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(transaction.date).toLocaleDateString()} • Category {transaction.categoryId}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className={`text-lg font-semibold ${transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                      {transaction.type === 'income' ? '+' : '-'}${parseFloat(transaction.amount).toFixed(2)}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(transaction.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No transactions yet. Add your first transaction to get started!
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
