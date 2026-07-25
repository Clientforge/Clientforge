import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { amyLogin, getAmyToken } from '@/lib/api';

export function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (getAmyToken()) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const form = new FormData(e.currentTarget);
    try {
      await amyLogin(form.get('username') as string, form.get('password') as string);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-page-gradient p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-glow">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="font-display text-3xl font-bold text-brand-800">AMY</h1>
          <p className="mt-2 text-sm text-stone-500">Sign in to access client records</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-5 p-8">
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}
          <div>
            <label className="label-field" htmlFor="username">
              Username
            </label>
            <input id="username" name="username" required autoComplete="username" className="input-field" />
          </div>
          <div>
            <label className="label-field" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="input-field"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
