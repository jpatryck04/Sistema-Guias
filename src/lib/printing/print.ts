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

    try {
      await imprimirUno(item.storagePath, item.nombre);
    } catch (err) {
      console.warn('Error al imprimir un formulario, continuando con el siguiente:', err);
    }
  }
}

function imprimirUno(storagePath: string, formularioNombre: string): Promise<void> {
  return new Promise((resolve) => {
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

    const cleanup = () => {
      if (resolved) return;
      resolved = true;
      removePrintListeners();
      try {
        document.body.removeChild(iframe);
      } catch {
        // Ignorar
      }
      document.title = previousTitle;
      resolve();
    };

    const loadTimer = setTimeout(() => {
      if (!resolved) {
        console.warn(`PDF tardó más de ${PDF_LOAD_TIMEOUT}ms: ${storagePath}`);
        cleanup();
      }
    }, PDF_LOAD_TIMEOUT);

    const fallbackPrintTimer = setTimeout(() => {
      if (!resolved) {
        console.warn(`No se recibió afterprint para: ${formularioNombre}. Continuando con el siguiente.`);
        cleanup();
      }
    }, 25000);

    iframe.onload = () => {
      clearTimeout(loadTimer);
      setTimeout(() => {
        try {
          const win = iframe.contentWindow;
          if (!win) {
            clearTimeout(fallbackPrintTimer);
            cleanup();
            return;
          }

          const finishAfterPrint = () => {
            clearTimeout(fallbackPrintTimer);
            cleanup();
          };

          win.addEventListener('afterprint', finishAfterPrint);

          removePrintListeners = () => {
            win.removeEventListener('afterprint', finishAfterPrint);
          };

          win.focus();
          win.print();
        } catch (err) {
          clearTimeout(fallbackPrintTimer);
          console.error('Error en print:', err);
          cleanup();
        }
      }, 50);
    };

    iframe.onerror = () => {
      clearTimeout(loadTimer);
      clearTimeout(fallbackPrintTimer);
      cleanup();
    };

    document.body.appendChild(iframe);
  });
}