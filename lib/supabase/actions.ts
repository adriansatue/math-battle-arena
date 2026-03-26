'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// ── SIGN UP ───────────────────────────────────
export async function signUp(formData: FormData) {
  const supabase = await createClient()

  const email    = formData.get('email') as string
  const password = formData.get('password') as string
  const username = formData.get('username') as string

  // Validate username format server-side (mirrors client HTML pattern)
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return { error: 'Username must be 3–20 characters and contain only letters, numbers, or underscores.' }
  }

  // Check username is not taken
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .single()

  if (existing) {
    return { error: 'Username is already taken. Try another one!' }
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  })

  if (error) return { error: error.message }

  // Guard against race condition: another signup could have claimed the username
  // between our check above and the profile insert triggered by Supabase's Auth hook.
  // Supabase will surface a unique-constraint violation as error code '23505'.
  if (!data.session && !data.user) {
    return { error: 'Signup failed. The username or email may already be in use.' }
  }

  // Email confirmation is disabled in Supabase — session is returned immediately.
  // Redirect the user straight to the lobby instead of asking them to check email.
  if (data.session) {
    revalidatePath('/', 'layout')
    redirect('/lobby')
  }

  // Email confirmation is enabled — user must click the link in their inbox.
  return { success: 'Check your email to confirm your account!' }
}

// ── LOGIN ─────────────────────────────────────
export async function login(formData: FormData) {
  const supabase = await createClient()

  const email    = formData.get('email') as string
  const password = formData.get('password') as string
  const next     = (formData.get('next') as string | null) ?? '/lobby'

  // Sanitise the redirect target — only allow relative paths within the app
  const safePath = next.startsWith('/') && !next.startsWith('//') ? next : '/lobby'

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) return { error: 'Invalid email or password. Please try again.' }

  revalidatePath('/', 'layout')
  redirect(safePath)
}

// ── MAGIC LINK ────────────────────────────────
export async function sendMagicLink(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  })

  if (error) return { error: error.message }

  return { success: 'Magic link sent! Check your email 🪄' }
}

// ── RESET PASSWORD (send email) ───────────────
export async function sendPasswordReset(formData: FormData) {
  const supabase = await createClient()
  const email    = formData.get('email') as string

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`,
  })

  if (error) return { error: error.message }

  return { success: 'Password reset link sent! Check your email.' }
}

// ── UPDATE PASSWORD (after clicking reset link) ─
export async function updatePassword(formData: FormData) {
  const supabase  = await createClient()
  const password  = formData.get('password') as string

  const { error } = await supabase.auth.updateUser({ password })

  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  redirect('/lobby')
}

// ── LOGOUT ────────────────────────────────────
export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}