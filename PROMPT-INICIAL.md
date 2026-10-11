# Cómo arrancar con Claude Code

## Decisiones ya tomadas

| | |
|---|---|
| Tamaño | Gimnasio chico, ~150 socios, una sede |
| Dónde corre | PC de recepción. Es el servidor y dueña de los datos |
| Internet | El check-in NUNCA depende de internet |
| Dueño | Entra por Tailscale solo a reportes, y recibe un resumen diario |
| Respaldo | A carpeta sincronizada a la nube, dos veces al día |
| Ingreso | Teclado: nro de socio o CI. Huella y carnet, más adelante |
| Planes | Varios por duración + pase por sesión + promos por tiempo limitado |
| Pase por sesión | Se anota el nombre. Lo compran no socios, socios vencidos y acompañantes |
| Excepciones | Cortesías gratis sí. Congelamiento: a confirmar con el dueño |
| Backend | TypeScript · Hono · SQLite + Drizzle · Zod |
| Frontend | Vue 3 · Vite · shadcn-vue + Tailwind · vue-query · vee-validate |
| Arquitectura | Clean pragmática: 3 capas, sin mappers ni entidades espejo |
| API | Hono RPC: tipos end-to-end, sin generar nada |
| Errores | Excepciones tipadas + un único middleware |
| Tests | Reglas puras + API contra base real |
| Calidad | ESLint + Prettier + hook pre-commit |

---

## Qué viene ya hecho en este kit

No es solo documentación: hay **60 tests pasando** y el typecheck limpio.

```
src/lib/fechas.ts                         aritmética de fechas sin zonas horarias
src/lib/errors.ts                         errores tipados
src/lib/db/schema.ts                      las 7 tablas
src/lib/db/index.ts                       conexión (WAL, foreign keys)
drizzle/0000_inicial.sql                  migración real generada del esquema
src/server/index.ts                       app Hono + export del tipo AppType
src/server/middleware/errores.ts          el único traductor a HTTP
src/modules/membresias/domain/            renovacion.ts (14 tests) · precios.ts (9)
src/modules/checkin/domain/acceso.ts      (9 tests)
src/modules/clientes/                     ← MÓDULO DE REFERENCIA, 4 capas completas
src/web/shared/lib/api.ts                 cliente RPC tipado
src/web/features/clientes/api/            patrón de vue-query
src/test/db.ts                            SQLite en memoria con migraciones reales
scripts/backup.ts                         respaldo con VACUUM INTO
eslint.config.js                          incluye los límites entre capas
docs/ARQUITECTURA.md · docs/INSTALACION.md
```

---

## Paso 0 — Levantar el proyecto

```bash
# copiar el kit a una carpeta nueva
cd gimnasio && git init && pnpm install

# backend
pnpm add hono @hono/zod-validator drizzle-orm better-sqlite3 zod
pnpm add -D typescript vitest drizzle-kit tsx @types/better-sqlite3 @types/node

# frontend
pnpm add vue vue-router @tanstack/vue-query vee-validate @vee-validate/zod
pnpm add -D vite @vitejs/plugin-vue vue-tsc tailwindcss @tailwindcss/vite

# calidad
pnpm add -D eslint typescript-eslint @eslint/js eslint-plugin-vue \
            prettier prettier-plugin-tailwindcss husky
pnpm exec husky init

# shadcn-vue NO es dependencia: copia componentes al repo
pnpm dlx shadcn-vue@latest init

pnpm test   # 60 tests tienen que pasar ANTES de abrir Claude Code
```

---

## Paso 1 — Primer prompt (copiar tal cual)

