/**
 * Datos para administrar planes y precios. Solo para quien tiene ese acceso.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import type {
  ListaDePlanes,
  PlanAdministrable,
  SimulacionDePrecio,
} from '@/modules/planes';
import { clavesMembresias } from '@/web/features/membresias/api/membresias.api';
import { api, pedir } from '@/web/shared/lib/api';

export type { PlanAdministrable, SimulacionDePrecio };

export const clavesPlanes = {
  todo: ['gestion-planes'] as const,
  lista: ['gestion-planes', 'lista'] as const,
};

export interface DatosDePrecio {
  precioCentavos: number;
  vigenteDesde: string;
  vigenteHasta?: string | null;
  esPromocion: boolean;
  etiqueta?: string | null;
}

export function usePlanesAdministrables() {
  return useQuery({
    queryKey: clavesPlanes.lista,
    queryFn: () => pedir<ListaDePlanes>(api['gestion-planes'].$get()),
    // Son precios: siempre lo último.
    staleTime: 0,
  });
}

/** Todas las acciones. Cada una refresca esta pantalla y la de venta. */
export function useGestionDePlanes() {
  const qc = useQueryClient();
  const refrescar = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: clavesPlanes.todo }),
      qc.invalidateQueries({ queryKey: clavesMembresias.todo }),
    ]);
  const opciones = { retry: false, onSuccess: refrescar };

  return {
    crearPlan: useMutation({
      mutationFn: (datos: {
        nombre: string;
        diasDuracion: number;
        esPaseDiario: boolean;
        precioCentavos: number;
      }) => pedir<unknown>(api['gestion-planes'].$post({ json: datos })),
      ...opciones,
    }),

    renombrar: useMutation({
      mutationFn: ({ id, nombre }: { id: number; nombre: string }) =>
        pedir<unknown>(
          api['gestion-planes'][':id'].$put({
            param: { id: String(id) },
            json: { nombre },
          }),
        ),
      ...opciones,
    }),

    cambiarEstado: useMutation({
      mutationFn: ({ id, activo }: { id: number; activo: boolean }) =>
        pedir<unknown>(
          api['gestion-planes'][':id'].estado.$put({
            param: { id: String(id) },
            json: { activo },
          }),
        ),
      ...opciones,
    }),

    agregarPrecio: useMutation({
      mutationFn: ({ planId, datos }: { planId: number; datos: DatosDePrecio }) =>
        pedir<unknown>(
          api['gestion-planes'][':id'].precios.$post({
            param: { id: String(planId) },
            json: datos,
          }),
        ),
      ...opciones,
    }),

    quitarPrecio: useMutation({
      mutationFn: async (precioId: number) => {
        const res = await api['gestion-planes'].precios[':id'].$delete({
          param: { id: String(precioId) },
        });
        if (!res.ok) await pedir<never>(Promise.resolve(res));
      },
      ...opciones,
    }),
  };
}

/** Qué se cobraría con ese precio, sin guardarlo. No refresca nada. */
export function useSimularPrecio() {
  return useMutation({
    mutationFn: ({ planId, datos }: { planId: number; datos: DatosDePrecio }) =>
      pedir<SimulacionDePrecio>(
        api['gestion-planes'][':id'].precios.simulacion.$post({
          param: { id: String(planId) },
          json: datos,
        }),
      ),
    retry: false,
  });
}
