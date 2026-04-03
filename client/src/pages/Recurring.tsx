import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Recurring() {
  const { data: recurring = [], refetch } = trpc.recurring.list.useQuery();
  const { data: categories = [] } = trpc.categories.list.useQuery();
  const createMutation = trpc.recurring.create.useMutation();
  const updateMutation = trpc.recurring.update.useMutation();
  const deleteMutation = trpc.recurring.delete.useMutation();

  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    type: 'expense',
    categoryId: '',
    amount: '',
    frequency: 'monthly',
    nextOccurrence: new Date().toISOString().split('T')[0],
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
        frequency: formData.frequency as any,
        nextOccurrence: new Date(formData.nextOccurrence),
        description: formData.description || undefined,
      });

      toast.success('Recurring transaction created');
      setFormData({
        type: 'expense',
        categoryId: '',
        amount: '',
        frequency: 'monthly',
        nextOccurrence: new Date().toISOString().split('T')[0],
        description: '',
      });
      setOpen(false);
      refetch();
    } catch (error) {
      toast.error('Failed to create recurring transaction');
    }
  };

  const handleToggleActive = async (item: any) => {
    try {
      await updateMutation.mutateAsync({
        id: item.id,
        active: !item.active,
      });
      refetch();
    } catch (error) {
      toast.error('Failed to update transaction');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync({ id });
      toast.success('Recurring transaction deleted');
      refetch();
    } catch (error) {
      toast.error('Failed to delete transaction');
    }
  };

  const categoryMap = Object.fromEntries(categories.map(c => [c.id, c]));
  const relevantCategories = categories.filter(c => c.type === formData.type);

  const frequencyLabels: Record<string, string> = {
    daily: 'Daily',
    weekly: 'Weekly',
    biweekly: 'Every 2 weeks',
    monthly: 'Monthly',
    quarterly: 'Quarterly',
    yearly: 'Yearly',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Recurring Transactions</h1>
          <p className="text-muted-foreground mt-2">Set up automatic income and expenses</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Recurring
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Recurring Transaction</DialogTitle>
              <DialogDescription>Set up a transaction that repeats automatically</DialogDescription>
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
                <Label htmlFor="frequency">Frequency</Label>
                <Select value={formData.frequency} onValueChange={(value) => setFormData({ ...formData, frequency: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="biweekly">Every 2 weeks</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="nextOccurrence">Next Occurrence</Label>
                <Input
                  id="nextOccurrence"
                  type="date"
                  value={formData.nextOccurrence}
                  onChange={(e) => setFormData({ ...formData, nextOccurrence: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="e.g., Monthly rent, Salary deposit"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Recurring'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Recurring Transactions List */}
      <div className="space-y-4">
        {recurring.length > 0 ? (
          recurring.map((item) => (
            <Card key={item.id} className={!item.active ? 'opacity-50' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{item.description || 'Recurring Transaction'}</CardTitle>
                    <CardDescription>
                      {frequencyLabels[item.frequency as keyof typeof frequencyLabels]} • Next: {new Date(item.nextOccurrence).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggleActive(item)}
                      disabled={updateMutation.isPending}
                    >
                      {item.active ? (
                        <ToggleRight className="h-5 w-5 text-green-600" />
                      ) : (
                        <ToggleLeft className="h-5 w-5 text-gray-400" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(item.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {categoryMap[item.categoryId]?.name ?? `Category ${item.categoryId}`}
                  </div>
                  <div className={`text-lg font-semibold ${item.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                    {item.type === 'income' ? '+' : '-'}${parseFloat(item.amount).toFixed(2)}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No recurring transactions set up yet. Create one to automate your finances!
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tips */}
      <Card>
        <CardHeader>
          <CardTitle>Common Recurring Transactions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>Examples of transactions to set as recurring:</p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li><strong>Income:</strong> Salary, freelance payments, investment returns</li>
            <li><strong>Expenses:</strong> Rent, utilities, subscriptions, insurance, gym membership</li>
            <li>Once set, these will appear in your transaction history automatically</li>
            <li>Toggle on/off to pause without deleting</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
