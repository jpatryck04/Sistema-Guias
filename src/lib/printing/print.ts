import type { ItemImpresion, ProgresoImpresion } from '@/types/impresion';

const PDF_LOAD_TIMEOUT = 8000;

/**
 * Imprime una lista de formularios de forma secuencial.
 *
 * LIMITACIÓN IMPORTANTE:
 * Los navegadores modernos NO permiten abrir múltiples diálogos de impresión
 * de forma automatizada. Por cada PDF, se abre el diálogo nativo y el usuario
 * debe confirmar/cerrar antes de continuar con el siguiente.
 *
 * No es posible imprimir silenciosamente ni seleccionar impresora desde JS.
 */
export async function printFormularios(
  items: ItemImpresion[],
  onProgress?: (p: ProgresoImpresion) => void
): Promise<void> {
  // Expandir copias
  const cola: { storagePath: string; nombre: string }[] = [];
  for (const item of items) {
    for (let i = 0; i < item.copias; i++) {
      cola.push({ storagePath: item.storagePath, nombre: item.formularioNombre });
    }
  }

  const total = cola.length;

  for (let i = 0; i < cola.length; i++) {
    const item = cola[i];
    onProgress?.({ actual: i + 1, total, formularioNombre: item.nombre });

    await imprimirUno(item.storagePath, item.nombre);
  }
}

function imprimirUno(storagePath: string, formularioNombre: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const previousTitle = document.title;
    const printTitle = formularioNombre.replace(/\.pdf$/i, '');
    document.title = printTitle;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.src = encodeURI(storagePath);
    iframe.title = formularioNombre;

    let resolved = false;
    let removePrintListeners = () => {};

    const cleanup = (error?: Error) => {
      if (resolved) return;
      resolved = true;
      removePrintListeners();
      try {
        document.body.removeChild(iframe);
      } catch {
        // Ignorar
      }
      document.title = previousTitle;
      if (error) reject(error);
      else resolve();
    };

    const loadTimer = setTimeout(() => {
      if (!resolved) {
        console.warn(`PDF tardó más de ${PDF_LOAD_TIMEOUT}ms: ${storagePath}`);
        cleanup(new Error(`El PDF tardó demasiado en cargar: ${formularioNombre}`));
      }
    }, PDF_LOAD_TIMEOUT);

    iframe.onload = () => {
      clearTimeout(loadTimer);
      setTimeout(() => {
        try {
          const win = iframe.contentWindow;
          if (!win) {
            cleanup(new Error(`No se pudo abrir el PDF: ${formularioNombre}`));
            return;
          }

          const finishAfterPrint = () => {
            cleanup();
          };

          win.addEventListener('afterprint', finishAfterPrint);

          removePrintListeners = () => {
            win.removeEventListener('afterprint', finishAfterPrint);
          };

          win.focus();
          win.print();
        } catch (err) {
          console.error('Error en print:', err);
          cleanup(err instanceof Error ? err : new Error(`Error al imprimir ${formularioNombre}`));
        }
      }, 50);
    };

    iframe.onerror = () => {
      clearTimeout(loadTimer);
      cleanup(new Error(`Error cargando PDF: ${formularioNombre}`));
    };

    document.body.appendChild(iframe);
  });
}