import React from 'react';
import type { DestinatarioAsignacion } from '../../models/academico/asignacion';
import type { MomentoAsignacion } from '../../models/academico';
import type { RecursoAcademico } from '../../models/academico/recurso';
import { publishAsignacion } from '../../servicios/academico/asignacionService';

const recursosAprobados: RecursoAcademico[] = [
  {
    id: 'recurso-pdf',
    tenantId: 'tenant-demo',
    proveedor: 'google_drive',
    externalFileId: 'drive-pdf-1',
    nombre: 'Fundamentos tecnicos',
    mimeType: 'application/pdf',
    ficha: {
      disciplina: 'Taekwondo',
      tipo: 'pdf',
      usos: ['estudio', 'preparacion'],
    },
    estado: 'aprobado',
    creadoPorUid: 'admin-demo',
    creadoEn: '2026-06-27T00:00:00.000Z',
    actualizadoEn: '2026-06-27T00:00:00.000Z',
  },
  {
    id: 'recurso-video',
    tenantId: 'tenant-demo',
    proveedor: 'google_drive',
    externalFileId: 'drive-video-1',
    nombre: 'Refuerzo patada frontal',
    mimeType: 'video/mp4',
    ficha: {
      disciplina: 'Taekwondo',
      tipo: 'video',
      usos: ['refuerzo'],
    },
    estado: 'aprobado',
    creadoPorUid: 'admin-demo',
    creadoEn: '2026-06-27T00:00:00.000Z',
    actualizadoEn: '2026-06-27T00:00:00.000Z',
  },
];

function crearDestinatario(tipo: DestinatarioAsignacion['tipo'], grupo: string, grados: string): DestinatarioAsignacion {
  if (tipo === 'estudiante') {
    return {
      tipo,
      estudianteIds: grupo.split(',').map((item) => item.trim()).filter(Boolean),
    };
  }

  if (tipo === 'grado') {
    return {
      tipo,
      grupo: grupo.trim(),
      grados: grados.split(',').map((item) => item.trim()).filter(Boolean),
    };
  }

  return {
    tipo,
    grupo: grupo.trim(),
  };
}

function etiquetaDestinatario(destinatario: DestinatarioAsignacion) {
  if (destinatario.tipo === 'estudiante') {
    return `Estudiante: ${(destinatario.estudianteIds ?? []).join(', ')}`;
  }
  if (destinatario.tipo === 'grado') {
    return `Grado: ${destinatario.grupo}`;
  }
  return `Grupo: ${destinatario.grupo}`;
}

