import React from 'react';
import type { EjecucionPrograma, ProgramaAcademico } from '../../models/academico/programa';
import {
  advanceCiclo,
  assignProgramaToGrupo,
  createPrograma,
  publishPrograma,
} from '../../servicios/academico/programaService';

const programaDemo: ProgramaAcademico = publishPrograma(createPrograma({
  tenantId: 'tenant-demo',
  nombre: 'Programa cinturón blanco',
  descripcion: 'Ruta base de fundamentos técnicos.',
  unidades: [
    {
      id: 'unidad-fundamentos',
      nombre: 'Fundamentos',
      orden: 1,
      objetivos: [
        { id: 'obj-saludo', descripcion: 'Saludo y postura', orden: 1 },
        { id: 'obj-patada', descripcion: 'Patada frontal', orden: 2 },
      ],
    },
    {
      id: 'unidad-control',
      nombre: 'Control',
      orden: 2,
      objetivos: [
        { id: 'obj-desplazamiento', descripcion: 'Desplazamiento basico', orden: 1 },
      ],
    },
  ],
}));

function crearEjecucionesDemo(): Array<EjecucionPrograma & { nombreGrupo: string }> {
  const infantilBase = assignProgramaToGrupo(programaDemo, {
    grupoId: 'grupo-infantil',
    sedeId: 'sede-principal',
    fechaInicio: '2026-06-27',
  });
  const cadetesBase = assignProgramaToGrupo(programaDemo, {
    grupoId: 'grupo-cadetes',
    sedeId: 'sede-principal',
    fechaInicio: '2026-06-27',
  });

  return [
    {
      ...advanceCiclo(programaDemo, infantilBase, ['obj-saludo']),
      nombreGrupo: 'Grupo infantil',
    },
    {
      ...advanceCiclo(programaDemo, cadetesBase, ['obj-saludo', 'obj-patada']),
      nombreGrupo: 'Grupo cadetes',
    },
  ];
}

function obtenerUnidadActual(programa: ProgramaAcademico, ejecucion: EjecucionPrograma) {
  return programa.unidades.find((unidad) => unidad.id === ejecucion.unidadActualId);
}

function obtenerObjetivoActual(programa: ProgramaAcademico, ejecucion: EjecucionPrograma) {
  return programa.unidades
    .flatMap((unidad) => unidad.objetivos)
    .find((objetivo) => objetivo.id === ejecucion.objetivoActualId);
}

const EjecucionProgramaView: React.FC = () => {
  const ejecuciones = React.useMemo(() => crearEjecucionesDemo(), []);
  const totalObjetivos = programaDemo.unidades.flatMap((unidad) => unidad.objetivos).length;

  return (
    <section className="p-6 sm:p-10 space-y-8">
      <header>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-tkd-red">
          Centro de Estudios
        </p>
        <h1 className="text-3xl font-black uppercase text-tkd-dark dark:text-white">
          Ejecucion de programa
        </h1>
        <p className="mt-2 text-sm font-bold text-gray-400">
          Seguimiento del ciclo académico por grupo, con avance independiente.
        </p>
      </header>

      <article className="rounded-[2rem] border border-gray-100 dark:border-white/10 bg-white dark:bg-gray-900 p-6">
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
          Programa activo
        </p>
        <h2 className="mt-2 text-2xl font-black uppercase text-tkd-dark dark:text-white">
          {programaDemo.nombre}
        </h2>
        <p className="mt-2 text-sm text-gray-500">{programaDemo.descripcion}</p>
      </article>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {ejecuciones.map((ejecucion) => {
          const unidadActual = obtenerUnidadActual(programaDemo, ejecucion);
          const objetivoActual = obtenerObjetivoActual(programaDemo, ejecucion);
          const testId = ejecucion.grupoId === 'grupo-infantil'
            ? 'ejecucion-grupo-infantil'
            : 'ejecucion-grupo-cadetes';

          return (
            <article
              key={ejecucion.id}
              data-testid={testId}
              className="rounded-[2rem] border border-gray-100 dark:border-white/10 bg-white dark:bg-gray-900 p-6 space-y-3"
            >
              <p className="text-[10px] font-black uppercase tracking-widest text-tkd-red">
                {ejecucion.estado}
              </p>
              <h3 className="text-xl font-black uppercase text-tkd-dark dark:text-white">
                {ejecucion.nombreGrupo}
              </h3>
              <p className="text-sm font-bold text-gray-500">
                Unidad actual: {unidadActual?.nombre ?? 'sin unidad'}
              </p>
              <p className="text-sm font-bold text-gray-500">
                Objetivo actual: {objetivoActual?.descripcion ?? 'sin objetivo'}
              </p>
              <p className="text-sm font-bold text-gray-500">
                Objetivos completados: {ejecucion.objetivosCompletados.length}/{totalObjetivos}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default EjecucionProgramaView;
