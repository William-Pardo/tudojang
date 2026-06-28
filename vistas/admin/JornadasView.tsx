import React from 'react';
import type { JornadaInstruccion } from '../../models/academico/jornada';
import type { EjecucionPrograma, ProgramaAcademico } from '../../models/academico/programa';
import { cerrarJornadaConPrograma } from '../../servicios/academico/closeJornada';
import {
  createJornada,
  confirmarJornada,
  iniciarJornada,
  marcarPendienteCierre,
} from '../../servicios/academico/jornadaService';
import {
  assignProgramaToGrupo,
  createPrograma,
  publishPrograma,
} from '../../servicios/academico/programaService';

const programaBase: ProgramaAcademico = publishPrograma(createPrograma({
  tenantId: 'tenant-demo',
  nombre: 'Programa base',
  descripcion: 'Fundamentos iniciales',
  unidades: [
    {
      id: 'unidad-1',
      nombre: 'Fundamentos',
      orden: 1,
      objetivos: [
        { id: 'obj-saludo', descripcion: 'Saludo', orden: 1 },
        { id: 'obj-patada', descripcion: 'Patada', orden: 2 },
      ],
    },
  ],
}));

const ejecucionBase = assignProgramaToGrupo(programaBase, {
  grupoId: 'grupo-infantil',
  sedeId: 'sede-principal',
  fechaInicio: '2026-06-27',
});

const jornadaBase = createJornada({
  tenantId: 'tenant-demo',
  programaId: programaBase.id,
  ejecucionProgramaId: ejecucionBase.id,
  grupoId: 'grupo-infantil',
  sedeId: 'sede-principal',
  espacioId: 'tatami-1',
  instructorId: 'maestro-1',
  fecha: '2026-06-27',
  horaInicio: '08:00',
  horaFin: '09:00',
  objetivosPlaneados: ['obj-saludo', 'obj-patada'],
});

function etiquetaEstado(estado: JornadaInstruccion['estado']) {
  return estado.replace('_', ' ');
}

interface JornadasViewProps {
  embedded?: boolean;
}

const JornadasView: React.FC<JornadasViewProps> = ({ embedded = false }) => {
  const [jornada, setJornada] = React.useState<JornadaInstruccion>(jornadaBase);
  const [ejecucion, setEjecucion] = React.useState<EjecucionPrograma>(ejecucionBase);
  const [asistenciaRegistrada, setAsistenciaRegistrada] = React.useState(false);
  const [objetivoSaludoImpartido, setObjetivoSaludoImpartido] = React.useState(false);
  const [refuerzosPublicados, setRefuerzosPublicados] = React.useState<string[]>([]);
  const [error, setError] = React.useState('');

  const objetivoActual = programaBase.unidades
    .flatMap((unidad) => unidad.objetivos)
    .find((objetivo) => objetivo.id === ejecucion.objetivoActualId);

  const confirmar = () => {
    setError('');
    setJornada((actual) => confirmarJornada(actual));
  };

  const iniciar = () => {
    setError('');
    setJornada((actual) => iniciarJornada(actual));
  };

  const cerrar = () => {
    setError('');
    try {
      const pendiente = marcarPendienteCierre(jornada, {
        asistenciaRegistrada,
        objetivosImpartidos: objetivoSaludoImpartido ? ['obj-saludo'] : [],
      });
      const resultado = cerrarJornadaConPrograma({
        jornada: pendiente,
        programa: programaBase,
        ejecucion,
      });
      setJornada(resultado.jornada);
      setEjecucion(resultado.ejecucion);
      setRefuerzosPublicados(resultado.objetivosPendientesRefuerzo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cerrar la jornada.');
    }
  };

  return (
    <section className={embedded ? 'space-y-6' : 'p-6 sm:p-10 space-y-8'}>
      {!embedded && (
        <header>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-tkd-red">
            Centro de Estudios
          </p>
          <h1 className="text-3xl font-black uppercase text-tkd-dark dark:text-white">
            Plan y cierre de clase
          </h1>
          <p className="mt-2 text-sm font-bold text-gray-400">
            Agenda operativa para confirmar, ejecutar y cerrar sesiones tecnicas.
          </p>
        </header>
      )}

      <article className="rounded-[2rem] border border-gray-100 dark:border-white/10 bg-white dark:bg-gray-900 p-6 space-y-5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
            Estado: {etiquetaEstado(jornada.estado)}
          </p>
          <h2 className="mt-2 text-2xl font-black uppercase text-tkd-dark dark:text-white">
            Grupo infantil
          </h2>
          <p className="mt-2 text-sm font-bold text-gray-500">
            {jornada.fecha} · {jornada.horaInicio} - {jornada.horaFin}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={confirmar}
            disabled={jornada.estado !== 'borrador'}
            className="rounded-2xl bg-tkd-blue text-white px-5 py-3 text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
          >
            Confirmar jornada
          </button>
          <button
            type="button"
            onClick={iniciar}
            disabled={jornada.estado !== 'confirmada'}
            className="rounded-2xl bg-tkd-dark text-white px-5 py-3 text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
          >
            Iniciar jornada
          </button>
        </div>

        {jornada.estado === 'en_curso' && (
          <div className="rounded-2xl bg-gray-50 dark:bg-white/5 p-5 space-y-4">
            <label className="flex items-center gap-3 text-sm font-bold">
              <input
                type="checkbox"
                checked={asistenciaRegistrada}
                onChange={(event) => setAsistenciaRegistrada(event.target.checked)}
              />
              Asistencia registrada
            </label>
            <label className="flex items-center gap-3 text-sm font-bold">
              <input
                type="checkbox"
                checked={objetivoSaludoImpartido}
                onChange={(event) => setObjetivoSaludoImpartido(event.target.checked)}
              />
              Objetivo saludo impartido
            </label>
            <button
              type="button"
              onClick={cerrar}
              className="rounded-2xl bg-tkd-red text-white px-5 py-3 text-[10px] font-black uppercase tracking-widest"
            >
              Cerrar jornada
            </button>
          </div>
        )}

        {error && (
          <div className="rounded-2xl bg-red-50 text-red-700 p-4 text-sm font-bold">
            {error}
          </div>
        )}

        <div className="rounded-2xl bg-green-50 text-green-700 p-4 text-sm font-black uppercase">
          Programa avanzo a: {objetivoActual?.descripcion ?? 'sin objetivo'}
        </div>

        {refuerzosPublicados.length > 0 && (
          <div className="rounded-2xl bg-blue-50 text-tkd-blue p-4 text-sm font-black uppercase">
            Refuerzos publicados: {refuerzosPublicados.join(', ')}
          </div>
        )}
      </article>
    </section>
  );
};

export default JornadasView;
