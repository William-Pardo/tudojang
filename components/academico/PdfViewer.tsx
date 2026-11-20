import React from 'react';
import { Document, Page } from 'react-pdf';
import './pdfWorkerConfig';
import { type ProgresoLocalSync, type ProgresoSyncPayload, useProgressSync } from '../../hooks/academico/useProgressSync';
import { useRegistrarActividad } from '../../hooks/academico/useRegistrarActividad';

interface PdfViewerProps {
  tenantId: string;
  asignacionId: string;
  titulo: string;
  /** URL temporal firmada de Drive (services/storage/driveService). Sin ella, se muestra
   *  solo el seguimiento por página, sin contenido real (fallback si Drive no responde). */
  url?: string;
  totalPaginas: number;
  permanenciaMinimaMs?: number;
  sincronizar: (payload: ProgresoSyncPayload) => void | Promise<void>;
  cargarProgreso?: () => ProgresoLocalSync | null | Promise<ProgresoLocalSync | null>;
  /** Props opcionales para el registro de métricas académicas */
  estudianteId?: string;
  estudianteNombre?: string;
  recursoId?: string;
  /** Notifica la relación de aspecto calculada (ancho / alto) para que el modal adapte su ancho en desktop */
  onRatioCalculado?: (ratio: number) => void;
}

