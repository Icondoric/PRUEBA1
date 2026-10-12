/**
 * CAPA HTTP — rutas.
 *
 * Fina a propósito: valida la entrada, llama al servicio, devuelve. Si acá
 * aparece un `if` de negocio, va al dominio.
 *
 * Nada de try/catch: los errores suben al middleware único. Cada try/catch
 * suelto es una forma distinta de responder lo mismo.
 *
 * El `export type` del final es lo que hace funcionar el RPC tipado: el
 * frontend importa ese tipo y Vue sabe exactamente qué devuelve cada ruta.
 *
 * Quién puede llamar a cada ruta lo decide `src/server/acceso.ts`, no este
 * archivo.
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { hoyEnZona } from '@/lib/fechas';
import type { ServicioClientes } from '../application/clientes.service';
import {
  bloqueoInputSchema,
  clienteInputSchema,
  idParamSchema,
  listarQuerySchema,
} from './schemas';

export interface DepsDeClientes {
  /** ¿Quien pide tiene el acceso "Dar de baja y reactivar"? Solo así ve las bajas. */
  puedeVerBajas: (c: Context) => boolean;
}

export function rutasClientes(servicio: ServicioClientes, deps: DepsDeClientes) {
  return (
    new Hono()
      .get('/', zValidator('query', listarQuerySchema), (c) => {
        const { estado, ...filtro } = c.req.valid('query');
        return c.json(
          servicio.listar(
            { ...filtro, deBaja: estado === 'baja' },
            deps.puedeVerBajas(c),
          ),
        );
      })

      .get('/buscar/:identificador', (c) => {
        const cliente = servicio.buscarPorIdentificador(c.req.param('identificador'));
        return c.json({ cliente });
      })

      .get('/:id', zValidator('param', idParamSchema), (c) =>
        c.json(servicio.obtener(c.req.valid('param').id)),
      )

      .post('/', zValidator('json', clienteInputSchema), (c) =>
        c.json(servicio.registrar(c.req.valid('json'), hoyEnZona()), 201),
      )

      .put(
        '/:id',
        zValidator('param', idParamSchema),
        zValidator('json', clienteInputSchema),
        (c) => c.json(servicio.actualizar(c.req.valid('param').id, c.req.valid('json'))),
      )

      .put(
        '/:id/bloqueo',
        zValidator('param', idParamSchema),
        zValidator('json', bloqueoInputSchema),
        (c) =>
          c.json(servicio.bloquear(c.req.valid('param').id, c.req.valid('json').motivo)),
      )

      .delete('/:id/bloqueo', zValidator('param', idParamSchema), (c) =>
        c.json(servicio.desbloquear(c.req.valid('param').id)),
      )

      .post('/:id/reactivacion', zValidator('param', idParamSchema), (c) =>
        c.json(servicio.reactivar(c.req.valid('param').id)),
      )

      // Dar de baja. No borra nada: ver `desactivar` en el servicio.
      .delete('/:id', zValidator('param', idParamSchema), (c) => {
        servicio.desactivar(c.req.valid('param').id);
        return c.body(null, 204);
      })
  );
}

export type RutasClientes = ReturnType<typeof rutasClientes>;
