/**
 * `pnpm usuarios:dueno` — crea la cuenta del dueño, o le cambia la contraseña.
 *
 * Por qué es un comando y no una pantalla: quien puede correrlo ya tiene la PC
 * de recepción en sus manos. Una pantalla de "primer uso" en el navegador se la
 * quedaría el primero que llegue. Es también la salida de emergencia si el
 * dueño olvida su contraseña: se corre de nuevo con el mismo usuario.
 *
 * Pregunta los datos por teclado. Para automatizarlo (instalación), se pueden
 * pasar por variables de entorno:
 *   GYM_DUENO_USUARIO, GYM_DUENO_NOMBRE, GYM_DUENO_PASSWORD
 *
 * Al cambiar la contraseña se cierran las sesiones abiertas de esa cuenta.
 */

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { horasDeSesion, rutaDb } from '@/lib/config';
import { crearDb, migrar } from '@/lib/db';
import { esAppError } from '@/lib/errors';
import { moduloUsuarios } from '@/modules/usuarios';

const decir = (linea = '') => stdout.write(`${linea}\n`);

async function pedirDatos() {
  const deEntorno = {
    usuario: process.env.GYM_DUENO_USUARIO?.trim(),
    nombre: process.env.GYM_DUENO_NOMBRE?.trim(),
    password: process.env.GYM_DUENO_PASSWORD,
  };
  if (deEntorno.usuario && deEntorno.nombre && deEntorno.password) {
    return {
      usuario: deEntorno.usuario,
      nombre: deEntorno.nombre,
      password: deEntorno.password,
    };
  }

  const teclado = createInterface({ input: stdin, output: stdout });
  try {
    decir('Cuenta del dueño. Si el usuario ya existe, se le cambia la contraseña.');
    decir();
    const usuario = (await teclado.question('Usuario [dueno]: ')).trim() || 'dueno';
    const nombre = (await teclado.question('Nombre y apellido: ')).trim();
    decir('La contraseña se va a ver mientras la escribís: fijate que nadie mire.');
    const password = await teclado.question('Contraseña (8 caracteres o más): ');
    const repetida = await teclado.question('Repetila: ');

    if (password !== repetida) {
      throw new Error('Las dos contraseñas no coinciden. No se cambió nada.');
    }
    return { usuario, nombre, password };
  } finally {
    teclado.close();
  }
}

async function principal() {
  const datos = await pedirDatos();

  const archivo = rutaDb();
  mkdirSync(dirname(archivo), { recursive: true });
  const db = crearDb(archivo);

  try {
    migrar(db);
    const { servicio } = moduloUsuarios(db, { horasDeSesion: horasDeSesion() });
    const resultado = servicio.asegurarDueno(datos);

    decir();
    decir(
      resultado.creado
        ? `Listo: se creó la cuenta del dueño "${resultado.usuario}".`
        : `Listo: se cambió la contraseña de "${resultado.usuario}" y se cerraron sus sesiones.`,
    );
    decir(`Base: ${archivo}`);
  } finally {
    db.$client.close();
  }
}

principal().catch((error: unknown) => {
  // Un dato inválido (usuario con espacios, contraseña corta) se explica en
  // una línea; cualquier otra cosa se muestra entera.
  if (
    esAppError(error) ||
    (error instanceof Error && error.message.includes('no coinciden'))
  ) {
    console.error(`No se pudo: ${error.message}`);
  } else {
    console.error('Falló el comando:', error);
  }
  process.exitCode = 1;
});
