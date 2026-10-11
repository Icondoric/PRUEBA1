/**
 * CAPA APPLICATION — casos de uso de visitas: registrar una entrada gratis y
 * ver las que hubo.
 */

import { ReglaDeNegocioError } from '@/lib/errors';
import { type FechaISO, sumarDias } from '@/lib/fechas';
import { rangoDeFechas } from '@/lib/rango';
import { type ServicioClientes, nombreCompleto } from '@/modules/clientes';
import { type DatosVisita, prepararVisita } from '../domain/visita';
import type { RepoVisitas } from '../infrastructure/visitas.repo';

/** Sin fechas, el historial muestra el último mes. */
const DIAS_POR_DEFECTO = 30;

export interface EntradaVisita extends DatosVisita {
  /** Nº de socio o CI de quien la invita, tal como se tecleó. */
  invitadoPor?: string | null;
}

export function crearServicioVisitas(
  repo: RepoVisitas,
  clientes: Pick<ServicioClientes, 'buscarPorIdentificador'>,
) {
  return {
    registrar(entrada: EntradaVisita, hoy: FechaISO, usuarioId: number) {
      const identificador = entrada.invitadoPor?.trim() ?? '';
      const anfitrion = identificador
        ? clientes.buscarPorIdentificador(identificador)
        : null;

      if (identificador && !anfitrion) {
        throw new ReglaDeNegocioError(
          `“${identificador}” no es un número de socio ni un CI registrado`,
          { campo: 'invitadoPor' },
        );
      }

      const visita = repo.insertar({
        ...prepararVisita(entrada, anfitrion !== null),
        fecha: hoy,
        invitadoPorClienteId: anfitrion?.id ?? null,
        registradoPor: usuarioId,
      });

      return { ...visita, anfitrion: anfitrion?.nombreCompleto ?? null };
    },

    listar(filtro: { desde?: string | null; hasta?: string | null }, hoy: FechaISO) {
      const sinFechas = !filtro.desde?.trim() && !filtro.hasta?.trim();
      const rango = rangoDeFechas(
        sinFechas ? { desde: sumarDias(hoy, -DIAS_POR_DEFECTO), hasta: hoy } : filtro,
        hoy,
      );

      const visitas = repo.enRango(rango.desde, rango.hasta).map((fila) => {
        const { anfitrionNombre, anfitrionApellido, anfitrionNroSocio, ...resto } = fila;
        return {
          ...resto,
          anfitrion:
            anfitrionNombre === null
              ? null
              : {
                  nombreCompleto: nombreCompleto({
                    nombre: anfitrionNombre,
                    apellido: anfitrionApellido,
                  }),
                  nroSocio: anfitrionNroSocio,
                },
        };
      });

      return { ...rango, hoy, visitas };
    },
  };
}

export type ServicioVisitas = ReturnType<typeof crearServicioVisitas>;
export type ListaDeVisitas = ReturnType<ServicioVisitas['listar']>;
export type VisitaRegistrada = ReturnType<ServicioVisitas['registrar']>;
