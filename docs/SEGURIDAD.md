# Seguridad — qué se revisó, qué se reforzó y qué queda

Dos revisiones, el 2026-10-12. Se hicieron **leyendo el código** capa por capa
y dejando una prueba automática por cada defensa. No se corrió una herramienta
de ataque contra el sistema en marcha: lo que figura como "revisado" es lo que
el código y las pruebas demuestran.

Dónde están las pruebas:

| Archivo | Qué fija |
|---|---|
| `src/server/acceso.test.ts` | Sin sesión no pasa nada; cada acceso abre solo lo suyo |
| `src/server/proteccion.test.ts` | Cabeceras, origen del pedido, tamaño, tope de intentos |
| `src/server/refuerzos.test.ts` | Rutas mal escritas, bloqueo por equipo, sesiones, topes |

## Lo que ya estaba bien

| Tema | Cómo está resuelto |
|---|---|
| Rutas sin dueño | Toda ruta de la API está cerrada salvo que `src/server/acceso.ts` diga quién puede usarla. Una ruta nueva sin anotar falla cerrada, y un test lo revisa. |
| Contraseñas | `scrypt` con sal propia y comparación en tiempo constante. En la base nunca está la contraseña. |
| Sesiones | Token aleatorio de 32 bytes; en la base solo su hash. Vence por inactividad. Desactivar a alguien o cambiarle la contraseña lo saca en el acto. |
| Cookie | `HttpOnly` (el código de la página no la lee) y `SameSite=Strict` (no viaja desde otro sitio). |
| Inyección SQL | Todo pasa por Drizzle con parámetros; no hay SQL armado con texto del usuario. |
| Texto que se muestra | Vue escapa todo; no hay `v-html` en el proyecto. |
| Exportar a CSV | Un nombre que empieza con `=`, `+`, `-` o `@` se neutraliza para que Excel no lo ejecute como fórmula. |
| Campos de más | Los esquemas descartan lo que no esperan: mandar `rol: 'admin'` al crear un usuario no hace nada. |
| Precio | Nunca viaja desde el navegador: el servidor lo recalcula al vender. |
| Quién registró algo | Sale de la sesión, nunca de un dato que mande el navegador. |
| Memoria del navegador | Al entrar y al salir se borra lo que quedó de la sesión anterior. |
| Errores | Un fallo interno devuelve un mensaje genérico; el detalle queda en el registro del servidor. |
| Red | Por defecto escucha solo en la propia PC (`127.0.0.1`). |

## Primera revisión — lo que se reforzó

Todo en `src/server/middleware/proteccion.ts`, antes del guardia, con lo que
trae Hono (sin dependencias nuevas).

1. **Pedidos desde otra página.** `SameSite` no distingue puertos: otro
   programa que sirva páginas en la misma PC cuenta como "el mismo sitio". Un
   pedido que cambia algo y viene de otro origen se rechaza (403).
2. **Cabeceras.** La API y las páginas piden al navegador que no adivine tipos
   de archivo, que no deje meter el sistema dentro de otra página y que no
   guarde copias de los datos ("atrás" después de cerrar sesión ya no muestra
   clientes).
3. **Solo código propio.** La versión instalada prohíbe todo código que no sea
   del sistema (política de contenido). Para eso el guion que elige el modo
   claro u oscuro pasó de `index.html` a `public/tema-inicial.js`.
4. **Tamaño.** Un pedido de más de 100 KB se rechaza (413). Nombre, apellido,
   CI, teléfono, búsqueda y fechas tienen tope de largo.
5. **Ingreso.** Usuario inexistente y contraseña mala tardan lo mismo; tope de
   20 intentos por minuto por equipo (429); la memoria de intentos fallidos
   tiene un tope.

## Segunda revisión — lo que se encontró y se corrigió

