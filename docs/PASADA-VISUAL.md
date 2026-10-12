# Pasada visual — pendiente para el final

**Cuándo:** recién cuando estén construidas todas las pantallas (después de la
última rebanada). **No antes.** Hasta entonces las pantallas se hacen con los
componentes y tokens tal como están, y cada cosa nueva se anota en este archivo.

**Qué es:** darle al sistema el aspecto que describe la skill `apple-design`
(`.claude/skills/apple-design/SKILL.md`). Hoy la skill está aplicada solo en el
comportamiento (formularios, estados, tablas, textos); el aspecto es el de
fábrica de shadcn-vue, y por eso se ve genérico.

**Qué NO es:** no se toca lógica, rutas, esquemas ni nada de `src/modules/`.
Es solo `src/web/`.

## Instrucciones para quien haga la pasada

1. **Si tenés dudas, preguntá antes de decidir.** Sobre todo en lo que es
   gusto del dueño y no tiene respuesta técnica: color de acento, nombre y
   logo, qué tan redondeado, modo oscuro sí o no, cuánta translucidez. No
   elijas por él y sigas: mostrá opciones y esperá la respuesta.
2. Cargá la skill `apple-design` antes de empezar.
3. Mostrá el plan y esperá aprobación antes de escribir código.
4. Empezá por los tokens (sección 1). La mayoría de las pantallas cambian
   solas cuando cambian los tokens; recién después se retoca componente por
   componente.
5. Revisá cada pantalla en claro y oscuro, con texto al 200 %, solo con
   teclado y en pantalla angosta. Es el "Review checklist" de la skill.
6. No agregues dependencias (librerías de animación, fuentes, íconos) sin
   preguntar.
7. Al terminar: `pnpm typecheck && pnpm lint && pnpm test` en verde y avisale
   al usuario para que haga el commit. No lo hagas vos.

## Qué falta aplicar de la skill

- **Materiales (§12):** barra lateral y encabezados translúcidos con
  `backdrop-filter`, con su alternativa sólida para
  `prefers-reduced-transparency`.
- **Tipografía (§15):** interletrado y altura de línea según el tamaño;
  jerarquía por peso + tamaño + altura de línea como conjunto.
- **Respuesta (§1):** reacción visible al presionar botones, filas y
  enlaces (`:active`), dentro de los 100 ms.
- **Profundidad:** sombras con criterio (superficie grande = más sombra).
- **Movimiento (§4, §7, §14):** solo con CSS y solo donde ayude; entradas y
  salidas por el mismo camino; versión suave para `prefers-reduced-motion`.
  **El check-in queda sin animaciones:** es un kiosco.

## 1. Tokens y base

| Archivo | Qué ajustar |
|---|---|
| `src/web/styles.css` | Paleta (hoy neutra, sin color de acento), radios, sombras, escala tipográfica, tokens de materiales translúcidos. Revisar los tres colores del check-in (`--acceso-*`) y medir su contraste. |
| `index.html` | Título, ícono de la pestaña, `theme-color`. |

## 2. Componentes base (shadcn-vue, en `src/web/shared/ui/`)

Son copias en el repo: se editan acá.

| Componente | Qué ajustar |
|---|---|
| `button/` | Respuesta al presionar, radios, pesos, variante principal con el color de acento. |
| `input/` | Altura, borde, anillo de foco, estado de error. |
| `label/` | Peso y tamaño. |
| `select/` | Disparador igual al `input`; el desplegable como superficie flotante (material, sombra, origen en el disparador). Textos en inglés que queden. |
| `radio-group/` | Tamaño del control y estado elegido. |
| `badge/` | Colores por significado (socio, eventual, bloqueado, estados de membresía). |
| `table/` | Densidad de filas, encabezado fijo translúcido, fila al pasar el mouse y al presionar. |
| `pagination/` | Página actual, respuesta al presionar. Textos en inglés que queden en `PaginationFirst` y `PaginationLast`. |
| `card/` | Radio, borde y sombra. Hoy casi no se usa: las pantallas arman sus cajas con `rounded-lg border`. Decidir si se unifica en este componente. |
| `skeleton/` | Color y brillo; que respete movimiento reducido. |

