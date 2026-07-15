// js/supabase-client.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// Leer configuración desde el objeto global (definido en komerzio-config.js)
const config = window.KOMERZIO_CONFIG || {}
const SUPABASE_URL = config.SUPABASE_URL || ''
const SUPABASE_ANON_KEY = config.SUPABASE_ANON_KEY || ''

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Faltan las credenciales de Supabase. Revisa js/komerzio-config.js')
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)