/**
 * CAPA DOMAIN — meses y días de la semana para los reportes.
 *
 * Un mes es el texto 'YYYY-MM', igual que una fecha es 'YYYY-MM-DD': se compara
 * y se ordena como texto, sin `Date` ni zona horaria.
 */

import { ReglaDeNegocioError } from '@/lib/errors';
import {
  type FechaISO,
  diasEntre,
  esAnterior,
  esFechaISO,
  sumarDias,
} from '@/lib/fechas';

export type MesISO = string; // 'YYYY-MM'

export function mesDe(fecha: FechaISO): MesISO {
  return fecha.slice(0, 7);
}

export function primerDia(mes: MesISO): FechaISO {
  return `${mes}-01`;
}

export function ultimoDia(mes: MesISO): FechaISO {
  // el día 28 más 4 días cae siempre en el mes siguiente
  const enElSiguiente = sumarDias(`${mes}-28`, 4);
  return sumarDias(primerDia(mesDe(enElSiguiente)), -1);
}

export function mesAnterior(mes: MesISO): MesISO {
  return mesDe(sumarDias(primerDia(mes), -1));
}

/** Los últimos `cantidad` meses terminando en el de `hoy`, del más viejo al más nuevo. */
export function ultimosMeses(hoy: FechaISO, cantidad: number): MesISO[] {
  const meses: MesISO[] = [mesDe(hoy)];
  while (meses.length < cantidad) meses.unshift(mesAnterior(meses[0]!));
  return meses;
}

/** Valida el mes pedido. Tiene que ser uno de los que el reporte ofrece. */
export function elegirMes(
  pedido: string | null | undefined,
  disponibles: MesISO[],
): MesISO {
  const ultimo = disponibles[disponibles.length - 1]!;
  const mes = pedido?.trim();
  if (!mes) return ultimo;

  if (!/^\d{4}-\d{2}$/.test(mes) || !esFechaISO(primerDia(mes))) {
    throw new ReglaDeNegocioError('El mes pedido no es válido', { campo: 'mes' });
  }
  if (!disponibles.includes(mes)) {
    throw new ReglaDeNegocioError('Ese mes está fuera del período del reporte', {
      campo: 'mes',
    });
  }
  return mes;
}

/** 0 = lunes … 6 = domingo. (2024-01-01 fue lunes.) */
export function diaDeSemana(fecha: FechaISO): number {
  return ((diasEntre('2024-01-01', fecha) % 7) + 7) % 7;
}

/** Todas las fechas entre dos, ambas incluidas. */
export function diasDelRango(desde: FechaISO, hasta: FechaISO): FechaISO[] {
  const dias: FechaISO[] = [];
  for (let d = desde; !esAnterior(hasta, d); d = sumarDias(d, 1)) dias.push(d);
  return dias;
}
