import React from 'react';
import type { FichaAcademica, RecursoAcademico } from '../../models/academico/recurso';
import { crearBibliotecaService } from '../../servicios/academico/bibliotecaService';

const archivosDriveMaestro = [
  {
    id: 'drive-patada-frontal-video',
    nombre: 'Patada frontal.mp4',
    mimeType: 'video/mp4',
    ruta: '/Aportes maestros/Refuerzos',
    ficha: {
      disciplina: 'Taekwondo',
      tipo: 'video',
      usos: ['refuerzo'],
      autor: 'Maestro demo',
    } satisfies FichaAcademica,
  },
  {
    id: 'drive-saludo-pdf',
    nombre: 'Guia de saludo.pdf',
    mimeType: 'application/pdf',
    ruta: '/Aportes maestros/Fundamentos',
    ficha: {
      disciplina: 'Taekwondo',
      tipo: 'pdf',
      usos: ['estudio'],
      autor: 'Maestro demo',
    } satisfies FichaAcademica,
  },
];

const bibliotecaService = crearBibliotecaService({ isFirebaseConfigured: false });

const AportarRecursoView: React.FC = () => {
  const [recursoPropuesto, setRecursoPropuesto] = React.useState<RecursoAcademico | null>(null);
  const [error, setError] = React.useState('');

  const proponer = async (archivo: typeof archivosDriveMaestro[number]) => {
    setError('');
    try {
      const recurso = await bibliotecaService.importFromDrive(
        'tenant-demo',
        archivo.id,
        archivo.nombre,
        archivo.mimeType,
        'maestro-demo',
      );

      await bibliotecaService.updateFicha('tenant-demo', recurso.id, archivo.ficha);

      setRecursoPropuesto({
        ...recurso,
        ficha: archivo.ficha,
        estado: 'pendiente',
        actualizadoEn: new Date().toISOString(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo proponer el recurso.');
    }
  };

  return (
    <section className="p-6 sm:p-10 space-y-8">
      <header>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-tkd-red">
          Centro de Estudios
        </p>
        <h1 className="text-3xl font-black uppercase text-tkd-dark dark:text-white">
          Aportar recurso
        </h1>
        <p className="mt-2 text-sm font-bold text-gray-400">
          Selecciona un archivo de Drive para proponerlo a la biblioteca academica.
        </p>
      </header>

      <article className="rounded-[2rem] border border-gray-100 dark:border-white/10 bg-white dark:bg-gray-900 p-6 space-y-5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-tkd-red">
            Selecciona un archivo de Drive
          </p>
          <h2 className="mt-2 text-2xl font-black uppercase text-tkd-dark dark:text-white">
            Archivos sugeridos
          </h2>
        </div>

        <div className="space-y-3">
          {archivosDriveMaestro.map((archivo) => (
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
                onClick={() => proponer(archivo)}
                className="rounded-xl bg-tkd-blue text-white px-4 py-2 text-[10px] font-black uppercase tracking-widest"
              >
                Proponer {archivo.nombre}
              </button>
            </div>
          ))}
        </div>
      </article>

      {recursoPropuesto && (
        <article className="rounded-[2rem] border border-yellow-100 bg-yellow-50 p-6 space-y-3 text-yellow-900">
          <p className="text-[10px] font-black uppercase tracking-widest">Recurso propuesto</p>
          <h2 className="text-2xl font-black uppercase">{recursoPropuesto.nombre}</h2>
          <p className="text-sm font-black uppercase">Estado: {recursoPropuesto.estado}</p>
          <p className="text-sm font-bold">
            Quedara disponible para revision del admin antes de poder publicarse a estudiantes.
          </p>
        </article>
      )}

      {error && (
        <div className="rounded-2xl bg-red-50 text-red-700 p-4 text-sm font-bold">
          {error}
        </div>
      )}
    </section>
  );
};

export default AportarRecursoView;
