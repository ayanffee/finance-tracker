import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, CheckCircle2, Circle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useDemo } from "@/contexts/DemoContext";
import { useDemoData } from "@/hooks/useDemoData";

export default function Wishlist() {
  const { isDemoMode } = useDemo();
  const { demoData } = useDemoData();
  const { data: _wishlistItems = [], refetch } = trpc.wishlist.list.useQuery(undefined, { enabled: !isDemoMode });
  const { data: _transactions = [] } = trpc.transactions.list.useQuery(undefined, { enabled: !isDemoMode });
  const wishlistItems = isDemoMode ? demoData.wishlist : _wishlistItems;
  const transactions = isDemoMode ? demoData.transactions : _transactions;
  const createMutation = trpc.wishlist.create.useMutation();
  const updateMutation = trpc.wishlist.update.useMutation();
  const deleteMutation = trpc.wishlist.delete.useMutation();

  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    estimatedPrice: '',
    priority: 'medium',
    description: '',
    targetDate: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isDemoMode) {
      toast.info('Sign in to save wishlist items');
      setOpen(false);
      return;
    }

    if (!formData.name || !formData.estimatedPrice) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      await createMutation.mutateAsync({
        name: formData.name,
        estimatedPrice: formData.estimatedPrice,
        priority: formData.priority as 'low' | 'medium' | 'high',
        description: formData.description || undefined,
        targetDate: formData.targetDate ? new Date(formData.targetDate) : undefined,
      });

      toast.success('Wishlist item added');
      setFormData({
        name: '',
        estimatedPrice: '',
        priority: 'medium',
        description: '',
        targetDate: '',
      });
      setOpen(false);
      refetch();
    } catch (error) {
      toast.error('Failed to add wishlist item');
    }
  };

  const handleTogglePurchased = async (item: any) => {
    if (isDemoMode) {
      toast.info('Sign in to update wishlist items');
      return;
    }
    try {
      await updateMutation.mutateAsync({
        id: item.id,
        purchased: !item.purchased,
      });
      refetch();
    } catch (error) {
      toast.error('Failed to update item');
    }
  };

  const handleDelete = async (id: number) => {
    if (isDemoMode) {
      toast.info('Sign in to delete wishlist items');
      return;
    }
    try {
      await deleteMutation.mutateAsync({ id });
      toast.success('Item deleted');
      refetch();
    } catch (error) {
      toast.error('Failed to delete item');
    }
  };

  // Calculate financial projections
  const totalWishlistPrice = wishlistItems
    .filter(item => !item.purchased)
    .reduce((sum, item) => sum + parseFloat(item.estimatedPrice), 0);

  const monthlyIncome = transactions
    .filter(t => t.type === 'income' && new Date(t.date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);

  const monthlyExpenses = transactions
    .filter(t => t.type === 'expense' && new Date(t.date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);

  const monthlyNetIncome = monthlyIncome - monthlyExpenses;
  const monthsToAfford = monthlyNetIncome > 0 ? Math.ceil(totalWishlistPrice / monthlyNetIncome) : Infinity;

  const priorityItems = {
    high: wishlistItems.filter(item => item.priority === 'high' && !item.purchased),
    medium: wishlistItems.filter(item => item.priority === 'medium' && !item.purchased),
    low: wishlistItems.filter(item => item.priority === 'low' && !item.purchased),
    purchased: wishlistItems.filter(item => item.purchased),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Wishlist</h1>
          <p className="text-muted-foreground mt-2">Track things you want to buy</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add to Wishlist</DialogTitle>
              <DialogDescription>Add something you want to buy later</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Item Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., New laptop"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="price">Estimated Price</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.estimatedPrice}
                  onChange={(e) => setFormData({ ...formData, estimatedPrice: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="targetDate">Target Date (Optional)</Label>
                <Input
                  id="targetDate"
                  type="date"
                  value={formData.targetDate}
                  onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Why do you want this?"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Adding...' : 'Add to Wishlist'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Financial Projections */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800">
        <CardHeader>
          <CardTitle>Financial Projections</CardTitle>
          <CardDescription>How long to afford your wishlist</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Wishlist Value</p>
              <p className="text-2xl font-bold">${totalWishlistPrice.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Monthly Net Income</p>
              <p className={`text-2xl font-bold ${monthlyNetIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${monthlyNetIncome.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Months to Afford All</p>
              <p className="text-2xl font-bold">
                {monthsToAfford === Infinity ? '∞' : monthsToAfford}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Wishlist Items by Priority */}
      <div className="space-y-4">
        {/* High Priority */}
        {priorityItems.high.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-red-600">High Priority</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {priorityItems.high.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                  <div className="flex items-center gap-3 flex-1">
                    <button onClick={() => handleTogglePurchased(item)}>
                      <Circle className="h-5 w-5 text-red-600" />
                    </button>
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold">${parseFloat(item.estimatedPrice).toFixed(2)}</p>
                      {item.targetDate && (
                        <p className="text-xs text-muted-foreground">
                          Target: {new Date(item.targetDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
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
              ))}
            </CardContent>
          </Card>
        )}

        {/* Medium Priority */}
        {priorityItems.medium.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-yellow-600">Medium Priority</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {priorityItems.medium.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                  <div className="flex items-center gap-3 flex-1">
                    <button onClick={() => handleTogglePurchased(item)}>
                      <Circle className="h-5 w-5 text-yellow-600" />
                    </button>
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold">${parseFloat(item.estimatedPrice).toFixed(2)}</p>
                      {item.targetDate && (
                        <p className="text-xs text-muted-foreground">
                          Target: {new Date(item.targetDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
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
              ))}
            </CardContent>
          </Card>
        )}

        {/* Low Priority */}
        {priorityItems.low.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-green-600">Low Priority</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {priorityItems.low.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                  <div className="flex items-center gap-3 flex-1">
                    <button onClick={() => handleTogglePurchased(item)}>
                      <Circle className="h-5 w-5 text-green-600" />
                    </button>
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold">${parseFloat(item.estimatedPrice).toFixed(2)}</p>
                      {item.targetDate && (
                        <p className="text-xs text-muted-foreground">
                          Target: {new Date(item.targetDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
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
              ))}
            </CardContent>
          </Card>
        )}

        {/* Purchased Items */}
        {priorityItems.purchased.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-green-600">Purchased</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {priorityItems.purchased.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg opacity-60">
                  <div className="flex items-center gap-3 flex-1">
                    <button onClick={() => handleTogglePurchased(item)}>
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    </button>
                    <div>
                      <p className="font-medium line-through">{item.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="font-semibold">${parseFloat(item.estimatedPrice).toFixed(2)}</p>
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
              ))}
            </CardContent>
          </Card>
        )}

        {wishlistItems.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No wishlist items yet. Start adding things you want to buy!
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
