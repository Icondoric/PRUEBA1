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
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { hoyEnZona } from '@/lib/fechas';
import type { ServicioClientes } from '../application/clientes.service';
import { clienteInputSchema, idParamSchema, listarQuerySchema } from './schemas';

export function rutasClientes(servicio: ServicioClientes) {
  return new Hono()
    .get('/', zValidator('query', listarQuerySchema), (c) =>
      c.json(servicio.listar(c.req.valid('query'))),
    )

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

    .delete('/:id', zValidator('param', idParamSchema), (c) => {
      servicio.desactivar(c.req.valid('param').id);
      return c.body(null, 204);
    });
}

export type RutasClientes = ReturnType<typeof rutasClientes>;
