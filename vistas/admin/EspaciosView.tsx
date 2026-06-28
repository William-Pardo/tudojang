import React from 'react';
import type { DisponibilidadEspacio, EspacioFisico, ReservaEspacio } from '../../models/academico/espacio';
import { createEspacio, getDisponibilidad } from '../../servicios/academico/espacioService';

const reservaExistente: ReservaEspacio = {
  id: 'reserva-existente-1',
  espacioId: 'espacio-demo-principal',
  fecha: '2026-06-27',
  horaInicio: '08:00',
  horaFin: '09:30',
  referenciaId: 'Jornada existente',
};

const EspaciosView: React.FC = () => {
  const [nombre, setNombre] = React.useState('Tatami principal');
  const [capacidad, setCapacidad] = React.useState('30');
  const [espacios, setEspacios] = React.useState<EspacioFisico[]>([]);
  const [disponibilidad, setDisponibilidad] = React.useState<DisponibilidadEspacio>({
    disponible: true,
    conflictos: [],
  });

  const crear = () => {
    const espacio = createEspacio({
      tenantId: 'tenant-demo',
      sedeId: 'sede-principal',
      nombre,
      capacidad: Number(capacidad),
      disciplinasPermitidas: ['taekwondo'],
    });
    setEspacios((actuales) => [...actuales, espacio]);
    setDisponibilidad({ disponible: true, conflictos: [] });
  };

  const probarConflicto = () => {
    setDisponibilidad(getDisponibilidad({
      espacioId: 'espacio-demo-principal',
      fecha: '2026-06-27',
      horaInicio: '09:00',
      horaFin: '10:00',
      reservas: [reservaExistente],
    }));
  };

  return (
    <section className="p-6 sm:p-10 space-y-8">
      <header>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-tkd-red">
          Centro de Estudios
        </p>
        <h1 className="text-3xl font-black uppercase text-tkd-dark dark:text-white">
          Espacios fisicos
        </h1>
        <p className="mt-2 text-sm font-bold text-gray-400">
          Gestiona espacios por sede y valida conflictos de disponibilidad.
        </p>
      </header>

      <div className="rounded-[2rem] border border-gray-100 dark:border-white/10 bg-white dark:bg-gray-900 p-6 grid gap-4">
        <label htmlFor="espacio-nombre" className="text-[10px] font-black uppercase tracking-widest text-gray-400">
          Nombre del espacio
        </label>
        <input
          id="espacio-nombre"
          value={nombre}
          onChange={(event) => setNombre(event.target.value)}
          className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold"
        />

        <label htmlFor="espacio-capacidad" className="text-[10px] font-black uppercase tracking-widest text-gray-400">
          Capacidad
        </label>
        <input
          id="espacio-capacidad"
          type="number"
          value={capacidad}
          onChange={(event) => setCapacidad(event.target.value)}
          className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold"
        />

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={crear}
            className="rounded-2xl bg-tkd-dark text-white px-5 py-3 text-[10px] font-black uppercase tracking-widest"
          >
            Crear espacio
          </button>
          <button
            type="button"
            onClick={probarConflicto}
            className="rounded-2xl bg-tkd-red text-white px-5 py-3 text-[10px] font-black uppercase tracking-widest"
          >
            Probar horario con conflicto
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <article className="rounded-[2rem] border border-gray-100 dark:border-white/10 bg-white dark:bg-gray-900 p-6">
          <h2 className="text-xl font-black uppercase text-tkd-dark dark:text-white">Espacios por sede</h2>
          <div className="mt-5 space-y-3">
            {espacios.length === 0 ? (
              <p className="text-sm font-bold text-gray-400">Sin espacios registrados.</p>
            ) : (
              espacios.map((espacio) => (
                <div key={espacio.id} className="rounded-2xl bg-gray-50 dark:bg-white/5 p-4">
                  <p className="text-sm font-black text-tkd-dark dark:text-white">{espacio.nombre}</p>
                  <p className="text-xs font-bold text-gray-400">Capacidad: {espacio.capacidad}</p>
                  <p className="text-xs font-bold text-gray-400">Sede principal</p>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="rounded-[2rem] border border-gray-100 dark:border-white/10 bg-white dark:bg-gray-900 p-6">
          <h2 className="text-xl font-black uppercase text-tkd-dark dark:text-white">Disponibilidad</h2>
          {disponibilidad.disponible ? (
            <div className="mt-5 rounded-2xl bg-green-50 text-green-700 p-4 text-sm font-black uppercase">
              Disponible
            </div>
          ) : (
            <div className="mt-5 rounded-2xl bg-red-50 text-red-700 p-4 text-sm font-black uppercase space-y-2">
              <p>Conflicto detectado</p>
              {disponibilidad.conflictos.map((conflicto) => (
                <p key={conflicto.id}>{conflicto.referenciaId}</p>
              ))}
            </div>
          )}
        </article>
      </div>
    </section>
  );
};

export default EspaciosView;
