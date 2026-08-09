// js/supabase-client.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// Leer configuración desde el objeto global (definido en komerzio-config.js)
const config = window.KOMERZIO_CONFIG || {}
const SUPABASE_URL = config.SUPABASE_URL || config.supabaseUrl || window.SUPABASE_URL || ''
const SUPABASE_ANON_KEY = config.SUPABASE_ANON_KEY || config.supabaseAnonKey || window.SUPABASE_ANON_KEY || ''

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Faltan las credenciales de Supabase. Revisa js/komerzio-config.js')
  console.error('   config:', config)
  console.error('   window.SUPABASE_URL:', window.SUPABASE_URL)
  console.error('   window.SUPABASE_ANON_KEY:', window.SUPABASE_ANON_KEY ? '✅ Presente' : '❌ Faltante')
  throw new Error('supabaseUrl is required. Revisa js/komerzio-config.js')
}

console.log('✅ Supabase client inicializado correctamente.')
console.log('   📡 URL:', SUPABASE_URL)
console.log('   🔑 ANON KEY:', SUPABASE_ANON_KEY.substring(0, 20) + '...')

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)