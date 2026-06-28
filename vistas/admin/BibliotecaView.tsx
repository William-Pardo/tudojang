import React from 'react';
import type { FichaAcademica, RecursoAcademico } from '../../models/academico/recurso';
import type { TipoRecurso, UsoAcademico } from '../../models/academico';
import { crearBibliotecaService } from '../../servicios/academico/bibliotecaService';

const archivosDriveDemo = [
  {
    id: 'drive-fundamentos-pdf',
    nombre: 'Fundamentos tecnicos.pdf',
    mimeType: 'application/pdf',
    ruta: '/Biblioteca/Fundamentos',
  },
  {
    id: 'drive-patada-video',
    nombre: 'Patada frontal.mp4',
    mimeType: 'video/mp4',
    ruta: '/Biblioteca/Refuerzos',
  },
];

const bibliotecaService = crearBibliotecaService({ isFirebaseConfigured: false });

const BibliotecaView: React.FC = () => {
  const [recursos, setRecursos] = React.useState<RecursoAcademico[]>([]);
  const [recursoSeleccionadoId, setRecursoSeleccionadoId] = React.useState('');
  const [disciplina, setDisciplina] = React.useState('Taekwondo');
  const [tipo, setTipo] = React.useState<TipoRecurso>('pdf');
  const [uso, setUso] = React.useState<UsoAcademico>('estudio');
  const [error, setError] = React.useState('');

  const recursoSeleccionado = recursos.find((recurso) => recurso.id === recursoSeleccionadoId) ?? recursos[0];

  const importarArchivo = async (archivo: typeof archivosDriveDemo[number]) => {
    setError('');
    const recurso = await bibliotecaService.importFromDrive(
      'tenant-demo',
      archivo.id,
      archivo.nombre,
      archivo.mimeType,
      'admin-demo',
    );
    setRecursos((actuales) => [...actuales, recurso]);
    setRecursoSeleccionadoId(recurso.id);
  };

  const guardarClasificacion = async () => {
    if (!recursoSeleccionado) return;
    setError('');

    const ficha: FichaAcademica = {
      disciplina,
      tipo,
      usos: [uso],
    };

    await bibliotecaService.updateFicha('tenant-demo', recursoSeleccionado.id, ficha);
    setRecursos((actuales) => actuales.map((recurso) => (
      recurso.id === recursoSeleccionado.id
        ? {
          ...recurso,
          ficha,
          estado: 'pendiente',
          actualizadoEn: new Date().toISOString(),
        }
        : recurso
    )));
  };

  const aprobar = async () => {
    if (!recursoSeleccionado) return;
    setError('');

    try {
      await bibliotecaService.approveRecurso('tenant-demo', recursoSeleccionado.id, 'admin-demo');
      setRecursos((actuales) => actuales.map((recurso) => (
        recurso.id === recursoSeleccionado.id
          ? {
            ...recurso,
            estado: 'aprobado',
            aprobadoPorUid: 'admin-demo',
            aprobadoEn: new Date().toISOString(),
            actualizadoEn: new Date().toISOString(),
          }
          : recurso
      )));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo aprobar el recurso.');
    }
  };

  return (
    <section className="p-6 sm:p-10 space-y-8">
      <header>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-tkd-red">
          Centro de Estudios
        </p>
        <h1 className="text-3xl font-black uppercase text-tkd-dark dark:text-white">
          Biblioteca academica
        </h1>
        <p className="mt-2 text-sm font-bold text-gray-400">
          Importa archivos desde Drive, clasificalos y aprueba recursos para asignaciones.
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <article className="rounded-[2rem] border border-gray-100 dark:border-white/10 bg-white dark:bg-gray-900 p-6 space-y-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-tkd-red">
              Explorador de Google Drive
            </p>
            <h2 className="mt-2 text-2xl font-black uppercase text-tkd-dark dark:text-white">
              Carpeta institucional
            </h2>
          </div>

          <div className="space-y-3">
            {archivosDriveDemo.map((archivo) => (
              <div
                key={archivo.id}
                className="rounded-2xl border border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div>
                  <p className="text-sm font-black text-tkd-dark dark:text-white">{archivo.nombre}</p>
                  <p className="text-xs font-bold text-gray-400">{archivo.ruta}</p>
                </div>
                <button
                  type="button"
                  onClick={() => importarArchivo(archivo)}
                  className="rounded-xl bg-tkd-dark text-white px-4 py-2 text-[10px] font-black uppercase tracking-widest"
                >
                  Importar {archivo.nombre}
                </button>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[2rem] border border-gray-100 dark:border-white/10 bg-white dark:bg-gray-900 p-6 space-y-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              Recursos importados
            </p>
            <h2 className="mt-2 text-2xl font-black uppercase text-tkd-dark dark:text-white">
              Clasificacion y aprobacion
            </h2>
          </div>

          {!recursoSeleccionado ? (
            <div className="rounded-2xl border border-dashed border-gray-200 dark:border-white/10 p-8 text-center text-sm font-bold text-gray-400">
              Importa un archivo de Drive para clasificarlo.
            </div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-2xl bg-gray-50 dark:bg-white/5 p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                  Estado: {recursoSeleccionado.estado}
                </p>
                <h3 className="mt-2 text-xl font-black uppercase text-tkd-dark dark:text-white">
                  {recursoSeleccionado.nombre}
                </h3>
                {recursoSeleccionado.ficha && (
                  <p className="mt-2 text-sm font-bold text-gray-500">
                    Disciplina: {recursoSeleccionado.ficha.disciplina}
                  </p>
                )}
              </div>

              <label htmlFor="biblioteca-disciplina" className="block text-[10px] font-black uppercase tracking-widest text-gray-400">
                Disciplina
              </label>
              <input
                id="biblioteca-disciplina"
                value={disciplina}
                onChange={(event) => setDisciplina(event.target.value)}
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold"
              />

              <label htmlFor="biblioteca-tipo" className="block text-[10px] font-black uppercase tracking-widest text-gray-400">
                Tipo de recurso
              </label>
              <select
                id="biblioteca-tipo"
                value={tipo}
                onChange={(event) => setTipo(event.target.value as TipoRecurso)}
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold"
              >
                <option value="pdf">PDF</option>
                <option value="video">Video</option>
                <option value="quiz">Quiz</option>
              </select>

              <label htmlFor="biblioteca-uso" className="block text-[10px] font-black uppercase tracking-widest text-gray-400">
                Uso academico
              </label>
              <select
                id="biblioteca-uso"
                value={uso}
                onChange={(event) => setUso(event.target.value as UsoAcademico)}
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold"
              >
                <option value="estudio">Estudio</option>
                <option value="preparacion">Preparacion</option>
                <option value="refuerzo">Refuerzo</option>
                <option value="evaluacion">Evaluacion</option>
              </select>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={guardarClasificacion}
                  className="rounded-2xl bg-tkd-blue text-white px-5 py-3 text-[10px] font-black uppercase tracking-widest"
                >
                  Guardar clasificacion
                </button>
                <button
                  type="button"
                  onClick={aprobar}
                  disabled={recursoSeleccionado.estado !== 'pendiente'}
                  className="rounded-2xl bg-tkd-red text-white px-5 py-3 text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                >
                  Aprobar recurso
                </button>
              </div>

              {error && (
                <div className="rounded-2xl bg-red-50 text-red-700 p-4 text-sm font-bold">
                  {error}
                </div>
              )}
            </div>
          )}
        </article>
      </div>
    </section>
  );
};

export default BibliotecaView;
