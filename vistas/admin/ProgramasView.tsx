import React from 'react';
import type { EjecucionPrograma, ProgramaAcademico } from '../../models/academico/programa';
import {
  assignProgramaToGrupo,
  createPrograma,
  publishPrograma,
} from '../../servicios/academico/programaService';

const unidadesBase = [
  {
    id: 'unidad-fundamentos',
    nombre: 'Fundamentos',
    orden: 1,
    objetivos: [
      { id: 'obj-saludo-postura', descripcion: 'Saludo y postura', orden: 1 },
      { id: 'obj-patada-frontal', descripcion: 'Patada frontal', orden: 2 },
    ],
  },
];

const ProgramasView: React.FC = () => {
  const [nombre, setNombre] = React.useState('Programa base');
  const [descripcion, setDescripcion] = React.useState('Ruta academica inicial');
  const [programa, setPrograma] = React.useState<ProgramaAcademico | null>(null);
  const [ejecucion, setEjecucion] = React.useState<EjecucionPrograma | null>(null);

  const crear = () => {
    setEjecucion(null);
    setPrograma(createPrograma({
      tenantId: 'tenant-demo',
      nombre,
      descripcion,
      unidades: unidadesBase,
    }));
  };

  const publicar = () => {
    if (!programa) return;
    setPrograma(publishPrograma(programa));
  };

  const asignar = () => {
    if (!programa || programa.estado !== 'publicado') return;
    setEjecucion(assignProgramaToGrupo(programa, {
      grupoId: 'grupo infantil',
      sedeId: 'sede principal',
      fechaInicio: '2026-06-27',
    }));
  };

  const objetivoActual = programa
    ?.unidades.flatMap((unidad) => unidad.objetivos)
    .find((objetivo) => objetivo.id === ejecucion?.objetivoActualId);

  return (
    <section className="p-6 sm:p-10 space-y-8">
      <header>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-tkd-red">
          Centro de Estudios
        </p>
        <h1 className="text-3xl font-black uppercase text-tkd-dark dark:text-white">
          Programas academicos
        </h1>
        <p className="mt-2 text-sm font-bold text-gray-400">
          Gestiona rutas formativas, publica programas y asigna ciclos a grupos.
        </p>
      </header>

      <div className="rounded-[2rem] border border-gray-100 dark:border-white/10 bg-white dark:bg-gray-900 p-6 grid gap-4">
        <label htmlFor="programa-nombre" className="text-[10px] font-black uppercase tracking-widest text-gray-400">
          Nombre del programa
        </label>
        <input
          id="programa-nombre"
          value={nombre}
          onChange={(event) => setNombre(event.target.value)}
          className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold"
        />

        <label htmlFor="programa-descripcion" className="text-[10px] font-black uppercase tracking-widest text-gray-400">
          Descripcion
        </label>
        <textarea
          id="programa-descripcion"
          value={descripcion}
          onChange={(event) => setDescripcion(event.target.value)}
          className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold"
        />

        <button
          type="button"
          onClick={crear}
          className="rounded-2xl bg-tkd-dark text-white px-5 py-3 text-[10px] font-black uppercase tracking-widest"
        >
          Crear programa
        </button>
      </div>

      {programa && (
        <article className="rounded-[2rem] border border-gray-100 dark:border-white/10 bg-white dark:bg-gray-900 p-6 space-y-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              Estado: {programa.estado}
            </p>
            <h2 className="mt-2 text-2xl font-black uppercase text-tkd-dark dark:text-white">
              {programa.nombre}
            </h2>
            <p className="mt-2 text-sm text-gray-500">{programa.descripcion}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={publicar}
              disabled={programa.estado === 'publicado'}
              className="rounded-2xl bg-tkd-blue text-white px-5 py-3 text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
            >
              Publicar programa
            </button>
            <button
              type="button"
              onClick={asignar}
              disabled={programa.estado !== 'publicado'}
              className="rounded-2xl bg-tkd-red text-white px-5 py-3 text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
            >
              Asignar a grupo infantil
            </button>
          </div>

          {ejecucion && (
            <div className="rounded-2xl bg-gray-50 dark:bg-white/5 p-5 text-sm font-bold text-gray-600 dark:text-gray-300">
              <p>Grupo infantil</p>
              <p>Objetivo actual: {objetivoActual?.descripcion ?? 'sin objetivo'}</p>
            </div>
          )}
        </article>
      )}
    </section>
  );
};

export default ProgramasView;
