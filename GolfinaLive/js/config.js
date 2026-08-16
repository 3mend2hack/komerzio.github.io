// ============================================
// CONFIGURACIÓN DE SUPABASE
// ============================================

// 🔑 CREDENCIALES - REEMPLAZA CON LAS TUYAS
const SUPABASE_URL = 'https://qddfdisbnwnnlvkrnckd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkZGZkaXNibndubmx2a3JuY2tkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4NDQwMzcsImV4cCI6MjEwMjQyMDAzN30.9Jsgl0qepqjJ8oiiewyPZK3vOsqm49EnLCEtOar5MiQ';

// Inicializar cliente de Supabase
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
// FUNCIONES DE UTILIDAD
// ============================================

// Obtener o generar ID de usuario anónimo
function getUsuarioId() {
  let userId = localStorage.getItem('golfina_usuario_id');
  if (!userId) {
    userId = 'anon_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('golfina_usuario_id', userId);
  }
  return userId;
}

// Escuchar cambios en tiempo real (Partidas)
function suscribirsePartida(partidaId, callback) {
  return supabaseClient
    .channel('partida-' + partidaId)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'partidas',
      filter: `id=eq.${partidaId}`
    }, (payload) => {
      callback(payload.new);
    })
    .subscribe();
}

// Escuchar nuevos eventos (puntos añadidos)
function suscribirseEventos(partidaId, callback) {
  return supabaseClient
    .channel('eventos-' + partidaId)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'eventos',
      filter: `partida_id=eq.${partidaId}`
    }, (payload) => {
      callback(payload.new);
    })
    .subscribe();
}