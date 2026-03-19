import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import { useDemo } from "@/contexts/DemoContext";
import { toast } from "sonner";
import { BarChart3 } from "lucide-react";

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [, setLocation] = useLocation();
  const { setDemoMode } = useDemo();
  const utils = trpc.useUtils();

  const onSuccess = () => {
    setDemoMode(false);
    utils.auth.me.invalidate();
    setLocation("/");
  };

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess,
    onError: err => toast.error(err.message),
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess,
    onError: err => toast.error(err.message),
  });

  const loading = loginMutation.isPending || registerMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegister) {
      registerMutation.mutate({ email, name, password });
    } else {
      loginMutation.mutate({ email, password });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 justify-center mb-8">
          <BarChart3 className="h-8 w-8 text-blue-600" />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Finance Tracker</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{isRegister ? "Create Account" : "Welcome Back"}</CardTitle>
            <CardDescription>
              {isRegister ? "Sign up to start tracking your finances" : "Sign in to your account"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegister && (
                <div className="space-y-1">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Your name"
                    required
                  />
                </div>
              )}
              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={isRegister ? "At least 8 characters" : "••••••••"}
                  minLength={isRegister ? 8 : undefined}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Please wait..." : isRegister ? "Create Account" : "Sign In"}
              </Button>
            </form>

            <div className="mt-4 text-center text-sm text-muted-foreground">
              {isRegister ? "Already have an account? " : "Don't have an account? "}
              <button
                onClick={() => setIsRegister(!isRegister)}
                className="text-blue-600 hover:underline font-medium"
              >
                {isRegister ? "Sign In" : "Create one"}
              </button>
            </div>

            <div className="mt-3 text-center">
              <button
                onClick={() => setLocation("/")}
                className="text-sm text-muted-foreground hover:underline"
              >
                Continue as guest (demo mode)
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
