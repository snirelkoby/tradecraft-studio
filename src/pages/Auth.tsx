import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { BarChart3, TrendingUp, Shield } from 'lucide-react';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error(error.message);
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) toast.error(error.message);
      else toast.success('Check your email to confirm your account');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left side - branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center p-12 border-r border-border">
        <div className="max-w-md space-y-8">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-foreground">
              EDGE<span className="text-primary">LAB</span>
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">Strategic Trading Journal & Analytics Platform</p>
          </div>
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-primary/10 text-primary"><BarChart3 className="h-5 w-5" /></div>
              <div>
                <h3 className="font-semibold text-foreground">Advanced Analytics</h3>
                <p className="text-sm text-muted-foreground">P&L tracking, win rate, profit factor, and more</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-primary/10 text-primary"><TrendingUp className="h-5 w-5" /></div>
              <div>
                <h3 className="font-semibold text-foreground">Trade Journal</h3>
                <p className="text-sm text-muted-foreground">Entry/exit tracking with strategies and notes</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-primary/10 text-primary"><Shield className="h-5 w-5" /></div>
              <div>
                <h3 className="font-semibold text-foreground">Risk Management</h3>
                <p className="text-sm text-muted-foreground">Blueprint strategies with risk parameters</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <Card className="w-full max-w-md bg-card border-border">
          <CardHeader className="text-center">
            <div className="lg:hidden mb-4">
              <h1 className="text-2xl font-black tracking-tight">
                EDGE<span className="text-primary">LAB</span>
              </h1>
            </div>
            <CardTitle className="text-xl">{isLogin ? 'Welcome Back' : 'Create Account'}</CardTitle>
            <CardDescription>
              {isLogin ? 'Sign in to your trading journal' : 'Start tracking your trades'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-secondary border-border"
              />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="bg-secondary border-border"
              />
              <Button type="submit" className="w-full font-bold" disabled={loading}>
                {loading ? 'Loading...' : isLogin ? 'Sign In' : 'Create Account'}
              </Button>
            </form>
            <div className="mt-4 text-center">
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
