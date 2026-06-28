import React from 'react';
import type { AsignacionCentroEstudios } from '../../models/academico/asignacionService.types';
import ProgresoResumenCard from '../../components/academico/ProgresoResumenCard';
import { calcularMetricasCentroEstudios, ordenarAsignacionesPorUrgencia } from '../../utils/academico/centroEstudios';

export interface EstudianteVinculadoTutor {
  id: string;
  nombre: string;
  grupo?: string;
  asignaciones: AsignacionCentroEstudios[];
}

export interface AlertaTutor {
  estudiante: EstudianteVinculadoTutor;
  asignacion: AsignacionCentroEstudios;
}

interface TutorDashboardViewProps {
  estudiantes?: EstudianteVinculadoTutor[];
}

const estudiantesDemo: EstudianteVinculadoTutor[] = [
  {
    id: 'demo-est-1',
    nombre: 'Samuel Martínez',
    grupo: 'Infantil',
    asignaciones: [
      {
        id: 'demo-asig-1',
        tenantId: 'tenant-demo',
        recursoId: 'recurso-demo-1',
        titulo: 'Manual de Poomsae Básico',
        descripcion: 'Material de preparación para la siguiente clase técnica.',
        destinatario: { tipo: 'grupo', grupo: 'Infantil' },
        uso: 'estudio',
        momento: 'preparacion',
        obligatoria: true,
        fechaApertura: '2026-06-20T00:00:00.000Z',
        fechaCierre: '2026-06-28T00:00:00.000Z',
        estado: 'publicada',
        creadoPorUid: 'maestro-demo',
        creadoEn: '2026-06-20T00:00:00.000Z',
        actualizadoEn: '2026-06-20T00:00:00.000Z',
        estadoProgreso: 'en_progreso',
        porcentajeProgreso: 45,
        urgencia: 'alta',
      },
    ],
  },
];

export function obtenerAlertasTutor(estudiantes: EstudianteVinculadoTutor[]): AlertaTutor[] {
  return estudiantes
    .flatMap((estudiante) =>
      estudiante.asignaciones
        .filter((asignacion) => asignacion.urgencia === 'vencida' || asignacion.urgencia === 'alta')
        .map((asignacion) => ({ estudiante, asignacion }))
    )
    .sort((a, b) => {
      const pesoA = a.asignacion.urgencia === 'vencida' ? 0 : 1;
      const pesoB = b.asignacion.urgencia === 'vencida' ? 0 : 1;
      if (pesoA !== pesoB) return pesoA - pesoB;

      const fechaA = a.asignacion.fechaCierre ? new Date(a.asignacion.fechaCierre).getTime() : Number.MAX_SAFE_INTEGER;
      const fechaB = b.asignacion.fechaCierre ? new Date(b.asignacion.fechaCierre).getTime() : Number.MAX_SAFE_INTEGER;
      return fechaA - fechaB;
    });
}

function formatearFecha(fecha?: string): string {
  if (!fecha) return 'Sin fecha límite';
  return new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(fecha));
}

