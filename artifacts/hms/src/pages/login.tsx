import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth, getLandingPath } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Stethoscope } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const { login, user } = useAuth();
  const [, navigate] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate(getLandingPath(user), { replace: true });
  }, [user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(username, password);
      toast.success("Welcome");
    } catch (err: any) {
      toast.error(err.message || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-blue-50 p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="bg-primary text-primary-foreground p-2 rounded-md">
              <Stethoscope className="w-6 h-6" />
            </div>
            <span className="font-bold text-2xl">Hope NeuroTrauma & MultiSpeciality Hospital HMS</span>
          </div>
          <p className="text-sm text-muted-foreground">Hospital Management System</p>
        </div>
        <Card>
          <CardHeader><CardTitle>Sign in</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label>Username</Label>
                <Input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required />
              </div>
              <div>
                <Label>PIN</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your PIN" />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
