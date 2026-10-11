/**
 * Los dos sonidos del check-in, generados con Web Audio: sin archivos y sin
 * depender de internet.
 *
 * Tienen que distinguirse sin mirar la pantalla: el permitido son dos notas
 * agudas que suben; el rechazado, dos pulsos graves y ásperos.
 *
 * El navegador solo deja sonar después de una acción de la persona. El Enter
 * del check-in lo es, así que el contexto de audio se crea en el primer uso.
 */

let contexto: AudioContext | null = null;

function nota(
  ctx: AudioContext,
  frecuencia: number,
  desde: number,
  duracion: number,
  forma: OscillatorType,
) {
  const oscilador = ctx.createOscillator();
  const volumen = ctx.createGain();
  const inicio = ctx.currentTime + desde;

  oscilador.type = forma;
  oscilador.frequency.value = frecuencia;

  // Entrada y salida suaves: sin esto cada nota hace "clic".
  volumen.gain.setValueAtTime(0, inicio);
  volumen.gain.linearRampToValueAtTime(0.25, inicio + 0.01);
  volumen.gain.linearRampToValueAtTime(0, inicio + duracion);

  oscilador.connect(volumen).connect(ctx.destination);
  oscilador.start(inicio);
  oscilador.stop(inicio + duracion);
}

export function sonar(tipo: 'permitido' | 'rechazado') {
  try {
    contexto ??= new AudioContext();
    void contexto.resume();

    if (tipo === 'permitido') {
      nota(contexto, 880, 0, 0.12, 'sine');
      nota(contexto, 1320, 0.12, 0.18, 'sine');
    } else {
      nota(contexto, 196, 0, 0.18, 'square');
      nota(contexto, 196, 0.26, 0.28, 'square');
    }
  } catch {
    // Sin audio (navegador sin permiso o sin parlantes) el check-in sigue: el
    // sonido refuerza a la pantalla, nunca es el único aviso.
  }
}
