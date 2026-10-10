'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useState } from 'react';
import { ApiError, api } from './client-api';
import { StarMark } from './Icons';

export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
  const id = useId();
  const signup = mode === 'signup';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (zone) setTimezone(zone);
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (signup && password !== confirm) {
      setError('Those passwords do not match.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api(signup ? '/api/auth/signup' : '/api/auth/login', {
        body: signup ? { name, email, password, timezone } : { email, password },
      });
      router.push('/play');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Something went wrong.');
      setSaving(false);
    }
  }

  return (
    <main className="auth-screen">
      <Link href="/" className="brand">
        <StarMark />
        <span>
          Salawat <em>Challenge</em>
        </span>
      </Link>
      <section className="panel auth-card">
        <p className="kicker">{signup ? 'New group' : 'Welcome back'}</p>
        <h1>{signup ? 'Start a group' : 'Log in'}</h1>
        <p className="lede">
          {signup
            ? 'One email and password for the whole group. Each person gets their own profile inside.'
            : 'This login opens the group, then you pick who is reciting.'}
        </p>
        <form className="form" onSubmit={submit}>
          {signup ? (
            <label className="field" htmlFor={`${id}-name`}>
              <span>Group name</span>
              <input
                id={`${id}-name`}
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="organization"
                required
                maxLength={40}
              />
            </label>
          ) : null}
          <label className="field" htmlFor={`${id}-email`}>
            <span>Email</span>
            <input
              id={`${id}-email`}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label className="field" htmlFor={`${id}-password`}>
            <span>Password</span>
            <input
              id={`${id}-password`}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={signup ? 'new-password' : 'current-password'}
              required
              minLength={signup ? 8 : undefined}
            />
          </label>
          {signup ? (
            <label className="field" htmlFor={`${id}-confirm`}>
              <span>Confirm password</span>
              <input
                id={`${id}-confirm`}
                type="password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
              />
            </label>
          ) : null}
          {signup ? <p className="quiet">At least 8 characters. You can change it later from the group page.</p> : null}
          {error ? (
            <p className="alert" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="btn btn-gold" disabled={saving}>
            {saving ? 'One moment…' : signup ? 'Create the group' : 'Enter'}
          </button>
        </form>
        <p className="switch-auth">
          {signup ? (
            <>
              Already have a group? <Link href="/login">Log in</Link>
            </>
          ) : (
            <>
              New here? <Link href="/signup">Start a group</Link>
            </>
          )}
        </p>
      </section>
    </main>
  );
}
