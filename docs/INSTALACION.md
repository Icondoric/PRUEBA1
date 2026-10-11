# Instalación y operación en el gimnasio

El sistema es **un solo proceso Node** que sirve la aplicación web y guarda
todo en **un archivo SQLite**. No hay base de datos que instalar, ni Docker,
ni servicios. Lo mismo en Windows, macOS y Linux.

```
C:\Gimnasio\            (o ~/Gimnasio en Mac/Linux)
  app\                  el sistema
  datos\
    gimnasio.db         ← TODA la información del gimnasio está acá
    fotos\
  respaldos\
```

---

## 1. Instalar

1. Instalar **Node.js 22 LTS** desde nodejs.org (instalador normal, siguiente-siguiente).
2. Copiar la carpeta `app` al disco.
3. Desde esa carpeta:
   ```
   pnpm install
   pnpm usuarios:dueno
   pnpm start
   ```
   La carpeta `app` ya trae `dist/` compilado (se genera con `pnpm build` en
   la máquina de desarrollo). Las migraciones de la base se aplican solas cada
   vez que arranca el sistema: no hay un paso aparte.

   La instalación es completa (sin `--prod`) porque los comandos de
   mantenimiento (`pnpm usuarios:dueno`, `pnpm backup`) necesitan las
   herramientas de desarrollo para correr.
4. Abrir `http://localhost:3000` en el navegador e ingresar con la cuenta del
   dueño.

### La cuenta del dueño

`pnpm usuarios:dueno` pregunta usuario, nombre y contraseña, y crea la cuenta
del dueño. No hay otra forma de crearla: el sistema no tiene una pantalla de
"primer uso", para que nadie que llegue antes a la PC se quede con el control.

**Si el dueño olvida su contraseña**, se corre el mismo comando con el mismo
usuario: le pone la contraseña nueva y cierra sus sesiones abiertas.

El resto de los usuarios los crea el dueño desde la pantalla "Usuarios".

### Variables de entorno

Todas son opcionales; los defaults sirven para la instalación de arriba.

| Variable | Default | Para qué |
|---|---|---|
| `GYM_DB` | `./datos/gimnasio.db` | Archivo de la base |
| `PORT` | `3000` | Puerto del sistema |
| `HOST` | `127.0.0.1` | Dónde escucha. Ver el punto 4 antes de cambiarlo |
| `GYM_RESPALDOS` | `./respaldos` | Carpeta local de respaldos |
| `GYM_RESPALDOS_NUBE` | (ninguna) | Carpeta sincronizada a la nube |
| `GYM_SESION_HORAS` | `8` | Horas sin uso tras las que una sesión se cierra sola |

---

## 2. Que arranque solo al prender la PC

Esto no es opcional. Si recepción tiene que acordarse de abrir una terminal,
el sistema va a estar apagado la mitad de los días.

**Windows** — Programador de tareas: tarea nueva, disparador "Al iniciar el
equipo", acción: ejecutar `node` con argumento `dist/server/main.js` y el
directorio de inicio en la carpeta `app`. Marcar "Ejecutar tanto si el usuario
inició sesión como si no".

**macOS** — un `launchd` plist en `~/Library/LaunchAgents/` con `RunAtLoad` y
`KeepAlive` en true.

**Linux** — un servicio systemd de usuario con `Restart=always`.

En los tres casos lo importante es `KeepAlive` / `Restart`: si el proceso se
cae, vuelve solo.

---

## 3. La pantalla de check-in

En la PC de recepción, un acceso directo que abra el navegador en modo kiosco
directo a la pantalla de ingreso:

```
chrome.exe --kiosk --app=http://localhost:3000/checkin
```

Modo kiosco = sin barra de direcciones, sin pestañas, sin forma de salirse por
accidente. La pantalla se queda ahí todo el día con el cursor en el campo.

---

## 4. Acceso del dueño desde el celular

