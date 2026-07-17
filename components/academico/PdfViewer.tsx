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
  const temporizadorPermanenciaRef = React.useRef<number | null>(null);
  const progresoRef = React.useRef(progreso);
  progresoRef.current = progreso;

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

  return (
    <section className="rounded-[1.5rem] bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/10 p-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-tkd-red">Visor PDF</p>
          <h3 className="mt-2 text-xl font-black uppercase text-tkd-dark dark:text-white">{titulo}</h3>
          <p className="mt-2 text-sm text-gray-500">
            Paginas registradas: {progreso.paginasVistas.length}/{totalPaginasEfectivo}
          </p>
        </div>
        <button
          type="button"
          onClick={flush}
          className="rounded-2xl bg-tkd-dark text-white px-5 py-3 text-[10px] font-black uppercase tracking-widest"
        >
          Sincronizar avance
        </button>
      </div>

      {!hayPaginas ? (
        <div className="rounded-2xl border border-dashed border-gray-200 dark:border-white/10 p-8 text-center text-sm font-bold text-gray-400">
          Sin paginas disponibles
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-white/5 flex items-center justify-center min-h-[280px] overflow-auto p-4">
            {url && !errorCarga ? (
              <Document
                file={url}
                onLoadSuccess={({ numPages }) => setNumPaginasReal(numPages)}
                onLoadError={() => setErrorCarga(true)}
                loading={<p className="text-sm font-bold text-gray-400 py-10">Cargando documento...</p>}
                error={<p className="text-sm font-bold text-red-500 py-10">No se pudo cargar el PDF.</p>}
              >
                <Page
                  pageNumber={Math.min(paginaActual, totalPaginasEfectivo)}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  width={640}
                />
              </Document>
            ) : (
              <p className="text-sm font-bold text-gray-400 text-center py-10">
                {url ? 'No se pudo cargar el PDF real. Se sigue registrando el avance por página.' : 'Vista previa no disponible.'}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
              disabled={paginaActual <= 1}
              className="rounded-xl bg-tkd-dark text-white px-4 py-2 text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
            >
              ‹ Anterior
            </button>

            <p className="text-sm font-black text-tkd-dark dark:text-white">
              Pagina {paginaActual} de {totalPaginasEfectivo}
              {progreso.paginasVistas.includes(paginaActual) && (
                <span className="ml-2 text-green-500 text-[10px] font-black uppercase tracking-wider">✓ Vista</span>
              )}
            </p>

            <button
              type="button"
              onClick={() => setPaginaActual((p) => Math.min(totalPaginasEfectivo, p + 1))}
              disabled={paginaActual >= totalPaginasEfectivo}
              className="rounded-xl bg-tkd-dark text-white px-4 py-2 text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
            >
              Siguiente ›
            </button>
          </div>

          <button
            type="button"
            onClick={() => registrarPaginaConMetrica(paginaActual)}
            className="w-full rounded-xl bg-tkd-blue text-white px-4 py-2 text-[10px] font-black uppercase tracking-widest"
          >
            Marcar pagina actual como vista
          </button>
        </div>
      )}
    </section>
  );
};

export default PdfViewer;
