'use client';

import { useEffect, useState } from 'react';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => {
        if (res.ok) router.replace('/');
      })
      .catch(() => {});
  }, [router]);

  async function handleRegister() {
    const trimmed = username.trim();
    if (!trimmed) {
      setError('Please enter a username');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const optionsRes = await fetch('/api/auth/register-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmed }),
      });
      const optionsData = await optionsRes.json();
      if (!optionsRes.ok) {
        setError(optionsData.error || 'Registration failed');
        return;
      }

      const attestation = await startRegistration({ optionsJSON: optionsData });

      const verifyRes = await fetch('/api/auth/register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmed, response: attestation }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        setError(verifyData.error || 'Verification failed');
        return;
      }

      router.push('/');
    } catch (err) {
      setError((err as Error).message || 'Registration cancelled or failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin() {
    const trimmed = username.trim();
    if (!trimmed) {
      setError('Please enter a username');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const optionsRes = await fetch('/api/auth/login-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmed }),
      });
      const optionsData = await optionsRes.json();
      if (!optionsRes.ok) {
        setError(optionsData.error || 'Login failed');
        return;
      }

      const assertion = await startAuthentication({ optionsJSON: optionsData });

      const verifyRes = await fetch('/api/auth/login-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmed, response: assertion }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        setError(verifyData.error || 'Verification failed');
        return;
      }

      router.push('/');
    } catch (err) {
      setError((err as Error).message || 'Authentication cancelled or failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-gray-800 p-8 shadow-md border border-gray-200 dark:border-gray-700">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Todo App</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Sign in or register passwordlessly with a Passkey / WebAuthn authenticator.
        </p>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              disabled={loading}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleLogin}
              disabled={loading}
              className="flex-1 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white transition-colors"
            >
              {loading ? 'Working...' : 'Login'}
            </button>
            <button
              type="button"
              onClick={handleRegister}
              disabled={loading}
              className="flex-1 rounded-lg bg-gray-800 hover:bg-gray-900 dark:bg-gray-600 dark:hover:bg-gray-500 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white transition-colors"
            >
              {loading ? 'Working...' : 'Register'}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

