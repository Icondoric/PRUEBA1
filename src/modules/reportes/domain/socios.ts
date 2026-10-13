/**
 * CAPA DOMAIN — quiénes están activos, por vencer y vencidos.
 *
 * Nada de esto se guarda: se calcula con la fecha de hoy.
 *
 * REGLA: acá solo entran membresías de PLANES. Un pase por sesión nunca hace a
 * alguien "socio activo" ni "socio nuevo"; quien solo compró pases no aparece
 * en ninguna de estas listas.
 */

import { type FechaISO, diasEntre, esAnterior } from '@/lib/fechas';
import { type MesISO, mesDe } from './calendario';

/** Avisar con una semana: da tiempo a llamar antes de que venza. */
export const DIAS_POR_VENCER = 7;
/** Hasta dos meses de vencido todavía se lo puede recuperar con un llamado. */
export const DIAS_VENCIDO_RECIENTE = 60;

export interface CoberturaDeSocio {
  clienteId: number;
  nroSocio: number;
  nombreCompleto: string;
  telefono: string | null;
  /**
   * Hasta cuándo tiene pago, contando renovaciones encadenadas. Si no tiene
   * nada vigente, el vencimiento de la última que tuvo. null si la única que
   * tiene todavía no empezó.
   */
  fechaFin: FechaISO | null;
  /** Ya pagó una que empieza más adelante. */
  proximaDesde: FechaISO | null;
  /** Inicio de su primera membresía de plan: cuándo se hizo socio. */
  socioDesde: FechaISO;
  planNombre: string;
}

export interface FilaDeSocio {
  clienteId: number;
  nroSocio: number;
  nombreCompleto: string;
  telefono: string | null;
  planNombre: string;
  fechaFin: FechaISO;
  /** Días que faltan (por vencer) o que pasaron (vencidos). Siempre positivo. */
  dias: number;
}

const fila = (s: CoberturaDeSocio, fechaFin: FechaISO, dias: number): FilaDeSocio => ({
  clienteId: s.clienteId,
  nroSocio: s.nroSocio,
  nombreCompleto: s.nombreCompleto,
  telefono: s.telefono,
  planNombre: s.planNombre,
  fechaFin,
  dias,
});

export function clasificarSocios(socios: ReadonlyArray<CoberturaDeSocio>, hoy: FechaISO) {
  let activos = 0;
  let vencidosAntiguos = 0;
  const porVencer: FilaDeSocio[] = [];
  const vencidosRecientes: FilaDeSocio[] = [];

  for (const s of socios) {
    if (s.fechaFin === null) continue; // pagó, pero todavía no empezó

    if (!esAnterior(s.fechaFin, hoy)) {
      activos++;
      const faltan = diasEntre(hoy, s.fechaFin);
      if (faltan <= DIAS_POR_VENCER) porVencer.push(fila(s, s.fechaFin, faltan));
      continue;
    }

    // Venció, pero ya pagó la que viene: no hay que llamarlo.
    if (s.proximaDesde !== null) continue;

    const hace = diasEntre(s.fechaFin, hoy);
    if (hace <= DIAS_VENCIDO_RECIENTE) vencidosRecientes.push(fila(s, s.fechaFin, hace));
    else vencidosAntiguos++;
  }

  return {
    activos,
    /** El que vence primero, primero. */
    porVencer: porVencer.sort((a, b) => a.dias - b.dias || a.nroSocio - b.nroSocio),
    /** El que venció hace menos, primero: es el más fácil de recuperar. */
    vencidosRecientes: vencidosRecientes.sort(
      (a, b) => a.dias - b.dias || a.nroSocio - b.nroSocio,
    ),
    vencidosAntiguos,
  };
}

/** Cuántos se hicieron socios en cada mes. Devuelve todos los meses pedidos. */
export function sociosNuevosPorMes(
  socios: ReadonlyArray<Pick<CoberturaDeSocio, 'socioDesde'>>,
  meses: MesISO[],
): Array<{ mes: MesISO; cantidad: number }> {
  return meses.map((mes) => ({
    mes,
    cantidad: socios.filter((s) => mesDe(s.socioDesde) === mes).length,
  }));
}