const AsignacionesView: React.FC = () => {
  const [recursoId, setRecursoId] = React.useState('recurso-pdf');
  const [tipoDestinatario, setTipoDestinatario] = React.useState<DestinatarioAsignacion['tipo']>('grupo');
  const [grupo, setGrupo] = React.useState('');
  const [grados, setGrados] = React.useState('');
  const [fechaApertura, setFechaApertura] = React.useState('2026-06-27');
  const [fechaCierre, setFechaCierre] = React.useState('');
  const [momento, setMomento] = React.useState<MomentoAsignacion>('preparacion');
  const [publicada, setPublicada] = React.useState<ReturnType<typeof publishAsignacion> | null>(null);

  const recurso = recursosAprobados.find((item) => item.id === recursoId) ?? recursosAprobados[0];

  const publicar = () => {
    const destinatario = crearDestinatario(tipoDestinatario, grupo || 'Infantil', grados);
    const asignacion = publishAsignacion({
      asignacion: {
        id: `asignacion-${recurso.id}`,
        tenantId: 'tenant-demo',
        recursoId: recurso.id,
        titulo: recurso.nombre,
        descripcion: `Asignacion academica para ${recurso.ficha?.disciplina ?? 'disciplina general'}`,
        destinatario,
        uso: recurso.ficha?.usos[0] ?? 'estudio',
        momento,
        obligatoria: true,
        fechaApertura: `${fechaApertura}T00:00:00.000Z`,
        fechaCierre: fechaCierre ? `${fechaCierre}T23:59:59.000Z` : undefined,
        estado: 'borrador',
        creadoPorUid: 'maestro-demo',
        creadoEn: new Date().toISOString(),
        actualizadoEn: new Date().toISOString(),
      },
      recurso,
      publicadoPorUid: 'maestro-demo',
    });

    setPublicada(asignacion);
  };

  return (
    <section className="p-6 sm:p-10 space-y-8">
      <header>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-tkd-red">
          Centro de Estudios
        </p>
        <h1 className="text-3xl font-black uppercase text-tkd-dark dark:text-white">
          Asignaciones academicas
        </h1>
        <p className="mt-2 text-sm font-bold text-gray-400">
          Publica recursos aprobados para grupos, grados o estudiantes especificos.
        </p>
      </header>

      <article className="rounded-[2rem] border border-gray-100 dark:border-white/10 bg-white dark:bg-gray-900 p-6 grid gap-4">
        <label htmlFor="asignacion-recurso" className="text-[10px] font-black uppercase tracking-widest text-gray-400">
          Recurso aprobado
        </label>
        <select
          id="asignacion-recurso"
          value={recursoId}
          onChange={(event) => setRecursoId(event.target.value)}
          className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold"
        >
          {recursosAprobados.map((item) => (
            <option key={item.id} value={item.id}>{item.nombre}</option>
          ))}
        </select>

        <label htmlFor="asignacion-destinatario" className="text-[10px] font-black uppercase tracking-widest text-gray-400">
          Destinatario
        </label>
        <select
          id="asignacion-destinatario"
          value={tipoDestinatario}
          onChange={(event) => setTipoDestinatario(event.target.value as DestinatarioAsignacion['tipo'])}
          className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold"
        >
          <option value="grupo">Grupo</option>
          <option value="grado">Grado</option>
          <option value="estudiante">Estudiante</option>
        </select>

        <label htmlFor="asignacion-grupo" className="text-[10px] font-black uppercase tracking-widest text-gray-400">
          Grupo objetivo
        </label>
        <input
          id="asignacion-grupo"
          value={grupo}
          onChange={(event) => setGrupo(event.target.value)}
          placeholder={tipoDestinatario === 'estudiante' ? 'estudiante-1, estudiante-2' : 'Infantil'}
          className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold"
        />

        {tipoDestinatario === 'grado' && (
          <>
            <label htmlFor="asignacion-grados" className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              Grados objetivo
            </label>
            <input
              id="asignacion-grados"
              value={grados}
              onChange={(event) => setGrados(event.target.value)}
              placeholder="Blanco, Amarillo"
              className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold"
            />
          </>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <label htmlFor="asignacion-apertura" className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              Fecha de apertura
            </label>
            <input
              id="asignacion-apertura"
              type="date"
              value={fechaApertura}
              onChange={(event) => setFechaApertura(event.target.value)}
              className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold"
            />
          </div>

          <div className="grid gap-2">
            <label htmlFor="asignacion-cierre" className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              Fecha de cierre
            </label>
            <input
              id="asignacion-cierre"
              type="date"
              value={fechaCierre}
              onChange={(event) => setFechaCierre(event.target.value)}
              className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold"
            />
          </div>
        </div>

        <label htmlFor="asignacion-momento" className="text-[10px] font-black uppercase tracking-widest text-gray-400">
          Momento pedagogico
        </label>
        <select
          id="asignacion-momento"
          value={momento}
          onChange={(event) => setMomento(event.target.value as MomentoAsignacion)}
          className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold"
        >
          <option value="preparacion">Preparacion</option>
          <option value="durante">Durante la jornada</option>
          <option value="refuerzo_posterior">Refuerzo posterior</option>
        </select>

        <button
          type="button"
          onClick={publicar}
          className="rounded-2xl bg-tkd-red text-white px-5 py-3 text-[10px] font-black uppercase tracking-widest"
        >
          Publicar asignacion
        </button>
      </article>

      {publicada && (
        <article className="rounded-[2rem] border border-green-100 bg-green-50 p-6 space-y-2 text-green-800">
          <p className="text-[10px] font-black uppercase tracking-widest">Asignacion publicada</p>
          <h2 className="text-2xl font-black uppercase">{publicada.titulo}</h2>
          <p className="text-sm font-bold">{etiquetaDestinatario(publicada.destinatario)}</p>
          {publicada.destinatario.grados?.length ? (
            <p className="text-sm font-bold">{publicada.destinatario.grados.join(', ')}</p>
          ) : null}
          <p className="text-xs font-black uppercase">Momento: {publicada.momento}</p>
        </article>
      )}
    </section>
  );
};

export default AsignacionesView;
