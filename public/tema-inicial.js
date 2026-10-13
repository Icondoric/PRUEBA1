/* global document, localStorage */
// Antes de pintar, para que no parpadee: oscuro salvo que se haya elegido
// claro. La clave es la de src/web/shared/lib/tema.ts.
// Va en un archivo aparte y no dentro de index.html para que la página pueda
// prohibir todo código en línea (ver cabecerasDePagina en el servidor).
try {
  if (localStorage.getItem('gym-tema') === 'claro') {
    document.documentElement.classList.remove('dark');
  }
} catch {
  // Sin almacenamiento: queda el oscuro de fábrica.
}
