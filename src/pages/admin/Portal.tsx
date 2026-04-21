import { useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Logo from '@/components/Logo';

const AdminPortal = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('Secure login required');

  // If already logged in, auto redirect
  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getUser();

      if (data?.user) {
        await handleRoleRedirect(data.user.id);
      }
    };

    checkSession();
  }, []);

  const handleRoleRedirect = async (userId: string) => {
    setLoading(true);
    setProgress(1);
    setMessage('Verifying credentials...');

    try {
      let p = 1;
      const interval = setInterval(() => {
        p += 2;
        setProgress(p);
        if (p >= 90) clearInterval(interval);
      }, 250);

      const { data: profile, error } = await supabase
        .from('userprofile')
        .select('role')
        .eq('id', userId)
        .single();

      clearInterval(interval);
      setProgress(100);

      if (error || !profile) {
        await supabase.auth.signOut();
        setMessage('Access denied');
        setLoading(false);
        return;
      }

      const role = profile.role;

      if (role === 'manager') {
        navigate('/novaportal/manager');
        return;
      }

      if (role === 'claims_officer') {
        navigate('/novaportal/officer');
        return;
      }

      await supabase.auth.signOut();
      setMessage('Unauthorized role');
      setLoading(false);

    } catch (err) {
      console.error(err);
      setMessage('System error');
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setLoading(true);
    setProgress(10);
    setMessage('Authenticating...');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.user) {
        setMessage('Invalid credentials');
        setLoading(false);
        return;
      }

      await handleRoleRedirect(data.user.id);

    } catch (err) {
      console.error(err);
      setMessage('Login failed');
      setLoading(false);
    }
  };

  // LOADING / SCAN SCREEN
  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-md z-50">

        {/* background watermark logo */}
        <div className="absolute opacity-10 scale-150">
          <Logo size="lg" />
        </div>

        <div className="w-full max-w-sm text-center space-y-6">

          <Logo size="lg" className="justify-center" />

          <p className="text-white text-sm tracking-wide">
            {message}
          </p>

          {/* progress bar */}
          <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>

          <p className="text-xs text-white/70">{progress}%</p>

        </div>
      </div>
    );
  }

  // LOGIN SCREEN (ONLY THING USERS SEE INITIALLY)
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 relative overflow-hidden">

      {/* background logo watermark */}
      <div className="absolute opacity-5 scale-[2]">
        <Logo size="lg" />
      </div>

      <div className="w-full max-w-md bg-white shadow-xl rounded-2xl p-8 space-y-6 z-10">

        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-2xl teal-gradient-bg flex items-center justify-center shadow-teal">
              <Shield className="h-7 w-7 text-white" />
            </div>
          </div>

          <h1 className="text-2xl font-bold">Nova Secure Portal</h1>
          <p className="text-sm text-muted-foreground">
            Admin & Claims Officer Access Only
          </p>
        </div>

        <div className="space-y-4">
          <Input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <Input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <Button
            className="w-full"
            onClick={handleLogin}
            disabled={!email || !password}
          >
            Login Securely
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Access restricted to authorized Nova staff
          </p>
        </div>

      </div>
    </div>
  );
};

export default AdminPortal;