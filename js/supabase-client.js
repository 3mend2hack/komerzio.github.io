// supabase-client.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// NOTE:
// This file no longer contains secrets. Provide runtime config by adding a
// small file `/js/komerzio-config.js` on the server (NOT committed to git)
// Example is provided at `/js/komerzio-config.js.example` in this repo.

const SUPABASE_URL = (typeof window !== 'undefined' && window.KOMERZIO_CONFIG && window.KOMERZIO_CONFIG.SUPABASE_URL) || ''
const SUPABASE_ANON_KEY = (typeof window !== 'undefined' && window.KOMERZIO_CONFIG && window.KOMERZIO_CONFIG.SUPABASE_ANON_KEY) || ''

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('Supabase client initialized without configuration. Add /js/komerzio-config.js to set SUPABASE_URL and SUPABASE_ANON_KEY.')
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