| # | Qué pasaba | Qué se hizo |
|---|---|---|
| 1 | **El bloqueo se podía usar en contra.** Cinco fallos a propósito con el usuario del dueño lo dejaban afuera un minuto, desde cualquier equipo, y se podía repetir sin fin. | El bloqueo ahora es por equipo **y** usuario: le cae a quien falla. La PC de recepción sigue entrando. |
| 2 | **Fecha de inicio sin tope.** Quien vende podía poner una membresía que empezara en el año 9999. Como la renovación se encadena con la anterior, ese cliente quedaba sin poder renovar bien hasta que el dueño anulara el pago. | Tope de un año hacia adelante (`DIAS_MAXIMOS_DE_ANTICIPO`). |
| 3 | **Para el celular había que abrir el sistema a todo el wifi** (`HOST=0.0.0.0`), y el tráfico va sin cifrar. | `HOST` acepta varias direcciones: `HOST=127.0.0.1,100.x.y.z` escucha en la PC y en Tailscale, y en ningún otro lado. Si se usa `0.0.0.0`, el sistema lo avisa al arrancar. |
| 4 | **El registro guardaba datos personales.** Cada búsqueda quedaba escrita con el nombre o el CI buscado. | El registro anota método, ruta, resultado y tiempo; nada de lo que va después del `?` ni el identificador buscado. |
| 5 | **Las sesiones vencidas no se borraban nunca** si nadie volvía a presentarlas. | Se barren en cada ingreso. |
| 6 | **El respaldo llevaba las sesiones abiertas** a la carpeta de la nube. | La copia sale sin ellas. Quien restaure, vuelve a ingresar. |
| 7 | **Se aceptaban contraseñas como `12345678` o `password123`.** | Se rechazan las más comunes y las de un solo carácter repetido. |
| 8 | **Si algún día se entra por HTTPS**, la cookie podía viajar igual por HTTP. | Por HTTPS la cookie se marca `Secure`. |
| 9 | **Búsqueda por identificador sin tope**, y precios y páginas sin máximo. | Tope de 40 caracteres, precio máximo de Bs 1.000.000 y página máxima. |
| 10 | **Una conexión podía quedarse abierta sin terminar de mandar el pedido.** | Tiempo máximo para recibir un pedido (30 s) y tope de conexiones a la vez. |

## Lo que queda — decisiones del dueño

Ordenado por lo que más importa.

1. **El sistema viaja sin cifrar (HTTP).** En la PC de recepción y por
   Tailscale no es un problema: Tailscale cifra. Con `HOST=0.0.0.0` queda
   visible en el wifi del gimnasio y cualquiera conectado puede leer
   contraseñas y sesiones. Usar siempre la forma del punto 3 de arriba.
2. **Recepción puede reconstruir la caja de otros días.** La pantalla de Pagos
   le muestra solo lo cobrado hoy, pero la ficha de cada cliente le muestra
   todos sus pagos y membresías, con monto y fecha. Mirando ficha por ficha se
   arma el total de cualquier mes. Si eso importa, hay que decidir si la ficha
   le oculta a recepción los montos de otros días.
3. **Un cliente dado de baja se puede abrir por su número.** La lista de bajas
   pide el acceso de baja, pero quien conoce el número de un cliente dado de
   baja puede abrir su ficha. Decidir si la ficha de una baja también pide ese
   acceso.
4. **Correr siempre la versión instalada** (`pnpm build` y `pnpm start`), no
   `pnpm dev`: el modo de desarrollo no aplica la política de contenido y sirve
   el código fuente.
5. **Respaldos.** El archivo tiene los datos de todos los clientes y los hashes
   de las contraseñas, sin cifrar. La carpeta de la nube tiene que ser privada.
   Falta decidir si se cifra.
6. **Doble clic al cobrar.** El botón se desactiva mientras se guarda, pero el
   servidor no detecta dos ventas iguales seguidas. Si pasara, se anula una.
7. **Dependencias.** `pnpm audit` no se pudo ejecutar en la sesión de la
   revisión; correrlo a mano cada tanto.

## Al agregar una ruta nueva

- Anotarla en `src/server/acceso.ts` (si no, queda cerrada).
- Darle un tope de largo a cada texto del esquema, también a los parámetros
  de la ruta.
- Si cambia algo, que sea POST, PUT o DELETE: nunca un GET. La defensa de
  origen solo protege a los que cambian algo.
- Si recibe una fecha o un monto, ponerle máximo además de mínimo.
