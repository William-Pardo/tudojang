import {
  createEspacio,
  getDisponibilidad,
  updateEspacio,
} from './espacioService';
import type { ReservaEspacio } from '../../models/academico/espacio';

describe('espacioService', () => {
  it('crea espacio fisico activo para una sede', () => {
    const espacio = createEspacio({
      tenantId: 'tenant-1',
      sedeId: 'sede-1',
      nombre: 'Tatami principal',
      capacidad: 30,
      disciplinasPermitidas: ['taekwondo', 'hapkido'],
    });

    expect(espacio).toEqual(expect.objectContaining({
      tenantId: 'tenant-1',
      sedeId: 'sede-1',
      nombre: 'Tatami principal',
      capacidad: 30,
      activo: true,
    }));
  });

  it('actualiza datos editables del espacio sin cambiar tenant ni sede', () => {
    const espacio = createEspacio({
      tenantId: 'tenant-1',
      sedeId: 'sede-1',
      nombre: 'Tatami principal',
      capacidad: 30,
      disciplinasPermitidas: ['taekwondo'],
    });

    const actualizado = updateEspacio(espacio, {
      nombre: 'Tatami auxiliar',
      capacidad: 15,
      activo: false,
    });

    expect(actualizado).toEqual(expect.objectContaining({
      tenantId: 'tenant-1',
      sedeId: 'sede-1',
      nombre: 'Tatami auxiliar',
      capacidad: 15,
      activo: false,
    }));
  });

  it('detecta disponibilidad cuando no hay solapamientos', () => {
    const reservas: ReservaEspacio[] = [
      {
        id: 'reserva-1',
        espacioId: 'espacio-1',
        fecha: '2026-06-27',
        horaInicio: '08:00',
        horaFin: '09:00',
        referenciaId: 'jornada-1',
      },
    ];

    expect(getDisponibilidad({
      espacioId: 'espacio-1',
      fecha: '2026-06-27',
      horaInicio: '09:00',
      horaFin: '10:00',
      reservas,
    })).toEqual({ disponible: true, conflictos: [] });
  });

  it('detecta conflictos por espacios superpuestos', () => {
    const reservas: ReservaEspacio[] = [
      {
        id: 'reserva-1',
        espacioId: 'espacio-1',
        fecha: '2026-06-27',
        horaInicio: '08:00',
        horaFin: '09:30',
        referenciaId: 'jornada-1',
      },
      {
        id: 'reserva-2',
        espacioId: 'espacio-2',
        fecha: '2026-06-27',
        horaInicio: '08:30',
        horaFin: '09:30',
        referenciaId: 'jornada-2',
      },
    ];

    const disponibilidad = getDisponibilidad({
      espacioId: 'espacio-1',
      fecha: '2026-06-27',
      horaInicio: '09:00',
      horaFin: '10:00',
      reservas,
    });

    expect(disponibilidad.disponible).toBe(false);
    expect(disponibilidad.conflictos).toHaveLength(1);
    expect(disponibilidad.conflictos[0].id).toBe('reserva-1');
  });

  it('ignora una reserva existente cuando se edita la misma referencia', () => {
    const reservas: ReservaEspacio[] = [
      {
        id: 'reserva-1',
        espacioId: 'espacio-1',
        fecha: '2026-06-27',
        horaInicio: '08:00',
        horaFin: '09:30',
        referenciaId: 'jornada-1',
      },
    ];

    expect(getDisponibilidad({
      espacioId: 'espacio-1',
      fecha: '2026-06-27',
      horaInicio: '08:30',
      horaFin: '09:00',
      referenciaIdIgnorada: 'jornada-1',
      reservas,
    }).disponible).toBe(true);
  });
});
