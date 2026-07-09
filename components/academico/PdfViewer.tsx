import React from 'react';
import { type ProgresoLocalSync, type ProgresoSyncPayload, useProgressSync } from '../../hooks/academico/useProgressSync';
import { useRegistrarActividad } from '../../hooks/academico/useRegistrarActividad';

interface PdfViewerProps {
  tenantId: string;
  asignacionId: string;
  titulo: string;
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
  const [paginaAbierta, setPaginaAbierta] = React.useState<number | null>(null);
  const temporizadorPermanenciaRef = React.useRef<number | null>(null);

  const paginas = Array.from({ length: Math.max(totalPaginas, 0) }, (_, index) => index + 1);

  React.useEffect(() => () => {
    if (temporizadorPermanenciaRef.current) {
      window.clearTimeout(temporizadorPermanenciaRef.current);
    }
  }, []);

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
    (pagina: number, paginasAcumuladas: number[]) => {
      registrarPaginaPdf(pagina);

      if (estudianteId && totalPaginas > 0) {
        const paginasUnicas = Array.from(new Set([...paginasAcumuladas, pagina]));
        const porcentajePaginas = Math.round((paginasUnicas.length / totalPaginas) * 100);
        registrarProgresoPdf({
          paginasVistas: paginasUnicas.sort((a, b) => a - b),
          totalPaginas,
          porcentajePaginas,
        });
      }
    },
    [estudianteId, registrarPaginaPdf, registrarProgresoPdf, totalPaginas]
  );

  const abrirPagina = (pagina: number) => {
    setPaginaAbierta(pagina);
    if (temporizadorPermanenciaRef.current) {
      window.clearTimeout(temporizadorPermanenciaRef.current);
    }
    temporizadorPermanenciaRef.current = window.setTimeout(() => {
      registrarPaginaConMetrica(pagina, progreso.paginasVistas);
    }, permanenciaMinimaMs);
  };

  return (
    <section className="rounded-[1.5rem] bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/10 p-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-tkd-red">Visor PDF</p>
          <h3 className="mt-2 text-xl font-black uppercase text-tkd-dark dark:text-white">{titulo}</h3>
          <p className="mt-2 text-sm text-gray-500">
            Paginas registradas: {progreso.paginasVistas.length}/{totalPaginas}
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

      <div className="space-y-4">
        {paginas.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-200 dark:border-white/10 p-8 text-center text-sm font-bold text-gray-400">
            Sin paginas disponibles
          </div>
        )}

        {paginas.map((pagina) => (
          <article
            key={pagina}
            className="rounded-2xl border border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-5"
          >
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-black text-tkd-dark dark:text-white">
                Pagina {pagina} de {totalPaginas}
                {progreso.paginasVistas.includes(pagina) && (
                  <span className="ml-2 text-green-500 text-[10px] font-black uppercase tracking-wider">✓ Vista</span>
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => abrirPagina(pagina)}
                  className="rounded-xl bg-tkd-dark text-white px-4 py-2 text-[10px] font-black uppercase tracking-widest"
                >
                  Abrir pagina {pagina}
                </button>
                <button
                  type="button"
                  onClick={() => registrarPaginaConMetrica(pagina, progreso.paginasVistas)}
                  className="rounded-xl bg-tkd-blue text-white px-4 py-2 text-[10px] font-black uppercase tracking-widest"
                >
                  Marcar pagina {pagina} como vista
                </button>
              </div>
            </div>
            {paginaAbierta === pagina && (
              <p className="mt-3 text-xs font-bold text-gray-400">
                Permanencia en curso para pagina {pagina}
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
};

export default PdfViewer;

