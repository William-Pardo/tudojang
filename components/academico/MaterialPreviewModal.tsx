import React from 'react';
import type { AsignacionCentroEstudios } from '../../models/academico/asignacionService.types';
import { IconoCerrar } from '../Iconos';
import QuizView, { type ResultadoQuiz } from './QuizView';
import PdfViewer from './PdfViewer';
import type { ProgresoSyncPayload } from '../../hooks/academico/useProgressSync';
import { progresoRepository } from '../../servicios/academico/progresoRepository';

interface MaterialPreviewModalProps {
  asignacion: AsignacionCentroEstudios | null;
  onCerrar: () => void;
}

function obtenerTipoMaterial(asignacion: AsignacionCentroEstudios): string {
  if (asignacion.uso === 'evaluacion') return 'Quiz';
  if (asignacion.uso === 'refuerzo') return 'Refuerzo guiado';
  return 'Material de estudio';
}

const MaterialPreviewModal: React.FC<MaterialPreviewModalProps> = ({ asignacion, onCerrar }) => {
  const [resultadoQuiz, setResultadoQuiz] = React.useState<ResultadoQuiz | null>(null);

  React.useEffect(() => {
    setResultadoQuiz(null);
  }, [asignacion?.id]);

  if (!asignacion) return null;

  const estadoVisible = resultadoQuiz?.estadoPostQuiz || asignacion.estadoProgreso;
  const progresoVisible = resultadoQuiz?.aprobado ? 100 : asignacion.porcentajeProgreso;
  const sincronizarProgreso = (payload: ProgresoSyncPayload) => {
    const win = typeof window !== 'undefined' ? (window as any) : undefined;
    if (win?.Cypress) {
      win.__CENTRO_ESTUDIOS_SYNC_PAYLOADS__ = [
        ...(win.__CENTRO_ESTUDIOS_SYNC_PAYLOADS__ ?? []),
        payload,
      ];
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-tkd-dark/70 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-3xl bg-white dark:bg-gray-900 rounded-[2rem] shadow-2xl overflow-hidden border border-white/10">
        <header className="p-6 border-b border-gray-100 dark:border-white/10 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Vista previa del recurso</p>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-tkd-red">{obtenerTipoMaterial(asignacion)}</p>
            <h2 className="mt-2 text-2xl font-black uppercase text-tkd-dark dark:text-white leading-tight">{asignacion.titulo}</h2>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="shrink-0 w-11 h-11 rounded-2xl bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-300 hover:bg-tkd-red hover:text-white transition-all flex items-center justify-center"
            aria-label="Cerrar material"
          >
            <IconoCerrar className="w-5 h-5" />
          </button>
        </header>

        <main className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {asignacion.uso === 'evaluacion' ? (
            <QuizView asignacion={asignacion} onResultado={setResultadoQuiz} />
          ) : (
            <PdfViewer
              tenantId={asignacion.tenantId}
              asignacionId={asignacion.id}
              titulo={asignacion.titulo}
              totalPaginas={3}
              sincronizar={sincronizarProgreso}
              cargarProgreso={() => progresoRepository.leerSync(asignacion.tenantId, asignacion.id)}
            />
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] font-black uppercase tracking-widest">
            <div className="rounded-2xl bg-gray-50 dark:bg-white/5 p-4">
              <span className="block text-gray-400">Progreso</span>
              <span className="block mt-1 text-tkd-blue">{progresoVisible}%</span>
            </div>
            <div className="rounded-2xl bg-gray-50 dark:bg-white/5 p-4">
              <span className="block text-gray-400">Estado</span>
              <span className="block mt-1 text-tkd-dark dark:text-white">{estadoVisible.replace('_', ' ')}</span>
            </div>
            <div className="rounded-2xl bg-gray-50 dark:bg-white/5 p-4">
              <span className="block text-gray-400">Urgencia</span>
              <span className="block mt-1 text-tkd-dark dark:text-white">{asignacion.urgencia.replace('_', ' ')}</span>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default MaterialPreviewModal;