**Tailscale** (gratis para uso personal). Se instala en la PC del gimnasio y en
el celular del dueño, ambos con la misma cuenta. El celular queda en la misma
red privada que la PC, y el dueño entra a `http://gimnasio-pc:3000/reportes`
desde cualquier lado.

Para eso el sistema tiene que arrancar con `HOST=0.0.0.0`. Por defecto escucha
solo en `127.0.0.1` (la propia PC de recepción).

Con `HOST=0.0.0.0` el sistema queda visible también en el wifi del gimnasio.
Lo que protege los datos es el ingreso con usuario y contraseña: sin sesión no
se ve nada. Por eso, antes de abrirlo:

- la cuenta del dueño tiene que tener una contraseña larga y que no use en
  otro lado;
- cada recepcionista, su propio usuario;
- si se puede, que el wifi de los socios no sea el mismo que el de la PC de
  recepción.

El dueño entra desde el celular con su usuario y ve lo mismo que en la PC,
incluidos los reportes.

Por qué Tailscale y no abrir un puerto en el router: no se expone nada a
internet, no hace falta IP fija ni tocar el router, y no hay un login del
sistema colgando de la web pública esperando que alguien lo pruebe.

Alternativa si preferís una URL normal: Cloudflare Tunnel, también gratis.

> Importante: si no hay internet, el dueño no ve reportes. **El gimnasio sigue
> funcionando igual**, porque recepción le pega a `localhost`. Esa es
> exactamente la decisión de arquitectura que tomamos.

---

## 5. Respaldos

Lo que protege contra "se quemó la PC". Configurar el día uno, no después.

1. Instalar el cliente de escritorio de Google Drive (o OneDrive) en la PC y
   crear una carpeta sincronizada, por ejemplo `G:\Mi unidad\Respaldos Gimnasio`.
2. Programar `pnpm backup` dos veces al día (al mediodía y al cerrar), con
   la misma herramienta del punto 2, y con la variable `GYM_RESPALDOS_NUBE`
   apuntando a esa carpeta. Si la copia a la nube no se puede hacer, el
   comando termina con código 2 para que la tarea programada lo marque.
3. El script hace `VACUUM INTO` (copia consistente sin parar el sistema),
   verifica que la copia se pueda abrir, la deja en la carpeta local y en la
   sincronizada, y conserva las últimas 14.

**Nunca copies `gimnasio.db` con copiar/pegar mientras el sistema corre.** Si
hay una escritura en curso la copia sale corrupta, y te enterás el día que la
necesitás.

**Probá una restauración ahora, no cuando haya un incendio.** Copiar un
respaldo a otra carpeta, apuntar el sistema ahí y ver que los datos estén.
Un respaldo que nunca se restauró no es un respaldo, es una esperanza.

---

## 6. Resumen diario al dueño

Un trabajo programado al cierre que arma los números del día y los manda por
Telegram (gratis, un bot se crea en dos minutos con @BotFather, y no hay SMTP
ni API de WhatsApp Business de por medio).

Contenido: cuántos entraron, cuántos rebotaron por vencidos, cuánto se cobró
y por qué método, socios nuevos, y quiénes vencen en los próximos 3 días.

Si no hay internet, el envío falla sin romper nada y se reintenta al día
siguiente. No es información crítica.

---

## 7. Si el gimnasio crece y hay que migrar a la nube

El esquema está escrito a propósito sin usar nada exclusivo de SQLite, y todo
el acceso a datos pasa por Drizzle. La migración es:

1. Cambiar `sqliteTable` por `pgTable` en `src/lib/db/schema.ts`
2. Levantar un Postgres administrado
3. Correr un script de exportación/importación tabla por tabla
4. Desplegar el mismo servidor Hono en la nube

Es trabajo de un día, no una reescritura. Y recién tiene sentido si aparece una
segunda sede o si quieren que el dueño cargue datos desde el celular con la PC
apagada.
