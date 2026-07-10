import React from 'react';
import type { Estudiante } from '../../tipos';
import type { EjecucionPrograma } from '../../models/academico/programa';
import type { InscripcionEjecucionPrograma } from '../../models/academico/inscripcion';
import { inscripcionRepository, type InscripcionRepository } from '../../servicios/academico/inscripcionRepository';
import { estaInscrito, sugerirEstudiantesPorAtributo } from '../../servicios/academico/inscripcionService';
import { IconoCerrar, IconoAprobar } from '../Iconos';

interface MatricularEstudiantesModalProps {
  abierto: boolean;
  ejecucion: EjecucionPrograma | null;
  estudiantes: Estudiante[];
  tenantId: string;
  usuarioId: string;
  onCerrar: () => void;
  onGuardado?: () => void;
  repository?: InscripcionRepository;
}

/**
 * Roster explícito de matrícula (Fase 0, `design.md` Decisión 5): sugiere por
 * grupo etario (pre-marcado) pero la persistencia SIEMPRE requiere
 * confirmación manual explícita del admin/instructor — nunca auto-inscribe.
 */
const MatricularEstudiantesModal: React.FC<MatricularEstudiantesModalProps> = ({
  abierto,
  ejecucion,
  estudiantes,
  tenantId,
  usuarioId,
  onCerrar,
  onGuardado,
  repository = inscripcionRepository,
}) => {
  const [inscripcionesActuales, setInscripcionesActuales] = React.useState<InscripcionEjecucionPrograma[]>([]);
  const [seleccionados, setSeleccionados] = React.useState<Set<string>>(new Set());
  const [cargando, setCargando] = React.useState(false);
  const [cargaFallida, setCargaFallida] = React.useState(false);
  const [guardando, setGuardando] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!abierto || !ejecucion) return;

    let activo = true;
    setCargando(true);
    setCargaFallida(false);
    repository.listarPorEjecucion(tenantId, ejecucion.id)
      .then((inscripciones) => {
        if (!activo) return;
        setInscripcionesActuales(inscripciones);

        const sugeridos = sugerirEstudiantesPorAtributo(ejecucion, estudiantes).map((estudiante) => estudiante.id);
        const inscritos = inscripciones.map((inscripcion) => inscripcion.estudianteId);
        setSeleccionados(new Set([...sugeridos, ...inscritos]));
        setCargando(false);
      })
      .catch(() => {
        // Sin este catch, un rechazo (permisos, red) dejaba el modal en
        // "Cargando roster actual…" para siempre. Salir del estado de carga
        // con un error claro en vez de un spinner infinito.
        if (!activo) return;
        setCargaFallida(true);
        setCargando(false);
      });

    return () => {
      activo = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, ejecucion?.id, tenantId]);

  if (!abierto) return null;

  // La ejecución se deriva del programa seleccionado; si todavía no existe
  // (programa sin guardar u horario sin definir), avisar en vez de dejar
  // una carga ambigua que nunca resuelve.
  if (!ejecucion) {
    return (
      <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 p-4" aria-modal="true" role="dialog">
        <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-gray-900">
          <header className="flex items-center justify-between">
            <h2 className="text-xl font-black uppercase tracking-tight text-tkd-dark dark:text-white">Matricular estudiantes</h2>
            <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-full p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
              <IconoCerrar className="h-5 w-5" />
            </button>
          </header>
          <p className="mt-4 text-sm font-bold text-gray-500">
            Primero guarda el horario del programa antes de matricular estudiantes.
            La matrícula opera sobre la ejecución real del programa.
          </p>
        </div>
      </div>
    );
  }

  const toggleEstudiante = (estudianteId: string) => {
    setSeleccionados((actual) => {
      const nuevo = new Set(actual);
      if (nuevo.has(estudianteId)) {
        nuevo.delete(estudianteId);
      } else {
        nuevo.add(estudianteId);
      }
      return nuevo;
    });
  };

  const confirmar = async () => {
    if (guardando) return;
    setGuardando(true);
    setError('');
    try {
      const yaInscritos = new Set(inscripcionesActuales.map((inscripcion) => inscripcion.estudianteId));

      for (const estudiante of estudiantes) {
        const marcado = seleccionados.has(estudiante.id);
        const inscritoAntes = yaInscritos.has(estudiante.id);

        if (marcado && !inscritoAntes) {
          await repository.matricular({
            estudianteId: estudiante.id,
            ejecucionProgramaId: ejecucion.id,
            tenantId,
            estado: 'activa',
            fechaInscripcion: new Date().toISOString(),
            inscritoPorUid: usuarioId,
          });
        } else if (!marcado && inscritoAntes) {
          await repository.retirar(tenantId, ejecucion.id, estudiante.id);
        }
      }

      onGuardado?.();
      onCerrar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la matrícula.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 p-4" aria-modal="true" role="dialog">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-gray-900">
        <header className="flex items-center justify-between border-b border-gray-100 p-6 dark:border-white/10">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight text-tkd-dark dark:text-white">Matricular estudiantes</h2>
            <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-gray-400">Ejecución {ejecucion.id}</p>
            <p className="mt-2 text-xs font-bold normal-case text-gray-500">
              Define el roster oficial de estudiantes de este programa, para asistencia y seguimiento.
              Es independiente de los grados a los que aplica cada material publicado.
            </p>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-full p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <IconoCerrar className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          {error && <p className="mb-4 text-xs font-bold text-tkd-red">{error}</p>}
          {cargando ? (
            <p className="text-xs font-bold uppercase text-gray-400">Cargando roster actual…</p>
          ) : cargaFallida ? (
            <p className="text-xs font-bold text-tkd-red">
              No se pudo cargar el roster actual. Cierra el modal y vuelve a intentarlo.
            </p>
          ) : estudiantes.length === 0 ? (
            <p className="text-xs font-bold uppercase text-gray-400">No hay estudiantes disponibles para matricular.</p>
          ) : (
            <ul className="space-y-2">
              {estudiantes.map((estudiante) => (
                <li key={estudiante.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-gray-100 p-3 text-sm font-bold text-tkd-dark hover:border-tkd-blue/40 dark:border-white/10 dark:text-white">
                    <input
                      type="checkbox"
                      checked={seleccionados.has(estudiante.id)}
                      onChange={() => toggleEstudiante(estudiante.id)}
                      aria-label={`${estudiante.nombres} ${estudiante.apellidos}`}
                    />
                    <span>
                      {estudiante.nombres} {estudiante.apellidos}
                      <span className="ml-2 text-[10px] font-black uppercase tracking-widest text-gray-400">{estudiante.grupo}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="flex justify-end gap-3 border-t border-gray-100 bg-gray-50/50 p-4 dark:border-white/10 dark:bg-gray-950/30">
          <button
            type="button"
            onClick={onCerrar}
            disabled={guardando}
            className="rounded-xl border border-gray-200 bg-white px-6 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-tkd-red disabled:opacity-50 dark:bg-gray-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={guardando || cargando || cargaFallida}
            className="inline-flex items-center gap-2 rounded-xl bg-tkd-red px-6 py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-lg disabled:bg-gray-300"
          >
            <IconoAprobar className="h-4 w-4" />
            {guardando ? 'Guardando…' : 'Confirmar matrícula'}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default MatricularEstudiantesModal;