> Leé `CLAUDE.md` y `docs/ARQUITECTURA.md` completos. Después leé el módulo
> `src/modules/clientes/` entero: es el molde que vas a seguir en todo lo demás.
>
> Las reglas puras que ya existen (`fechas.ts`, `renovacion.ts`, `precios.ts`,
> `acceso.ts`, `cliente.ts`) están decididas y testeadas. No las modifiques.
>
> Tarea de esta sesión: dejar el proyecto corriendo de punta a punta.
>
> 1. `src/server/main.ts`: arranque con @hono/node-server, que lea la ruta de
>    la base de una variable de entorno con un default sensato, corra las
>    migraciones al iniciar y sirva la SPA. En desarrollo, Vite en modo
>    middleware; en producción, los archivos compilados.
> 2. Frontend mínimo que levante: main.ts con vue-query y vue-router,
>    AppLayout en `web/shared/layout/`, y la pantalla de listado de clientes en
>    `web/features/clientes/views/`, usando los composables que ya están en
>    `web/features/clientes/api/clientes.api.ts` y componentes de shadcn-vue.
>    Tabla con búsqueda, filtro socio/eventual y paginación.
> 3. Ficha del cliente: datos + alta y edición con vee-validate reusando
>    `clienteInputSchema`.
> 4. `scripts/seed.ts`: 4 planes (Pase por sesión 1 día, Mensual 30,
>    Trimestral 90, Anual 365), precios base más una promo vigente este mes, y
>    150 clientes con 5 meses de historial.
>    Tiene que haber de todo: socios al día, uno que vence hoy, uno que vence
>    en 2 días, vencidos hace poco, vencidos hace meses, uno bloqueado, unos 20
>    eventuales que solo compraron pases (algunos repetidos, algunos referidos
>    por un socio) y algunas cortesías en `visitas`.
>    Generá las membresías con `calcularPeriodo` (con `encadenable: false` para
>    los pases) y los precios con `resolverPrecio`. Nada de datos inventados
>    a mano.
> 5. `scripts/backup.cli.ts`: envoltorio de `scripts/backup.ts` que lea las
>    rutas de variables de entorno.
>
> Antes de escribir código mostrame el plan y esperá que lo apruebe.
> Al terminar: `pnpm typecheck && pnpm lint && pnpm test` en verde y un commit.

---

## Paso 2 — Las siguientes rebanadas

Una por sesión. Plan mode primero, commit al final. **No las pidas juntas.**
En cada una, la instrucción base es la misma: *seguí la estructura de
`modules/clientes`*.

```
2. Módulo membresias (las 4 capas): venta y renovación.
   Usar calcularPeriodo y resolverPrecio.
   La pantalla muestra período Y precio resultante, con la promo aplicada,
   ANTES de confirmar.

3. Módulo checkin + pantalla /checkin.
   Autofoco, Enter envía, full screen verde/amarillo/rojo con foto, sonido
   distinto por resultado, autolimpieza a los 3s. Usar evaluarAcceso.
   Medir que responda en menos de 100ms con los 150 socios del seed.

4. Venta de pase por sesión: flujo de UN paso desde el check-in.
   Nombre, plan de sesión, cobro. Menos de 15 segundos, porque la persona
   está parada en el mostrador. Si ya existe (socio vencido o alguien que ya
   vino), buscarla en vez de duplicarla.
   Módulo pagos: registro, historial, anulación con motivo.
   Módulo visitas: cortesías gratis.

5. Reportes (los mira el dueño desde el celular: tienen que verse bien en
   pantalla chica): vencen esta semana · vencidos · ingresos por día ·
   cobrado por mes y método · socios nuevos · asistencia · pases vendidos con
   quiénes vinieron más de 3 veces. Exportar a CSV.
   Los pases NO cuentan como socios activos en ninguna métrica.

6. Auth: usuarios y roles. /checkin solo recepción, /reportes solo admin.
   Llenar creado_por y registrado_por en todo.

7. Operación: resumen diario por Telegram, y probar una restauración del
   respaldo de punta a punta.
```

---

## Paso 3 — Recién acá, la skill

Con `clientes` y `membresias` hechos, crear módulos ya es repetitivo:

> Creá una skill en `.claude/skills/nuevo-modulo/SKILL.md` que genere un módulo
> con las 4 capas siguiendo la estructura exacta de `src/modules/clientes/`.
> Que lea ese módulo primero para extraer el patrón real en vez de inventarlo.

---

## Lo que más importa, más que el stack

- **Plan mode antes de cada rebanada.** Leé el plan, corregilo, recién después
  dejalo escribir. Es el punto más barato para atajar un malentendido.
- **Un commit por rebanada.** El pre-commit corre typecheck, lint y tests: si
  pasa, no rompiste nada de lo anterior.
- **Si rompe un test de `renovacion`, `precios`, `acceso` o `cliente`, el que
  está mal es el código nuevo.** Decíselo explícitamente cuando pase.
- **`/clear` entre rebanadas.** El contexto de la tarea anterior confunde más
  de lo que ayuda; `CLAUDE.md` ya tiene lo que necesita.
- **Mostrale la demo al dueño después del paso 4.** Con check-in y venta de
  pases andando ya se entiende el sistema, y ahí preguntale lo de
  congelamientos antes de construir algo que no usa.
