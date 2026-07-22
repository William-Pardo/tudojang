// servicios/academico/patronHorarioService.test.ts

import { calcularPatronHorario, formatearHora } from './patronHorarioService';
import type { ActividadLog } from '../../models/academico/actividad';
import type { ProgramaDeAsignacion } from './analisisProgresoService';

function crearLog(overrides: Partial<ActividadLog> = {}): ActividadLog {
  return {
    id: `log-${Math.random()}`,
    tenantId: 'tenant-1',
    estudianteId: 'est-1',
    asignacionId: 'asig-1',
    recursoId: 'rec-1',
    tipo: 'video',
    metadata: { porcentajeVisto: 50 },
    registradoEn: '2026-07-20T00:00:00Z', // se sobreescribe en cada test
    ...overrides,
  };
}

// 2026-07-20 es lunes. En UTC-5 (America/Bogota, sin horario de verano) las 00:00Z de un
// lunes siguen siendo domingo 19:00 hora local -- por eso los tests fijan horas que no caen
// cerca de la medianoche UTC, para no depender de ese corrimiento en la lectura del caso.
function isoBogota(fechaHoraUTC: string): string {
  return fechaHoraUTC;
}

describe('calcularPatronHorario', () => {
  it('devuelve null cuando no hay logs', () => {
    expect(calcularPatronHorario([])).toBeNull();
  });

  it('cuenta el total de eventos', () => {
    const logs = [
      crearLog({ registradoEn: isoBogota('2026-07-20T18:00:00Z') }),
      crearLog({ registradoEn: isoBogota('2026-07-21T18:00:00Z') }),
    ];
    const patron = calcularPatronHorario(logs);
    expect(patron?.totalEventos).toBe(2);
  });

  it('detecta el dia pico correctamente', () => {
    // 18:00 UTC = 13:00 Bogota (UTC-5), mismo dia calendario en ambos.
    const logs = [
      crearLog({ registradoEn: '2026-07-20T18:00:00Z' }), // lunes
      crearLog({ registradoEn: '2026-07-21T18:00:00Z' }), // martes
      crearLog({ registradoEn: '2026-07-21T19:00:00Z' }), // martes
    ];
    const patron = calcularPatronHorario(logs);
    expect(patron?.diaPico).toBe('Martes');
    expect(patron?.porDia.find((d) => d.dia === 'Martes')?.cantidad).toBe(2);
    expect(patron?.porDia.find((d) => d.dia === 'Lunes')?.cantidad).toBe(1);
  });

  it('detecta la hora pico correctamente (hora Bogota, UTC-5)', () => {
    const logs = [
      crearLog({ registradoEn: '2026-07-20T18:00:00Z' }), // 13:00 Bogota
      crearLog({ registradoEn: '2026-07-20T19:00:00Z' }), // 14:00 Bogota
      crearLog({ registradoEn: '2026-07-21T19:00:00Z' }), // 14:00 Bogota
    ];
    const patron = calcularPatronHorario(logs);
    expect(patron?.horaPico).toBe(14);
    expect(patron?.porHora[14]).toBe(2);
  });

  it('calcula el porcentaje de actividad en fin de semana', () => {
    const logs = [
      crearLog({ registradoEn: '2026-07-20T18:00:00Z' }), // lunes
      crearLog({ registradoEn: '2026-07-25T18:00:00Z' }), // sabado
      crearLog({ registradoEn: '2026-07-26T18:00:00Z' }), // domingo
      crearLog({ registradoEn: '2026-07-26T19:00:00Z' }), // domingo
    ];
    const patron = calcularPatronHorario(logs);
    expect(patron?.pctFinDeSemana).toBe(75); // 3 de 4
  });

  it('filtra por programa cuando se pasa filtroPrograma distinto de "todos"', () => {
    const logs = [
      crearLog({ asignacionId: 'asig-infantil', registradoEn: '2026-07-20T18:00:00Z' }),
      crearLog({ asignacionId: 'asig-competencia', registradoEn: '2026-07-21T18:00:00Z' }),
    ];
    const mapa = new Map<string, ProgramaDeAsignacion>([
      ['asig-infantil', { programaId: 'prog-infantil', programaNombre: 'Infantil' }],
      ['asig-competencia', { programaId: 'prog-competencia', programaNombre: 'Competencia' }],
    ]);
    const patron = calcularPatronHorario(logs, mapa, 'prog-infantil');
    expect(patron?.totalEventos).toBe(1);
    expect(patron?.diaPico).toBe('Lunes');
  });

  it('ignora el filtro de programa cuando es "todos"', () => {
    const logs = [
      crearLog({ asignacionId: 'asig-infantil', registradoEn: '2026-07-20T18:00:00Z' }),
      crearLog({ asignacionId: 'asig-competencia', registradoEn: '2026-07-21T18:00:00Z' }),
    ];
    const mapa = new Map<string, ProgramaDeAsignacion>([
      ['asig-infantil', { programaId: 'prog-infantil', programaNombre: 'Infantil' }],
    ]);
    const patron = calcularPatronHorario(logs, mapa, 'todos');
    expect(patron?.totalEventos).toBe(2);
  });
});

describe('formatearHora', () => {
  it('formatea con dos digitos y sufijo "h"', () => {
    expect(formatearHora(9)).toBe('09:00 h');
    expect(formatearHora(19)).toBe('19:00 h');
    expect(formatearHora(0)).toBe('00:00 h');
  });
});
