/**
 * CAPA DOMAIN — reglas puras de visitas.
 *
 * Una visita es una entrada GRATIS: cortesía, clase de prueba, acompañante.
 * Si la persona pagó algo, NO va acá: es un cliente con su membresía y su
 * pago. Esa es la única frontera, y por eso una visita no tiene monto.
 */

import { ReglaDeNegocioError } from '@/lib/errors';

export const MOTIVOS_VISITA = ['cortesia', 'prueba', 'acompanante', 'otro'] as const;
export type MotivoVisita = (typeof MOTIVOS_VISITA)[number];

export interface DatosVisita {
  nombre: string;
  motivo: MotivoVisita;
  telefono?: string | null;
  nota?: string | null;
}

export interface VisitaNormalizada {
  nombre: string;
  motivo: MotivoVisita;
  telefono: string | null;
  nota: string | null;
}

/**
 * Valida y normaliza una visita.
 *
 * @param tieneAnfitrion si se indicó qué socio la invitó. Un acompañante sin
 *   socio al que acompaña no es un acompañante.
 */
export function prepararVisita(
  datos: DatosVisita,
  tieneAnfitrion: boolean,
): VisitaNormalizada {
  const nombre = datos.nombre?.trim() ?? '';
  if (nombre.length < 2) {
    throw new ReglaDeNegocioError('El nombre es obligatorio', { campo: 'nombre' });
  }

  if (datos.motivo === 'acompanante' && !tieneAnfitrion) {
    throw new ReglaDeNegocioError('Indicá a qué socio acompaña', {
      campo: 'invitadoPor',
    });
  }

  return {
    nombre,
    motivo: datos.motivo,
    telefono: datos.telefono?.trim() || null,
    nota: datos.nota?.trim() || null,
  };
}
