const { createClient } = window.supabase;

import { SUPABASE_URL, SUPABASE_ANON_KEY, AUTH_EMAIL } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function signIn(password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: AUTH_EMAIL,
    password: password,
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export function initSupabase({ onPoderRecibido, onPartidaFinalizada }) {
  supabase
    .channel('poderes-channel')
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'poderes' },
      (payload) => {
        const poder = payload.new;
        if (poder.activo && poder.channel === 'golfinalive') {
          // Pasar también el usuario que activó el poder
          onPoderRecibido(poder.nombre, poder.channel, poder.usuario);
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

// ... resto de funciones (savePartida, loadPartidaActiva, finalizarPartida) sin cambios
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