const TutorDashboardView: React.FC<TutorDashboardViewProps> = ({ estudiantes = estudiantesDemo }) => {
  const [estudianteId, setEstudianteId] = React.useState(estudiantes[0]?.id ?? '');
  const estudianteSeleccionado = estudiantes.find((estudiante) => estudiante.id === estudianteId) ?? estudiantes[0];
  const alertas = React.useMemo(() => obtenerAlertasTutor(estudiantes), [estudiantes]);
  const asignaciones = React.useMemo(
    () => ordenarAsignacionesPorUrgencia(estudianteSeleccionado?.asignaciones ?? []),
    [estudianteSeleccionado]
  );
  const metricas = React.useMemo(() => calcularMetricasCentroEstudios(asignaciones), [asignaciones]);

  if (estudiantes.length === 0) {
    return (
      <main className="p-8">
        <section className="rounded-[2rem] border border-dashed border-gray-200 bg-white p-10 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-tkd-red">Panel del tutor</p>
          <h1 className="mt-3 text-3xl font-black uppercase text-tkd-dark">Sin estudiantes vinculados</h1>
          <p className="mt-3 text-sm text-gray-500">
            El administrador debe vincular estudiantes a este tutor antes de mostrar progreso académico.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="p-8 space-y-8">
      <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-gray-400">
            Supervisión académica
          </p>
          <h1 className="mt-3 text-4xl font-black uppercase text-tkd-dark dark:text-white">
            Panel del tutor
          </h1>
          <p className="mt-2 text-sm font-bold text-gray-400">
            Consulta de progreso sin permisos de consumo ni edición.
          </p>
        </div>

        <label className="flex flex-col gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
          Estudiante vinculado
          <select
            value={estudianteSeleccionado.id}
            onChange={(evento) => setEstudianteId(evento.target.value)}
            className="min-w-[260px] rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-black uppercase text-tkd-dark"
          >
            {estudiantes.map((estudiante) => (
              <option key={estudiante.id} value={estudiante.id}>
                {estudiante.nombre}
              </option>
            ))}
          </select>
        </label>
      </header>

      <section className="rounded-[2rem] bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/10 p-6 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-tkd-red">Estudiante seleccionado</p>
        <h2 className="mt-2 text-2xl font-black uppercase text-tkd-dark dark:text-white">
          {estudianteSeleccionado.nombre}
        </h2>
        <p className="mt-1 text-sm font-bold text-gray-400">{estudianteSeleccionado.grupo ?? 'Sin grupo asignado'}</p>
      </section>

      <ProgresoResumenCard metricas={metricas} estado="Solo lectura" />

      <section className="rounded-[2rem] bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/10 p-6 shadow-sm">
        <h2 className="text-xl font-black uppercase text-tkd-dark dark:text-white">Alertas del tutor</h2>
        <div className="mt-5 space-y-3">
          {alertas.length === 0 ? (
            <p className="text-sm font-bold text-gray-400">No hay asignaciones vencidas o próximas a vencer.</p>
          ) : (
            alertas.map(({ estudiante, asignacion }) => (
              <article key={`${estudiante.id}-${asignacion.id}`} className="rounded-2xl bg-gray-50 dark:bg-white/5 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-tkd-red">
                  {asignacion.urgencia === 'vencida' ? 'Vencida' : 'Próxima a vencer'}
                </p>
                <p className="mt-1 text-sm font-black uppercase text-tkd-dark dark:text-white">
                  {estudiante.nombre} · {asignacion.titulo}
                </p>
                <p className="mt-1 text-xs font-bold text-gray-400">Cierre: {formatearFecha(asignacion.fechaCierre)}</p>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {asignaciones.map((asignacion) => (
          <article key={asignacion.id} className="rounded-[2rem] bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/10 p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-tkd-red">{asignacion.uso}</p>
                <h3 className="mt-2 text-lg font-black uppercase text-tkd-dark dark:text-white">{asignacion.titulo}</h3>
              </div>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-gray-500">
                {asignacion.estadoProgreso}
              </span>
            </div>

            <p className="mt-4 text-sm text-gray-500">{asignacion.descripcion}</p>
            <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-gray-400">
              Cierre: {formatearFecha(asignacion.fechaCierre)}
            </p>
            <div className="mt-5 h-3 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full bg-tkd-blue" style={{ width: `${asignacion.porcentajeProgreso}%` }} />
            </div>
            <p className="mt-2 text-right text-[10px] font-black uppercase tracking-widest text-gray-400">
              {asignacion.porcentajeProgreso}%
            </p>
            <button
              type="button"
              disabled
              className="mt-5 w-full rounded-2xl bg-gray-100 py-4 text-[11px] font-black uppercase tracking-[0.22em] text-gray-400 cursor-not-allowed"
            >
              Solo lectura
            </button>
          </article>
        ))}
      </section>
    </main>
  );
};

export default TutorDashboardView;
