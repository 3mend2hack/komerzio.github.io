// js/supabase.js

// Usamos la variable global 'supabase' que se cargó con <script> en index.html
const { createClient } = window.supabase;

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

// Inicializar cliente de Supabase
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Inicializa la suscripción a Realtime para recibir poderes y cambios de partidas.
 * @param {Object} callbacks - { onPoderRecibido: Function, onPartidaFinalizada: Function }
 */
export function initSupabase({ onPoderRecibido, onPartidaFinalizada }) {
  // Escuchar inserciones en la tabla 'poderes' (Realtime)
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

  // Escuchar actualizaciones en la tabla 'partidas' (opcional)
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