## 3. Componentes compartidos (`src/web/shared/`)

| Componente | Qué ajustar |
|---|---|
| `layout/AppLayout.vue` | Barra lateral translúcida, marca (nombre y logo del gimnasio), estado activo de la navegación, versión para pantalla angosta. |
| `layout/NoEncontradaView.vue` | Jerarquía del texto. |
| `components/CampoFormulario.vue` | Espaciado entre etiqueta, control, ayuda y error. |
| `components/ErrorDeCarga.vue` | Aspecto del aviso de error y del botón de reintentar. |

## 4. Pantallas y componentes de cada funcionalidad

### Clientes (`src/web/features/clientes/`)

| Archivo | Qué ajustar |
|---|---|
| `views/ClientesListaView.vue` | Barra de búsqueda y filtros, tabla, estados vacíos, pie con el conteo y la paginación. |
| `views/ClienteFichaView.vue` | Encabezado con el nombre, caja de datos, aviso de bloqueo, aviso de confirmación. |
| `views/ClienteFormView.vue` | Encabezado y ancho del formulario. |
| `components/ClienteForm.vue` | Grilla de campos y botones. |
| `components/ClienteEtiquetas.vue` | Etiquetas de socio, eventual y bloqueado. |

### Membresías (`src/web/features/membresias/`)

| Archivo | Qué ajustar |
|---|---|
| `views/MembresiaVentaView.vue` | Tarjetas de plan (elegida, promo, sin precio), métodos de pago, caja de resumen con el total, botón de cobrar. La casilla "Elegir otra fecha de inicio" es un `<input type="checkbox">` nativo: falta un componente propio. |
| `components/MembresiasDelCliente.vue` | Caja de situación actual (ícono y color por situación), tabla de historial, etiquetas de estado. |

### Check-in (`src/web/features/checkin/`)

| Archivo | Qué ajustar |
|---|---|
| `views/CheckinView.vue` | Tamaños para leer a distancia en el monitor real, los tres colores, el círculo de iniciales (y la foto cuando exista). **Sin animaciones.** |
| `lib/sonido.ts` | No es visual, pero va en la misma revisión: probar los dos sonidos en los parlantes de recepción y ajustar volumen y tono. |
| `components/PaseRapido.vue` | El panel de venta del pase (F2): tamaños para leer de pie, lista de clientes parecidos y su fila elegida, fondo detrás del panel. Es un `<dialog>` nativo: darle entrada y salida por el mismo camino, sin demorar el foco. El campo de nombre es un `<input>` propio, no el componente `input`. |

### Pagos (`src/web/features/pagos/`)

| Archivo | Qué ajustar |
|---|---|
| `views/PagosView.vue` | Filtros de fecha y método, las cinco cajas de totales (hoy son `div` con borde), estado vacío. |
| `components/TablaPagos.vue` | Fila de pago anulado (tachado, etiqueta y motivo), botón "Anular pago" por fila. |
| `components/AnularPagoDialog.vue` | Diálogo de confirmación: es un `<dialog>` nativo con un `<textarea>` propio. Falta un componente base de diálogo y otro de área de texto; unificar con el del pase. |
| `components/PagosDelCliente.vue` | Sección de la ficha. |

### Visitas (`src/web/features/visitas/`)

| Archivo | Qué ajustar |
|---|---|
| `views/VisitasView.vue` | Formulario de registro, aviso de confirmación, tabla del último mes. |

### Reportes (`src/web/features/reportes/`) — solo dueño, primero celular

| Archivo | Qué ajustar |
|---|---|
| `views/ReportesView.vue` | Las cuatro cajas de "Hoy", las listas de por vencer / vencidos / pases frecuentes, el selector de mes, los botones de exportar (se repiten en cada sección: evaluar un menú único). Probar en un celular real, no solo a 390 px. |
| `components/BarraDeDato.vue` | Las barras de los gráficos. Hoy usan el color principal sin más. **Antes de tocarlas, cargar la skill `dataviz`**: validar el color con su script en claro y oscuro, extremo redondeado de 4 px, y agregar el detalle al pasar el mouse o tocar. El número va siempre escrito al lado; eso no se quita. |

