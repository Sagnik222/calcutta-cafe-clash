import React, { useState } from 'react';
import {
  signUpWithEmail,
  signInWithEmail,
  signInWithMagicLink,
  signInWithPhoneOtp,
  verifyPhoneOtp,
} from '../lib/auth';

function Auth() {
  const [mode, setMode] = useState('signin'); // 'signin', 'signup', 'magic', 'phone'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleEmailSignIn = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signInWithEmail(email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignUp = async (e) => {
    e.preventDefault();
    if (!username.trim() || !displayName.trim()) {
      setError('Username and display name are required');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signUpWithEmail(email, password, username.trim().toLowerCase(), displayName.trim(), signupPhone.trim() || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signInWithMagicLink(email);
      setMagicSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signInWithPhoneOtp(phone);
      setOtpSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await verifyPhoneOtp(phone, otp);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const CrownIcon = () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-forest ml-2 inline-block">
      <path d="M2 20h20M4 16l3-7 5 4 5-4 3 7z"/>
    </svg>
  );

  return (
    <div className="min-h-screen flex flex-col items-center pt-20 px-6 text-center bg-paper animate-fade-in pb-12">
      <div className="absolute top-6 right-8 smallcaps tracking-widest text-sepia text-[10px]">EST. 2026</div>

      <div className="flex items-center justify-center mb-4">
        <h1 className="font-display italic text-forest text-4xl tracking-wide">Crown</h1>
        <CrownIcon />
      </div>
      <div className="w-10 h-px bg-sepia/40 mb-4"></div>
      <p className="smallcaps text-sepia text-xs font-semibold tracking-[0.2em] mb-10">Kolkata · ranked by you</p>

      {error && (
        <div className="bg-red-50 text-red-600 border border-red-200 rounded-lg px-4 py-3 text-sm font-body mb-6 w-full max-w-sm">
          {error}
        </div>
      )}

      {/* ─── Sign In (Email + Password) ─── */}
      {mode === 'signin' && (
        <form onSubmit={handleEmailSignIn} className="w-full max-w-sm flex flex-col gap-5 animate-fade-in">
          <input className="input-field" placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input className="input-field" placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          <button className="btn-primary shadow-md mt-2" disabled={loading}>{loading ? 'Signing in...' : 'Sign In'}</button>

          <div className="flex items-center my-2 opacity-50">
            <div className="hairline flex-1"></div>
            <span className="smallcaps text-sepia px-3 text-[9px] tracking-widest font-bold">OR</span>
            <div className="hairline flex-1"></div>
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => { setError(null); setMode('magic'); }} className="flex-1 bg-cream text-forest font-serif uppercase tracking-widest text-[10px] border border-forest/40 py-3 hover:border-forest transition-colors">
              Magic Link
            </button>
            <button type="button" onClick={() => { setError(null); setMode('phone'); }} className="flex-1 bg-cream text-forest font-serif uppercase tracking-widest text-[10px] border border-forest/40 py-3 hover:border-forest transition-colors">
              Phone OTP
            </button>
          </div>

          <p className="font-body italic text-sepia text-sm mt-4">
            Don't have an account?{' '}
            <button type="button" onClick={() => { setError(null); setMode('signup'); }} className="text-forest underline decoration-dotted font-semibold">
              Create one
            </button>
          </p>
        </form>
      )}

      {/* ─── Sign Up ─── */}
      {mode === 'signup' && (
        <form onSubmit={handleEmailSignUp} className="w-full max-w-sm flex flex-col gap-5 animate-fade-in">
          <input className="input-field" placeholder="Pick a username" value={username} onChange={e => setUsername(e.target.value)} required />
          <input className="input-field" placeholder="Display name (e.g. Sagnik)" value={displayName} onChange={e => setDisplayName(e.target.value)} required />
          <input className="input-field" placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input className="input-field" placeholder="Password (min 6 chars)" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
          <input className="input-field" placeholder="Phone number (optional, for contacts)" type="tel" value={signupPhone} onChange={e => setSignupPhone(e.target.value)} />
          <button className="btn-primary shadow-md mt-2" disabled={loading}>{loading ? 'Creating account...' : 'Create Account'}</button>
          <button type="button" onClick={() => { setError(null); setMode('signin'); }} className="font-body italic text-sepia hover:text-ink transition-colors underline decoration-dotted text-sm">
            Back to sign in
          </button>
        </form>
      )}

      {/* ─── Magic Link ─── */}
      {mode === 'magic' && (
        <div className="w-full max-w-sm flex flex-col gap-5 animate-fade-in">
          {magicSent ? (
            <div className="bg-cream border border-forest/20 rounded-xl p-8 text-center">
              <div className="text-3xl mb-4">✉️</div>
              <h3 className="font-display italic text-forest text-xl mb-2">Check your inbox</h3>
              <p className="font-body italic text-sepia text-sm">We sent a magic link to <strong>{email}</strong>. Click it to sign in.</p>
            </div>
          ) : (
            <form onSubmit={handleMagicLink} className="flex flex-col gap-5">
              <p className="font-body italic text-sepia text-sm">We'll email you a link to sign in instantly — no password needed.</p>
              <input className="input-field" placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
              <button className="btn-primary shadow-md" disabled={loading}>{loading ? 'Sending...' : 'Send Magic Link'}</button>
            </form>
          )}
          <button type="button" onClick={() => { setError(null); setMagicSent(false); setMode('signin'); }} className="font-body italic text-sepia hover:text-ink transition-colors underline decoration-dotted text-sm">
            Back to sign in
          </button>
        </div>
      )}

      {/* ─── Phone OTP ─── */}
      {mode === 'phone' && (
        <div className="w-full max-w-sm flex flex-col gap-5 animate-fade-in">
          {otpSent ? (
            <form onSubmit={handleVerifyOtp} className="flex flex-col gap-5">
              <p className="font-body italic text-sepia text-sm">Enter the 6-digit code sent to <strong>{phone}</strong></p>
              <input className="input-field text-center text-2xl tracking-[0.5em]" placeholder="• • • • • •" value={otp} onChange={e => setOtp(e.target.value)} maxLength={6} required />
              <button className="btn-primary shadow-md" disabled={loading}>{loading ? 'Verifying...' : 'Verify Code'}</button>
            </form>
          ) : (
            <form onSubmit={handleSendOtp} className="flex flex-col gap-5">
              <p className="font-body italic text-sepia text-sm">We'll text you a one-time code to sign in.</p>
              <input className="input-field" placeholder="+91 98765 43210" type="tel" value={phone} onChange={e => setPhone(e.target.value)} required />
              <button className="btn-primary shadow-md" disabled={loading}>{loading ? 'Sending...' : 'Send OTP'}</button>
            </form>
          )}
          <button type="button" onClick={() => { setError(null); setOtpSent(false); setMode('signin'); }} className="font-body italic text-sepia hover:text-ink transition-colors underline decoration-dotted text-sm">
            Back to sign in
          </button>
        </div>
      )}
    </div>
  );
}

export default Auth;
