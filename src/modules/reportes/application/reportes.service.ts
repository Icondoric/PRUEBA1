/**
 * CAPA APPLICATION — el reporte del dueño.
 *
 * Un solo caso de uso que arma todo en una respuesta: desde el celular conviene
 * una ida y vuelta, no ocho. Junta filas del repositorio y las pasa por las
 * funciones puras del dominio.
 *
 * SOLO PARA EL DUEÑO (rol admin). Hoy no hay login; cuando exista, estas rutas
 * son las primeras que se restringen.
 */

import { type FechaISO, esAnterior, sumarDias } from '@/lib/fechas';
import { vigenciaParaAcceso } from '@/modules/checkin';
import { nombreCompleto } from '@/modules/clientes';
import { totalesDeCaja } from '@/modules/pagos';
import {
  asistenciaPorDiaDeSemana,
  clientesFrecuentesConPase,
  ingresosPorDia,
  pasesPorMes,
} from '../domain/actividad';
import {
  elegirMes,
  mesDe,
  primerDia,
  ultimoDia,
  ultimosMeses,
} from '../domain/calendario';
import {
  type CoberturaDeSocio,
  DIAS_POR_VENCER,
  DIAS_VENCIDO_RECIENTE,
  clasificarSocios,
  sociosNuevosPorMes,
} from '../domain/socios';
import type { RepoReportes } from '../infrastructure/reportes.repo';

const MESES_DE_HISTORIA = 6;
/** Ocho semanas completas: cada día de la semana aparece 8 veces. */
const DIAS_DE_ASISTENCIA = 56;
const DIAS_DE_PASES_FRECUENTES = 90;

export function crearServicioReportes(repo: RepoReportes) {
  return {
    resumen(entrada: { mes?: string | null }, hoy: FechaISO) {
      const meses = ultimosMeses(hoy, MESES_DE_HISTORIA);
      const mes = elegirMes(entrada.mes, meses);
      const desdeHistoria = primerDia(meses[0]!);

      // ── socios: solo membresías de planes; los pases van aparte ──
      const todas = repo.membresias();
      const dePlanes = todas.filter((m) => !m.esPaseDiario);
      const dePases = todas.filter((m) => m.esPaseDiario);

      const porCliente = new Map<number, typeof dePlanes>();
      for (const m of dePlanes) {
        porCliente.set(m.clienteId, [...(porCliente.get(m.clienteId) ?? []), m]);
      }

      const socios: CoberturaDeSocio[] = [...porCliente.values()].map((suyas) => {
        const vigencia = vigenciaParaAcceso(suyas, hoy);
        const primera = suyas.reduce((a, b) =>
          esAnterior(b.fechaInicio, a.fechaInicio) ? b : a,
        );
        const referencia = suyas.find((m) => m.id === vigencia.membresiaId) ?? primera;
        return {
          clienteId: primera.clienteId,
          nroSocio: primera.nroSocio,
          nombreCompleto: nombreCompleto(primera),
          telefono: primera.telefono,
          fechaFin: vigencia.fechaFin,
          proximaDesde: vigencia.proximaDesde,
          socioDesde: primera.fechaInicio,
          planNombre: referencia.planNombre,
        };
      });

      const clasificados = clasificarSocios(socios, hoy);
      const activosHoy = new Set(
        socios
          .filter((s) => s.fechaFin !== null && !esAnterior(s.fechaFin, hoy))
          .map((s) => s.clienteId),
      );

      // ── caja ──
      const pagos = repo.pagosDesde(desdeHistoria);
      const cobradoPorMes = meses.map((m) => ({
        mes: m,
        ...totalesDeCaja(pagos.filter((p) => mesDe(p.fechaPago) === m)),
      }));
      const cajaDeHoy = totalesDeCaja(pagos.filter((p) => p.fechaPago === hoy));

      // ── ingresos ──
      const desdeAsistencia = sumarDias(hoy, -(DIAS_DE_ASISTENCIA - 1));
      const desdeIngresos = esAnterior(primerDia(mes), desdeAsistencia)
        ? primerDia(mes)
        : desdeAsistencia;
      const conteos = repo.ingresosEntre(desdeIngresos, hoy);

      // El mes en curso se muestra hasta hoy, no hasta fin de mes.
      const finDelMes = esAnterior(ultimoDia(mes), hoy) ? ultimoDia(mes) : hoy;
      const delMes = ingresosPorDia(conteos, primerDia(mes), finDelMes);
      const deHoy = ingresosPorDia(conteos, hoy, hoy)[0]!;

      // ── pases ──
      const pases = dePases.map((m) => ({
        clienteId: m.clienteId,
        nroSocio: m.nroSocio,
        nombreCompleto: nombreCompleto(m),
        telefono: m.telefono,
        fecha: m.fechaInicio,
      }));

      return {
        hoy,
        mes,
        meses,
        hoyEnNumeros: {
          sociosActivos: clasificados.activos,
          ingresos: deHoy.permitidos,
          rechazados: deHoy.rechazados,
          cobradoCentavos: cajaDeHoy.totalCentavos,
        },
        porVencer: { dias: DIAS_POR_VENCER, socios: clasificados.porVencer },
        vencidos: {
          dias: DIAS_VENCIDO_RECIENTE,
          recientes: clasificados.vencidosRecientes,
          antiguos: clasificados.vencidosAntiguos,
        },
        cobradoPorMes,
        ingresosPorDia: delMes,
        asistencia: {
          desde: desdeAsistencia,
          hasta: hoy,
          porDiaDeSemana: asistenciaPorDiaDeSemana(conteos, desdeAsistencia, hoy),
        },
        sociosNuevosPorMes: sociosNuevosPorMes(socios, meses),
        pases: {
          porMes: pasesPorMes(pases, meses),
          dias: DIAS_DE_PASES_FRECUENTES,
          frecuentes: clientesFrecuentesConPase(
            pases,
            sumarDias(hoy, -DIAS_DE_PASES_FRECUENTES),
            activosHoy,
          ),
        },
      };
    },
  };
}

export type ServicioReportes = ReturnType<typeof crearServicioReportes>;
export type Reporte = ReturnType<ServicioReportes['resumen']>;
