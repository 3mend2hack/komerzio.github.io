const { createClient } = window.supabase;

import { SUPABASE_URL, SUPABASE_ANON_KEY, AUTH_EMAIL } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Inicia sesión con el email fijo y la contraseña proporcionada.
 * @param {string} password - Contraseña del usuario
 * @returns {Promise<Object>} - Datos de sesión o error
 */
export async function signIn(password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: AUTH_EMAIL,
    password: password,
  });
  if (error) throw error;
  return data;
}

/**
 * Cierra la sesión actual.
 */
export async function signOut() {
  await supabase.auth.signOut();
}

/**
 * Obtiene la sesión actual (si existe).
 */
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/**
 * Inicializa la suscripción a Realtime para recibir poderes.
 * @param {Object} callbacks - { onPoderRecibido, onPartidaFinalizada }
 */
export function initSupabase({ onPoderRecibido, onPartidaFinalizada }) {
  supabase
    .channel('poderes-channel')
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'poderes' },
      (payload) => {
        const poder = payload.new;
        if (poder.activo && poder.channel === 'golfinalive') {
          onPoderRecibido(poder.nombre, poder.channel);
        }
      }
    )
    .subscribe();

  supabase
    .channel('partidas-channel')
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'partidas' },
      (payload) => {
        const partida = payload.new;
        if (partida.estado === 'finalizada') {
          onPartidaFinalizada?.(partida.ganador);
        }
      }
    )
    .subscribe();
}

/**
 * Guarda o actualiza la partida activa en Supabase.
 * @param {Object} partida - { puntaje_rojo, puntaje_azul, goles_para_ganar, velocidad_bolas }
 */
export async function savePartida(partida) {
  const { data: activas, error: errorSelect } = await supabase
    .from('partidas')
    .select('id')
    .eq('estado', 'activa')
    .limit(1);

  if (errorSelect) throw errorSelect;

  if (activas && activas.length > 0) {
    const { error: errorUpdate } = await supabase
      .from('partidas')
      .update({
        puntaje_rojo: partida.puntaje_rojo,
        puntaje_azul: partida.puntaje_azul,
        goles_para_ganar: partida.goles_para_ganar,
        velocidad_bolas: partida.velocidad_bolas,
      })
      .eq('id', activas[0].id);

    if (errorUpdate) throw errorUpdate;
  } else {
    const { error: errorInsert } = await supabase
      .from('partidas')
      .insert({
        estado: 'activa',
        modo: 'bolas',
        puntaje_rojo: partida.puntaje_rojo,
        puntaje_azul: partida.puntaje_azul,
        goles_para_ganar: partida.goles_para_ganar,
        velocidad_bolas: partida.velocidad_bolas,
        dificultad: 'normal',
      });

    if (errorInsert) throw errorInsert;
  }
}

/**
 * Carga la partida activa desde Supabase.
 * @returns {Promise<Object|null>} - Partida activa o null si no hay
 */
export async function loadPartidaActiva() {
  const { data, error } = await supabase
    .from('partidas')
    .select('*')
    .eq('estado', 'activa')
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

/**
 * Finaliza la partida activa (si existe) y guarda el ganador.
 */
export async function finalizarPartida(ganador) {
  const { data: activas, error: errorSelect } = await supabase
    .from('partidas')
    .select('id')
    .eq('estado', 'activa')
    .limit(1);

  if (errorSelect) throw errorSelect;

  if (activas && activas.length > 0) {
    const { error: errorUpdate } = await supabase
      .from('partidas')
      .update({
        estado: 'finalizada',
        ganador: ganador,
        finalizada_en: new Date().toISOString(),
      })
      .eq('id', activas[0].id);

    if (errorUpdate) throw errorUpdate;
  }
}