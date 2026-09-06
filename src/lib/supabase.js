import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || ''
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const isConfigured = Boolean(url && anon)

export const supabase = isConfigured
  ? createClient(url, anon)
  : null