import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Target } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useDemo } from "@/contexts/DemoContext";
import { useDemoData } from "@/hooks/useDemoData";

export default function Goals() {
  const { isDemoMode } = useDemo();
  const { demoData, saveDemoData } = useDemoData();
  const { data: _goals = [], refetch } = trpc.goals.list.useQuery(undefined, { enabled: !isDemoMode });
  const goals = isDemoMode ? demoData.goals : _goals;
  const createMutation = trpc.goals.create.useMutation();
  const updateMutation = trpc.goals.update.useMutation();
  const deleteMutation = trpc.goals.delete.useMutation();

  const [open, setOpen] = useState(false);
  const [contributingGoal, setContributingGoal] = useState<{ id: number; name: string } | null>(null);
  const [contributeAmount, setContributeAmount] = useState("");
  const [formData, setFormData] = useState({ name: "", targetAmount: "", targetDate: "", description: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.targetAmount || !formData.targetDate) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (isDemoMode) {
      const newGoal = {
        id: Date.now(),
        userId: 999,
        name: formData.name,
        targetAmount: formData.targetAmount,
        currentAmount: "0",
        targetDate: new Date(formData.targetDate),
        description: formData.description || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      saveDemoData({ ...demoData, goals: [...demoData.goals, newGoal as any] });
      toast.success("Goal created!");
      setFormData({ name: "", targetAmount: "", targetDate: "", description: "" });
      setOpen(false);
      return;
    }

    try {
      await createMutation.mutateAsync({
        name: formData.name,
        targetAmount: formData.targetAmount,
        targetDate: new Date(formData.targetDate),
        description: formData.description || undefined,
      });
      toast.success("Goal created!");
      setFormData({ name: "", targetAmount: "", targetDate: "", description: "" });
      setOpen(false);
      refetch();
    } catch {
      toast.error("Failed to create goal");
    }
  };

  const handleContribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contributingGoal || !contributeAmount) return;

    const goal = goals.find(g => g.id === contributingGoal.id);
    if (!goal) return;
    const newAmount = (parseFloat(goal.currentAmount ?? "0") + parseFloat(contributeAmount)).toFixed(2);

    if (isDemoMode) {
      const updatedGoals = demoData.goals.map(g =>
        g.id === contributingGoal.id ? { ...g, currentAmount: newAmount, updatedAt: new Date() } : g,
      );
      saveDemoData({ ...demoData, goals: updatedGoals });
      toast.success("Contribution added!");
      setContributingGoal(null);
      setContributeAmount("");
      return;
    }

    try {
      await updateMutation.mutateAsync({ id: contributingGoal.id, currentAmount: newAmount });
      toast.success("Contribution added!");
      setContributingGoal(null);
      setContributeAmount("");
      refetch();
    } catch {
      toast.error("Failed to add contribution");
    }
  };

  const handleDelete = async (id: number) => {
    if (isDemoMode) {
      saveDemoData({ ...demoData, goals: demoData.goals.filter(g => g.id !== id) });
      toast.success("Goal deleted");
      return;
    }
    try {
      await deleteMutation.mutateAsync({ id });
      toast.success("Goal deleted");
      refetch();
    } catch {
      toast.error("Failed to delete goal");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Financial Goals</h1>
          <p className="text-muted-foreground mt-2">Track your savings targets and milestones</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Goal
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Financial Goal</DialogTitle>
              <DialogDescription>Set a savings target to work towards</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Goal Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Emergency Fund, Vacation"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="targetAmount">Target Amount</Label>
                <Input
                  id="targetAmount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.targetAmount}
                  onChange={e => setFormData({ ...formData, targetAmount: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="targetDate">Target Date</Label>
                <Input
                  id="targetDate"
                  type="date"
                  value={formData.targetDate}
                  onChange={e => setFormData({ ...formData, targetDate: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  placeholder="What is this goal for?"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create Goal"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Contribute Dialog */}
      <Dialog open={!!contributingGoal} onOpenChange={v => { if (!v) { setContributingGoal(null); setContributeAmount(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Contribution</DialogTitle>
            <DialogDescription>How much are you adding to "{contributingGoal?.name}"?</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleContribute} className="space-y-4">
            <div>
              <Label htmlFor="contributeAmount">Amount</Label>
              <Input
                id="contributeAmount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={contributeAmount}
                onChange={e => setContributeAmount(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Add Contribution"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Goals List */}
      <div className="space-y-4">
        {goals.length > 0 ? (
          goals.map(goal => {
            const current = parseFloat(goal.currentAmount ?? "0");
            const target = parseFloat(goal.targetAmount);
            const percentage = Math.min((current / target) * 100, 100);
            const isComplete = percentage >= 100;
            const daysLeft = Math.ceil((new Date(goal.targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

            return (
              <Card key={goal.id} className={isComplete ? "border-green-500 bg-green-50 dark:bg-green-950" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Target className={`h-5 w-5 ${isComplete ? "text-green-600" : "text-blue-600"}`} />
                      <div>
                        <CardTitle className="text-lg">{goal.name}</CardTitle>
                        {goal.description && <CardDescription>{goal.description}</CardDescription>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setContributingGoal({ id: goal.id, name: goal.name })}
                        disabled={isComplete}
                      >
                        + Add
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(goal.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>${current.toFixed(2)} saved</span>
                      <span className="font-semibold">${target.toFixed(2)} goal</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                      <div
                        className={`h-2.5 rounded-full transition-all ${isComplete ? "bg-green-600" : "bg-blue-600"}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{percentage.toFixed(0)}% complete</span>
                      <span>
                        {isComplete
                          ? "Goal reached!"
                          : daysLeft > 0
                          ? `${daysLeft} days left`
                          : "Overdue"}
                      </span>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Target date: {new Date(goal.targetDate).toLocaleDateString()}
                    {!isComplete && target - current > 0 && (
                      <span className="ml-3 font-medium text-foreground">
                        ${(target - current).toFixed(2)} remaining
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Target className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">No goals yet</p>
              <p className="text-sm mt-1">Create your first financial goal to start saving!</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