### Ingreso (`src/web/features/sesion/`)

| Archivo | Qué ajustar |
|---|---|
| `views/IngresarView.vue` | Es la primera impresión del sistema: marca del gimnasio, tarjeta de ingreso, aviso de sesión vencida. Falta el botón para ver la contraseña. |

### Usuarios (`src/web/features/usuarios/`) — solo dueño

| Archivo | Qué ajustar |
|---|---|
| `views/UsuariosView.vue` | Tabla de usuarios y etiquetas de estado. |
| `views/UsuarioFormView.vue` | Las cuatro secciones (datos, accesos, contraseña, desactivar) y sus separadores. |
| `components/AccesosPorModulo.vue` | Las casillas son `<input type="checkbox">` nativos dentro de `fieldset`: falta un componente propio de casilla (el mismo que necesita la venta de membresías). Cuidar que se lea fácil: es la pantalla donde el dueño decide quién puede qué. |

### Planes y precios (`src/web/features/planes/`)

| Archivo | Qué ajustar |
|---|---|
| `views/PlanesView.vue` | La tarjeta de cada plan: el "se cobra hoy" grande, la fila de botones (son cuatro por plan: evaluar un menú), el historial de precios. |
| `components/PrecioDialog.vue` | Diálogo en dos pasos (escribir, revisar). El paso de revisión es el momento más importante de la pantalla: que el precio que se va a cobrar se lea sin esfuerzo. |
| `components/PlanDialog.vue` | Crear plan / cambiar nombre. Tiene otra casilla nativa. |

### Estado del cliente y cuenta propia

| Archivo | Qué ajustar |
|---|---|
| `clientes/components/EstadoDelCliente.vue` | Sección "Acceso y estado" al pie de la ficha, con el diálogo de bloqueo. Que "dar de baja" se vea como algo serio sin asustar: no borra nada. |
| `shared/components/ConfirmarDialog.vue` | El diálogo de confirmación que usan baja de cliente, baja de plan y quitar precio. Unificar con los demás `<dialog>` en un componente base. |
| `sesion/views/MiCuentaView.vue` | Formulario de cambio de contraseña. |

### Otras piezas nuevas

- `layout/AppLayout.vue`: el bloque de abajo con el nombre de quien está
  adentro y "Cerrar sesión". En angosto el nombre se oculta.
- `layout/SinAccesoView.vue`: la pantalla de "no tenés acceso".

### Pendientes de ancho angosto en pantallas que ya existían

- `clientes/views/ClientesListaView.vue`: a 390 px la tabla ensancha la
  página (mide 453 px). Es una pantalla de recepción y se usa en la PC, pero
  hay que resolverlo.
- `layout/AppLayout.vue`: en angosto el menú se desliza de costado. Funciona,
  pero con seis secciones conviene un menú propio para celular.

## 5. Pantallas que todavía no existen

Se agregan acá a medida que se construyan:

- [x] Venta rápida de pase por sesión desde el check-in (ya está en la sección 4)
- [x] Pagos: historial y anulación (ya está en la sección 4)
- [x] Visitas / cortesías (ya está en la sección 4)
- [x] Reportes, pensados para el celular del dueño (ya está en la sección 4)
- [x] Login y usuarios (ya está en la sección 4)

## 6. Preguntas abiertas para el dueño

Hay que hacerlas antes de empezar la pasada; no tienen respuesta técnica.

- ¿Cuál es el nombre del gimnasio, y tiene logo y colores propios?
- ¿Qué color de acento quiere? (hoy todo es gris y negro)
- ¿Se usa en modo oscuro, claro, o que siga a la PC?
- ¿Qué tan marcado el efecto translúcido? En una PC de recepción modesta
  puede costar rendimiento.
- ¿En qué monitor y a qué distancia se lee el check-in?
