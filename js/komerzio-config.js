// ============================================================
// KOMERZIO - Configuración de Supabase
// ============================================================

// ===== CREDENCIALES DE SUPABASE =====
const SUPABASE_URL = 'https://ehlebvmalatsdyvopvkn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVobGVidm1hbGF0c2R5dm9wdmtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMjg2MjAsImV4cCI6MjA5OTYwNDYyMH0.lsV-x6y3e-0fbdUqb--_CVi8c1gUhO4MUoo1grq66ZI';

// ===== EXPONER CREDENCIALES GLOBALMENTE =====
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

// ===== CONFIGURACIÓN DE LA APLICACIÓN =====
window.KOMERZIO_CONFIG = {
  SUPABASE_URL: SUPABASE_URL,
  SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,
  supabaseUrl: SUPABASE_URL,
  supabaseAnonKey: SUPABASE_ANON_KEY,
  appName: 'KOMERZIO',
  appVersion: '1.0.0',
  currency: 'USD',
  currencySymbol: '$',
  storeName: 'KOMERZIO',
  storeEmail: '53-56940021.641@zohomail.com',
  whatsappNumber: '5356591892',
  debug: true
};

// ===== VERIFICACIÓN DE CREDENCIALES =====
console.log('✅ Configuración de KOMERZIO cargada correctamente.');
console.log('   📡 URL:', SUPABASE_URL);
console.log('   🔑 ANON KEY:', SUPABASE_ANON_KEY.substring(0, 20) + '...');