const PdfViewer: React.FC<PdfViewerProps> = ({
  tenantId,
  asignacionId,
  titulo,
  url,
  totalPaginas,
  permanenciaMinimaMs = 5000,
  sincronizar,
  cargarProgreso,
  estudianteId,
  estudianteNombre,
  recursoId,
  onRatioCalculado,
}) => {
  const { flush, progreso, registrarPaginaPdf } = useProgressSync({
    tenantId,
    asignacionId,
    tipo: 'pdf',
    sincronizar,
    cargarProgreso,
  });

  const [numPaginasReal, setNumPaginasReal] = React.useState<number | null>(null);
  const [errorCarga, setErrorCarga] = React.useState(false);
  const [paginaActual, setPaginaActual] = React.useState(1);
  const [contenedorAncho, setContenedorAncho] = React.useState<number>(640);
  const [contenedorAlto, setContenedorAlto] = React.useState<number>(480);
  const [pageRatio, setPageRatio] = React.useState<number | null>(null);
  const contenedorRef = React.useRef<HTMLDivElement | null>(null);
  const temporizadorPermanenciaRef = React.useRef<number | null>(null);
  const progresoRef = React.useRef(progreso);
  progresoRef.current = progreso;

  // Ajuste responsivo automático: mide ancho y alto del contenedor para escalar la página del PDF sin desbordar
  React.useEffect(() => {
    if (!contenedorRef.current) return;
    const elemento = contenedorRef.current;

    const actualizarDimensiones = () => {
      if (elemento) {
        const anchoDisponible = Math.max(200, elemento.clientWidth - 16);
        const altoDisponible = Math.max(160, elemento.clientHeight - 16);
        setContenedorAncho(anchoDisponible);
        setContenedorAlto(altoDisponible);
      }
    };

    actualizarDimensiones();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        actualizarDimensiones();
      });
      observer.observe(elemento);
      return () => observer.disconnect();
    }
  }, []);

  // Escalar proporcionalmente para que la página quepa al 100% en pantalla (contain) sin requerir scroll
  const escalaAncho = React.useMemo(() => {
    if (!pageRatio || !contenedorAlto || !contenedorAncho) {
      return contenedorAncho;
    }
    const ratioContenedor = contenedorAncho / contenedorAlto;
    if (ratioContenedor > pageRatio) {
      // El alto es la restricción: ajusta ancho según el alto disponible
      return Math.floor(contenedorAlto * pageRatio);
    }
    // El ancho es la restricción
    return contenedorAncho;
  }, [contenedorAncho, contenedorAlto, pageRatio]);

  // El PDF real manda sobre la estimación guardada en la asignación en cuanto carga.
  const totalPaginasEfectivo = numPaginasReal ?? totalPaginas;
  const hayPaginas = totalPaginasEfectivo > 0;

  React.useEffect(() => {
    setPaginaActual((actual) => Math.min(Math.max(actual, 1), Math.max(totalPaginasEfectivo, 1)));
  }, [totalPaginasEfectivo]);

  // Hook de métricas — solo activo si se proveen los datos del estudiante
  const { registrarProgresoPdf } = useRegistrarActividad({
    tenantId,
    estudianteId: estudianteId ?? '',
    estudianteNombre,
    asignacionId,
    recursoId: recursoId ?? asignacionId,
    tituloRecurso: titulo,
  });

  const registrarPaginaConMetrica = React.useCallback(
    (pagina: number) => {
      registrarPaginaPdf(pagina);

      if (estudianteId && totalPaginasEfectivo > 0) {
        const paginasUnicas = Array.from(new Set([...progresoRef.current.paginasVistas, pagina]));
        const porcentajePaginas = Math.round((paginasUnicas.length / totalPaginasEfectivo) * 100);
        registrarProgresoPdf({
          paginasVistas: paginasUnicas.sort((a, b) => a - b),
          totalPaginas: totalPaginasEfectivo,
          porcentajePaginas,
        });
      }
    },
    [estudianteId, registrarPaginaPdf, registrarProgresoPdf, totalPaginasEfectivo]
  );

  // Permanencia automática: la página visible se cuenta como "vista" recién después de
  // permanecer abierta permanenciaMinimaMs (mismo criterio que el visor anterior, ahora
  // atado a la navegación real en vez de un click de "abrir página X").
  React.useEffect(() => {
    if (!hayPaginas) return;
    if (temporizadorPermanenciaRef.current) {
      window.clearTimeout(temporizadorPermanenciaRef.current);
    }
    temporizadorPermanenciaRef.current = window.setTimeout(() => {
      registrarPaginaConMetrica(paginaActual);
    }, permanenciaMinimaMs);

    return () => {
      if (temporizadorPermanenciaRef.current) {
        window.clearTimeout(temporizadorPermanenciaRef.current);
      }
    };
  }, [paginaActual, hayPaginas, permanenciaMinimaMs, registrarPaginaConMetrica]);

  const cambiarPagina = React.useCallback((nuevaPagina: number) => {
    registrarPaginaConMetrica(paginaActual);
    flush();
    setPaginaActual(nuevaPagina);
  }, [flush, paginaActual, registrarPaginaConMetrica]);

  return (
    <section className="flex flex-col flex-1 min-h-0 overflow-hidden p-0 sm:p-1">
      <h3 className="sr-only">{titulo}</h3>
      <p className="sr-only">Visor PDF</p>

      {!hayPaginas ? (
        <div className="rounded-2xl border border-dashed border-gray-200 dark:border-white/10 p-8 text-center text-sm font-bold text-gray-400">
          Sin paginas disponibles
        </div>
      ) : (
        <div className="flex flex-col flex-1 min-h-0 space-y-2 overflow-hidden">
          <p className="sr-only">
            Paginas registradas: {progreso.paginasVistas.length}/{totalPaginasEfectivo}
          </p>
          <div
            ref={contenedorRef}
            className="rounded-2xl border border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 flex items-center justify-center flex-1 min-h-0 overflow-hidden p-1 select-none"
          >
            {url && !errorCarga ? (
              <Document
                file={url}
                onLoadSuccess={({ numPages }) => setNumPaginasReal(numPages)}
                onLoadError={() => setErrorCarga(true)}
                loading={<p className="text-sm font-bold text-gray-400 py-10">Cargando documento...</p>}
                error={<p className="text-sm font-bold text-red-500 py-10">No se pudo cargar el PDF.</p>}
                className="flex items-center justify-center max-w-full max-h-full [&_.react-pdf__Page]:!bg-transparent [&_.react-pdf__Page]:flex [&_.react-pdf__Page]:items-center [&_.react-pdf__Page]:justify-center [&_.react-pdf__Page__canvas]:max-h-full [&_.react-pdf__Page__canvas]:max-w-full [&_.react-pdf__Page__canvas]:object-contain [&_.react-pdf__Page__canvas]:!h-auto [&_.react-pdf__Page__canvas]:rounded-xl shadow-sm"
              >
                <Page
                  pageNumber={Math.min(paginaActual, totalPaginasEfectivo)}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  width={escalaAncho}
                  onLoadSuccess={(page: any) => {
                    const origW = page.originalWidth || page.width || (page.view && page.view[2]) || 1;
                    const origH = page.originalHeight || page.height || (page.view && page.view[3]) || 1;
                    if (origW && origH) {
                      const ratio = origW / origH;
                      setPageRatio(ratio);
                      onRatioCalculado?.(ratio);
                    }
                  }}
                />
              </Document>
            ) : (
              <p className="text-sm font-bold text-gray-400 text-center py-10">
                {url ? 'No se pudo cargar el PDF real. Se sigue registrando el avance por página.' : 'Vista previa no disponible.'}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 shrink-0 pt-0.5">
            <button
              type="button"
              onClick={() => cambiarPagina(Math.max(1, paginaActual - 1))}
              disabled={paginaActual <= 1}
              className="rounded-xl bg-tkd-dark text-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest disabled:opacity-30"
            >
              ‹ Anterior
            </button>

            <div className="text-center">
              <p className="text-xs font-black text-tkd-dark dark:text-white leading-tight">
                Pagina {paginaActual} de {totalPaginasEfectivo}
                {progreso.paginasVistas.includes(paginaActual) && (
                  <span className="ml-1.5 text-green-500 text-[10px] font-black uppercase tracking-wider">✓ Vista</span>
                )}
              </p>
              <p className="text-[9px] text-gray-400 font-bold">
                {progreso.paginasVistas.length} de {totalPaginasEfectivo} registradas
              </p>
            </div>

            <button
              type="button"
              onClick={() => cambiarPagina(Math.min(totalPaginasEfectivo, paginaActual + 1))}
              disabled={paginaActual >= totalPaginasEfectivo}
              className="rounded-xl bg-tkd-dark text-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest disabled:opacity-30"
            >
              Siguiente ›
            </button>
          </div>

          {/* Sincronización automática en segundo plano: botones accesibles y compatibles con tests sin ocupar espacio visual */}
          <div className="sr-only" aria-hidden="false">
            <button
              type="button"
              onClick={() => {
                registrarPaginaConMetrica(paginaActual);
                flush();
              }}
            >
              Marcar pagina actual como vista
            </button>

            <button
              type="button"
              onClick={flush}
              title="Sincronizar avance ahora"
            >
              Sincronizar avance
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default PdfViewer;
