# Arquitectura

Clean architecture pragmática. Las tres capas sí; los mappers y las entidades
espejo no. El tipo que infiere Drizzle del esquema **es** el tipo del dominio.

## Las capas, y qué puede importar cada una

```
┌─ http ──────────── valida la forma (Zod) y traduce a HTTP
│    ↓ puede usar application
├─ application ───── casos de uso: orquesta dominio + repositorio
│    ↓ puede usar domain e infrastructure (por sus tipos)
├─ domain ────────── reglas puras. NO importa nada de fuera
└─ infrastructure ── todo el SQL. NO tiene reglas de negocio
```

La flecha va en un solo sentido. **El dominio no conoce a nadie**: ni a Drizzle,
ni a Hono, ni al reloj. Todo entra por parámetro. Por eso `renovacion.ts` se
testea con 14 casos en milisegundos, sin base y sin servidor.

Las dos reglas las verifica ESLint en el pre-commit, no la memoria de nadie:

- un módulo se importa por su `index.ts`, nunca por sus internals
- `domain/` no puede importar `hono`, `drizzle-orm` ni `@/lib/db`

## El módulo de referencia

`src/modules/clientes/` está completo y testeado. **Cuando le pidas a Claude
Code un módulo nuevo, decile que siga ese**, no que invente la estructura.

```
clientes/
  domain/
    cliente.ts            normalizar CI, validar alta, derivar socio/eventual
    cliente.test.ts       16 tests, sin base de datos
  application/
    clientes.service.ts   casos de uso: registrar, listar, actualizar, baja
  infrastructure/
    clientes.repo.ts      todo el SQL del módulo
  http/
    schemas.ts            Zod: forma de la entrada
    routes.ts             rutas finas, sin try/catch
    routes.test.ts        12 tests de API contra base real
  index.ts                API pública: moduloClientes(db)
```

### Dónde va cada cosa, con ejemplos reales

| Decisión | Capa | Por qué |
|---|---|---|
| "El CI son 4 a 12 dígitos" | domain | Vale igual si la llama un importador de datos |
| "El nombre es obligatorio" | domain | Es una regla, no un detalle del formulario |
| "¿Vino un string o un número?" | http (Zod) | Es forma, no negocio |
| "Ese CI ya es de otro socio" | application | Necesita consultar: el dominio no puede |
| "SELECT ... WHERE activo = 1" | infrastructure | Es la única capa que sabe SQL |
| "Responder 409 y no 500" | http (middleware) | El negocio no sabe qué es un código HTTP |

## Errores

Excepciones tipadas (`src/lib/errors.ts`) y **un solo** middleware que las
convierte en respuestas. El contrato es siempre el mismo:

```json
{ "error": "CONFLICTO", "mensaje": "Ese CI ya está registrado a nombre de Ana Quispe", "detalles": {} }
```

- `mensaje` lo lee recepción: en español y diciendo qué pasó de verdad.
- **Ninguna ruta tiene try/catch.** Cada uno sería otra forma de responder lo
  mismo, y el frontend tendría que adivinar cuál le tocó.
- Lo que no es un `AppError` sale como 500 y se loguea entero. Disfrazar una
  falla técnica de mensaje amable es como se pierden datos sin que nadie se
  entere.

## Frontend y backend: un solo contrato

Hono exporta el tipo de sus rutas; Vue lo importa:

```ts
// backend
export type AppType = ReturnType<typeof crearApp>;

// frontend
export const api = hc<AppType>('/').api;
```

Renombrás `nroSocio` en el backend → el frontend deja de compilar. Sin generar
nada, sin mantener tipos a mano, sin Postman para saber qué devuelve una ruta.
Los esquemas Zod se comparten igual, así que el formulario de Vue valida con
exactamente las mismas reglas que el servidor.

## Frontend: por funcionalidad

```
web/
  features/
    clientes/
      api/          composables de vue-query  ← el patrón está en clientes.api.ts
      views/        pantallas de ruta
      components/   lo que solo usa esta feature
      composables/  lógica de UI de esta feature
    membresias/ · pagos/ · checkin/ · reportes/
  shared/
    ui/             shadcn-vue (copiados al repo, se editan acá)
    layout/         AppLayout, barra lateral
    lib/            api.ts (cliente RPC), formato de fechas y dinero
  router/
```

Cuando le pedís al agente que toque clientes, todo lo que necesita está en una
carpeta. Esa es toda la ventaja, y es grande.

Reglas del frontend:

- **Todo dato del servidor pasa por `@tanstack/vue-query`.** Nada de
  `ref([])` + `onMounted(fetch)`: eso te deja sin caché ni reintentos, y con
  dos pantallas mostrando números distintos.
- **Nada de Pinia para datos del servidor.** Hoy no hay estado global de UI
  que lo justifique.
- Claves de query jerárquicas (`['clientes', 'lista', filtros]`) para invalidar
  un grupo entero de una sola vez.
- Siempre `<script setup lang="ts">`.

## Tests: dos niveles

| Nivel | Qué cubre | Costo |
|---|---|---|
| Reglas puras | fechas, renovación, precios, acceso, alta de cliente | milisegundos |
| API | cada endpoint contra SQLite en memoria con las migraciones reales | ~2 segundos |

Los de API usan `app.request()` de Hono: no abren puerto ni levantan servidor.
Por eso entran en el pre-commit sin molestar.

La base de los tests se crea con **las migraciones reales**, no con un
`CREATE TABLE` escrito a mano. Si una migración rompe algo, los tests se
enteran; si no, estarías validando una base paralela que se le parece.

Hoy: **138 tests**. Ese número es el contrato que el agente no puede romper sin
que se note.
