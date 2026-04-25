import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil, Sparkles, Loader2, Eye, ArrowUpDown, Search } from "lucide-react";
import { useState, useRef, useMemo } from "react";
import { toast } from "sonner";
import { useDemo } from "@/contexts/DemoContext";
import { useDemoData } from "@/hooks/useDemoData";
import { useAuth } from "@/_core/hooks/useAuth";
import CsvUpload from "@/components/CsvUpload";

export default function Transactions() {
  const { user } = useAuth();
  const { isDemoMode } = useDemo();
  const { demoData, saveDemoData } = useDemoData();
  const { data: _transactions = [], refetch } = trpc.transactions.list.useQuery(undefined, { enabled: !isDemoMode });
  const { data: _categories = [] } = trpc.categories.list.useQuery(undefined, { enabled: !isDemoMode });
  const transactions = isDemoMode ? demoData.transactions : _transactions;
  const categories = isDemoMode ? demoData.categories : _categories;
  const createMutation = trpc.transactions.create.useMutation();
  const updateMutation = trpc.transactions.update.useMutation();
  const deleteMutation = trpc.transactions.delete.useMutation();
  const suggestMutation = trpc.assistant.suggestCategory.useMutation();

  const [open, setOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<typeof transactions[0] | null>(null);
  const [formData, setFormData] = useState({
    type: "expense",
    categoryId: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    description: "",
  });

  // AI auto-categorize state
  const [suggestedCategory, setSuggestedCategory] = useState<{ name: string; id: number } | null>(null);
  const [suggestingCategory, setSuggestingCategory] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetForm = () => {
    setFormData({ type: "expense", categoryId: "", amount: "", date: new Date().toISOString().split("T")[0], description: "" });
    setEditingTransaction(null);
    setSuggestedCategory(null);
  };

  const openEdit = (tx: typeof transactions[0]) => {
    setEditingTransaction(tx);
    setFormData({
      type: tx.type,
      categoryId: tx.categoryId.toString(),
      amount: parseFloat(tx.amount).toString(),
      date: new Date(tx.date).toISOString().split("T")[0],
      description: tx.description ?? "",
    });
    setSuggestedCategory(null);
    setOpen(true);
  };

  const handleDescriptionChange = (value: string) => {
    setFormData(prev => ({ ...prev, description: value }));
    setSuggestedCategory(null);

    // AI auto-suggest needs the server-side Anthropic call. While the
    // backend is offline (demo mode), skip the round-trip entirely so we
    // don't surface 500 errors on every keystroke.
    if (isDemoMode || !user || editingTransaction || value.length < 3) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSuggestingCategory(true);
      try {
        const result = await suggestMutation.mutateAsync({
          description: value,
          type: formData.type as "income" | "expense",
        });
        if (result.categoryName && result.categoryId) {
          setSuggestedCategory({ name: result.categoryName, id: result.categoryId });
        }
      } catch {
        // Silent fail — suggestion is optional
      } finally {
        setSuggestingCategory(false);
      }
    }, 700);
  };

  const applySuggestion = () => {
    if (!suggestedCategory) return;
    setFormData(prev => ({ ...prev, categoryId: suggestedCategory.id.toString() }));
    setSuggestedCategory(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.categoryId || !formData.amount) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (isDemoMode) {
      if (editingTransaction) {
        const updated = demoData.transactions.map(t =>
          t.id === editingTransaction.id
            ? {
                ...t,
                categoryId: parseInt(formData.categoryId),
                amount: formData.amount,
                date: new Date(formData.date),
                description: formData.description || null,
                updatedAt: new Date(),
              }
            : t,
        );
        saveDemoData({ ...demoData, transactions: updated as any });
        toast.success("Transaction updated");
      } else {
        const newTx = {
          id: Date.now(),
          userId: 999,
          categoryId: parseInt(formData.categoryId),
          type: formData.type,
          amount: formData.amount,
          date: new Date(formData.date),
          description: formData.description || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        saveDemoData({
          ...demoData,
          transactions: [newTx as any, ...demoData.transactions],
        });
        toast.success("Transaction added successfully");
      }
      resetForm();
      setOpen(false);
      return;
    }

    try {
      if (editingTransaction) {
        await updateMutation.mutateAsync({
          id: editingTransaction.id,
          categoryId: parseInt(formData.categoryId),
          amount: formData.amount,
          date: new Date(formData.date),
          description: formData.description || undefined,
        });
        toast.success("Transaction updated");
      } else {
        await createMutation.mutateAsync({
          categoryId: parseInt(formData.categoryId),
          type: formData.type as "income" | "expense",
          amount: formData.amount,
          date: new Date(formData.date),
          description: formData.description || undefined,
        });
        toast.success("Transaction added successfully");
      }

      resetForm();
      setOpen(false);
      refetch();
    } catch {
      toast.error(editingTransaction ? "Failed to update transaction" : "Failed to add transaction");
    }
  };

  const handleDelete = async (id: number) => {
    if (isDemoMode) {
      saveDemoData({
        ...demoData,
        transactions: demoData.transactions.filter(t => t.id !== id),
      });
      toast.success("Transaction deleted");
      return;
    }
    try {
      await deleteMutation.mutateAsync({ id });
      toast.success("Transaction deleted");
      refetch();
    } catch {
      toast.error("Failed to delete transaction");
    }
  };

  // Detail view state
  const [detailTransaction, setDetailTransaction] = useState<typeof transactions[0] | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Search & filter
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "income" | "expense">("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  const categoryMap = Object.fromEntries(categories.map(c => [c.id, c]));
  const expenseCategories = categories.filter(c => c.type === "expense");
  const incomeCategories = categories.filter(c => c.type === "income");
  const relevantCategories = formData.type === "income" ? incomeCategories : expenseCategories;

  const filteredTransactions = useMemo(() => {
    let result = [...transactions];

    if (filterType !== "all") {
      result = result.filter(t => t.type === filterType);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t =>
        (t.description ?? "").toLowerCase().includes(q) ||
        (categoryMap[t.categoryId]?.name ?? "").toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      const da = new Date(a.date).getTime();
      const db = new Date(b.date).getTime();
      return sortOrder === "newest" ? db - da : da - db;
    });

    return result;
  }, [transactions, filterType, searchQuery, sortOrder, categoryMap]);

  const openDetail = (tx: typeof transactions[0]) => {
    setDetailTransaction(tx);
    setDetailOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground mt-2">Manage your income and expenses</p>
        </div>
        <div className="flex items-center gap-2">
          {!isDemoMode && <CsvUpload categories={categories} onImported={() => refetch()} />}
          <Dialog open={open} onOpenChange={v => { if (!v) resetForm(); setOpen(v); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Transaction
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingTransaction ? "Edit Transaction" : "Add New Transaction"}</DialogTitle>
              <DialogDescription>{editingTransaction ? "Update this transaction" : "Record a new income or expense"}</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!editingTransaction && (
                <div>
                  <Label htmlFor="type">Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={value => {
                      setFormData({ ...formData, type: value, categoryId: "" });
                      setSuggestedCategory(null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Income</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Description first so AI suggestion informs category */}
              <div>
                <Label htmlFor="description">Description</Label>
                <div className="relative">
                  <Textarea
                    id="description"
                    placeholder="e.g., Netflix, Whole Foods, Monthly salary…"
                    value={formData.description}
                    onChange={e => handleDescriptionChange(e.target.value)}
                  />
                  {suggestingCategory && (
                    <div className="absolute right-2 top-2">
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>
                {suggestedCategory && !formData.categoryId && (
                  <div className="flex items-center gap-2 mt-1">
                    <Sparkles className="h-3 w-3 text-purple-500" />
                    <span className="text-xs text-muted-foreground">AI suggests:</span>
                    <Badge
                      variant="secondary"
                      className="cursor-pointer text-xs hover:bg-purple-100 dark:hover:bg-purple-900 border border-purple-200"
                      onClick={applySuggestion}
                    >
                      {suggestedCategory.name} — Apply
                    </Badge>
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.categoryId}
                  onValueChange={value => {
                    setFormData({ ...formData, categoryId: value });
                    setSuggestedCategory(null);
                  }}
                >
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
                  onChange={e => setFormData({ ...formData, amount: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={e => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingTransaction
                  ? updateMutation.isPending ? "Saving..." : "Save Changes"
                  : createMutation.isPending ? "Adding..." : "Add Transaction"}
              </Button>
            </form>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterType} onValueChange={v => setFilterType(v as any)}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="income">Income</SelectItem>
            <SelectItem value="expense">Expense</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setSortOrder(prev => prev === "newest" ? "oldest" : "newest")}
          title={`Sort ${sortOrder === "newest" ? "oldest first" : "newest first"}`}
        >
          <ArrowUpDown className="h-4 w-4" />
        </Button>
      </div>

      {/* Transactions List */}
      <Card>
        <CardHeader>
          <CardTitle>All Transactions</CardTitle>
          <CardDescription>
            {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? "s" : ""}
            {filterType !== "all" || searchQuery ? " (filtered)" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredTransactions.length > 0 ? (
            <div className="space-y-2">
              {filteredTransactions.map(transaction => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => openDetail(transaction)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{transaction.description || "Transaction"}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(transaction.date).toLocaleDateString()} • {categoryMap[transaction.categoryId]?.name ?? `Category ${transaction.categoryId}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                    <div className={`text-lg font-semibold ${transaction.type === "income" ? "text-green-600" : "text-red-600"}`}>
                      {transaction.type === "income" ? "+" : "-"}${parseFloat(transaction.amount).toFixed(2)}
                    </div>
                    <div className="hidden sm:flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); openEdit(transaction); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={e => { e.stopPropagation(); handleDelete(transaction.id); }}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {transactions.length === 0
                ? "No transactions yet. Add your first transaction to get started!"
                : "No transactions match your search."}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
            <DialogDescription>Full details for this transaction</DialogDescription>
          </DialogHeader>
          {detailTransaction && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant={detailTransaction.type === "income" ? "default" : "destructive"} className="text-sm">
                  {detailTransaction.type === "income" ? "Income" : "Expense"}
                </Badge>
                <span className={`text-2xl font-bold ${detailTransaction.type === "income" ? "text-green-600" : "text-red-600"}`}>
                  {detailTransaction.type === "income" ? "+" : "-"}${parseFloat(detailTransaction.amount).toFixed(2)}
                </span>
              </div>

              <div className="space-y-3 border-t pt-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Description</span>
                  <span className="font-medium text-right max-w-[60%]">{detailTransaction.description || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Category</span>
                  <span className="font-medium">{categoryMap[detailTransaction.categoryId]?.name ?? "Unknown"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-medium">{new Date(detailTransaction.date).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Transaction ID</span>
                  <span className="font-mono text-sm text-muted-foreground">#{detailTransaction.id}</span>
                </div>
                {detailTransaction.createdAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created</span>
                    <span className="text-sm">{new Date(detailTransaction.createdAt).toLocaleString()}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setDetailOpen(false);
                    openEdit(detailTransaction);
                  }}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => {
                    handleDelete(detailTransaction.id);
                    setDetailOpen(false);
                  }}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
