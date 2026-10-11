/**
 * Decisión de acceso. Función PURA, sin DB, sin red, sin reloj.
 *
 * La usan dos lugares:
 *   1. el servidor, con datos frescos de Postgres
 *   2. el caché offline del navegador, con el snapshot en IndexedDB
 *
 * Que sea la misma función es lo que garantiza que online y offline nunca
 * contradigan. Si duplicás esta lógica, en algún momento el socio va a entrar
 * con internet y rebotar sin internet, y nadie va a entender por qué.
 */

import { type FechaISO, diasEntre, esPosteriorOIgual } from '@/lib/fechas';

export const DIAS_AVISO_VENCIMIENTO = 3;

export type ResultadoAcceso = 'permitido' | 'por_vencer' | 'vencido' | 'sin_membresia';

export interface SocioParaAcceso {
  clienteId: number;
  nroSocio: number;
  nombreCompleto: string;
  fotoUrl: string | null;
  /** fecha_fin de la membresía más reciente no cancelada. null si nunca tuvo. */
  fechaFin: FechaISO | null;
  membresiaId: number | null;
  /**
   * La membresía vigente es un pase por sesión. Cambia el mensaje: "vence hoy"
   * suena a problema, y un pase diario que vence hoy es exactamente lo normal.
   */
  esPaseDiario?: boolean;
  /** Bloqueo manual (deuda, sanción). Rebota aunque esté vigente. */
  bloqueado?: boolean;
}

export interface Veredicto {
  resultado: ResultadoAcceso;
  permitir: boolean;
  /** Negativo si ya venció. */
  diasRestantes: number | null;
  socio: SocioParaAcceso;
  mensaje: string;
}

export function evaluarAcceso(socio: SocioParaAcceso, hoy: FechaISO): Veredicto {
  const base = { socio };

  if (socio.bloqueado) {
    return {
      ...base,
      resultado: 'vencido',
      permitir: false,
      diasRestantes: null,
      mensaje: 'Acceso bloqueado — pasar por administración',
    };
  }

  if (socio.fechaFin === null) {
    return {
      ...base,
      resultado: 'sin_membresia',
      permitir: false,
      diasRestantes: null,
      mensaje: 'Sin membresía registrada',
    };
  }

  // Vence hoy => todavía entra. El último día es un día de uso.
  const vigente = esPosteriorOIgual(socio.fechaFin, hoy);
  const diasRestantes = diasEntre(hoy, socio.fechaFin);

  if (!vigente) {
    const dias = Math.abs(diasRestantes);
    return {
      ...base,
      resultado: 'vencido',
      permitir: false,
      diasRestantes,
      mensaje: `Venció hace ${dias} ${dias === 1 ? 'día' : 'días'}`,
    };
  }

  // Un pase por sesión vigente es un "permitido" limpio, no un "está por
  // vencer". Avisarle a recepción que renueve un pase diario es ruido.
  if (socio.esPaseDiario) {
    return {
      ...base,
      resultado: 'permitido',
      permitir: true,
      diasRestantes,
      mensaje: 'Pase por sesión — válido hoy',
    };
  }

  if (diasRestantes <= DIAS_AVISO_VENCIMIENTO) {
    return {
      ...base,
      resultado: 'por_vencer',
      permitir: true,
      diasRestantes,
      mensaje:
        diasRestantes === 0
          ? 'Último día de membresía'
          : `Vence en ${diasRestantes} ${diasRestantes === 1 ? 'día' : 'días'}`,
    };
  }

  return {
    ...base,
    resultado: 'permitido',
    permitir: true,
    diasRestantes,
    mensaje: `Quedan ${diasRestantes} días`,
  };
}
