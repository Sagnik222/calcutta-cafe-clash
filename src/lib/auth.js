import { supabase } from './supabase';

// ─── Email + Password ───────────────────────────
export async function signUpWithEmail(email, password, username, displayName, phone = null) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username,
        display_name: displayName,
        phone: phone,
      },
    },
  });
  if (error) throw error;
  
  // Update phone in profiles if provided
  if (phone && data?.user?.id) {
    await supabase.from('profiles').update({ phone }).eq('id', data.user.id);
  }
  
  return data;
}

export async function signInWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

// ─── Magic Link ─────────────────────────────────
export async function signInWithMagicLink(email) {
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
  });
  if (error) throw error;
  return data;
}

// ─── Phone OTP ──────────────────────────────────
export async function signInWithPhoneOtp(phone) {
  const { data, error } = await supabase.auth.signInWithOtp({
    phone,
  });
  if (error) throw error;
  return data;
}

export async function verifyPhoneOtp(phone, token) {
  const { data, error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: 'sms',
  });
  if (error) throw error;
  return data;
}

// ─── Session Helpers ────────────────────────────
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getCurrentProfile() {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback);
}
