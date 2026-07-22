/**
 * PRUEBAS DE INTEGRACION — Clase en Vivo, coherencia entre el scheduler y la ventana horaria.
 *
 * Esta es la junta #3 de la cadena de Clase en Vivo (ver ACCIONES_PENDIENTES.md):
 *
 *   functions/academico/jornadasScheduler.js   confirmada -> en_curso por horario (cron)
 *     |                                        usa America/Bogota (UTC-5, sin DST)
 *     v
 *   servicios/academico/ventanaClaseEnVivoService.ts   ventana [inicio-15, fin+15]
 *                                              habilita el boton "Iniciar Clase en Vivo"
 *                                              (App.tsx, Horarios.tsx, AgendaView.tsx)
 *
 * Los dos leen los MISMOS campos de texto plano (`fecha`, `horaInicio`, `horaFin`) de la
 * misma `JornadaInstruccion`. Si no los interpretan en la misma zona horaria, el escaner de
 * QR se habilita a una hora distinta de aquella en la que la clase realmente empieza.
 *
 * Ningun test unitario podia detectar esto: cada modulo es internamente consistente y sus
 * suites propias pasan. El defecto vive EXACTAMENTE en la junta, y solo aparece cuando se
 * cruzan las dos interpretaciones sobre el mismo dato.
 *
 * Se cargan ambos modulos REALES -- el scheduler via `require` (CommonJS, vive en
 * `functions/`, sin dependencias de firebase-admin a nivel de modulo).
 */

import {
  estaJornadaEnVentana,
  calcularIndicadorClaseEnVivo,
  calcularVentanaClaseEnVivo,
} from './ventanaClaseEnVivoService';
import type { JornadaInstruccion } from '../../models/academico/jornada';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { debeIniciar, fechaHoraBogota, crearServicioIniciarJornadasPorHorario } =
  require('../../functions/academico/jornadasScheduler');

const ZONA_CLUB = 'America/Bogota';

/** Hora de pared en Bogota para un instante dado, para que los asserts se lean en la zona real. */
const horaBogota = (iso: string): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_CLUB,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));

const jornadaBase = (over: Partial<JornadaInstruccion> = {}): JornadaInstruccion => ({
  id: 'jornada-1',
  tenantId: 'tenant-gajog',
  programaId: 'programa-taeguk',
  ejecucionProgramaId: 'ejecucion-1',
  grupoId: 'grupo-infantil',
  sedeId: 'sede-1',
  espacioId: 'tatami-1',
  instructorId: 'maestro-1',
  // El usuario carga estos tres campos pensando en la hora del dojang (Colombia).
  fecha: '2026-07-22',
  horaInicio: '10:00',
  horaFin: '11:00',
  estado: 'confirmada',
  objetivosPlaneados: ['Taeguk 1'],
  objetivosImpartidos: [],
  asistenciaRegistrada: false,
  creadoEn: '2026-07-01T00:00:00.000Z',
  actualizadoEn: '2026-07-01T00:00:00.000Z',
  ...over,
});

// Instantes reales (UTC) de una clase de 10:00-11:00 hora de Bogota (UTC-5).
const ANTES_DE_ABRIR = '2026-07-22T14:30:00.000Z'; // 09:30 Bogota — 30 min antes
const APERTURA_EXACTA = '2026-07-22T14:45:00.000Z'; // 09:45 Bogota — inicio - 15
const DURANTE_LA_CLASE = '2026-07-22T15:30:00.000Z'; // 10:30 Bogota — en plena clase
const CIERRE_EXACTO = '2026-07-22T16:15:00.000Z'; // 11:15 Bogota — fin + 15
const DESPUES_DE_CERRAR = '2026-07-22T16:30:00.000Z'; // 11:30 Bogota — 15 min tarde

describe('Integracion: la ventana de Clase en Vivo usa la MISMA zona horaria que el scheduler', () => {
  it('el scheduler y la ventana coinciden: si el cron arranca la clase, el escaner esta habilitado', () => {
    const jornada = jornadaBase();

    // 1. El scheduler REAL decide arrancar la jornada en este instante.
    const { fecha, hora } = fechaHoraBogota(new Date(DURANTE_LA_CLASE));
    expect(debeIniciar(jornada, fecha, hora)).toBe(true);

    // 2. En EL MISMO instante, la ventana tiene que estar abierta. Si no, el cron marca la
    //    clase 'en_curso' mientras el boton de Clase en Vivo esta oculto: check-ins imposibles.
    expect(estaJornadaEnVentana(jornada, DURANTE_LA_CLASE)).toBe(true);
  });

  it('la ventana abre 15 minutos antes del inicio real, en hora del club', () => {
    const jornada = jornadaBase();

    expect(horaBogota(APERTURA_EXACTA)).toBe('09:45');
    expect(estaJornadaEnVentana(jornada, APERTURA_EXACTA)).toBe(true);
    expect(estaJornadaEnVentana(jornada, ANTES_DE_ABRIR)).toBe(false);
  });

  it('la ventana cierra 15 minutos despues del fin real, en hora del club', () => {
    const jornada = jornadaBase();

    expect(horaBogota(CIERRE_EXACTO)).toBe('11:15');
    expect(estaJornadaEnVentana(jornada, CIERRE_EXACTO)).toBe(true);
    expect(estaJornadaEnVentana(jornada, DESPUES_DE_CERRAR)).toBe(false);
  });

  it('NO abre la ventana a la madrugada (regresion del desfase UTC de 5 horas)', () => {
    const jornada = jornadaBase();

    // 04:45-06:15 Bogota es donde caia la ventana cuando el servicio interpretaba
    // `horaInicio` como UTC: cinco horas antes de la clase, con el dojang cerrado.
    const madrugada = '2026-07-22T09:45:00.000Z'; // 04:45 Bogota
    expect(horaBogota(madrugada)).toBe('04:45');
    expect(estaJornadaEnVentana(jornada, madrugada)).toBe(false);
  });

  it('el indicador de Agenda marca "activa" durante la clase real, no de madrugada', () => {
    const jornada = jornadaBase();

    expect(calcularIndicadorClaseEnVivo(jornada, DURANTE_LA_CLASE)).toBe('activa');
    expect(calcularIndicadorClaseEnVivo(jornada, '2026-07-22T09:45:00.000Z')).toBe('proxima');
    expect(calcularIndicadorClaseEnVivo(jornada, DESPUES_DE_CERRAR)).toBe('finalizada');
  });

  it('el selector de jornada activa devuelve la clase en curso durante su horario real', () => {
    const jornada = jornadaBase();

    expect(calcularVentanaClaseEnVivo([jornada], DURANTE_LA_CLASE)).toEqual(jornada);
    expect(calcularVentanaClaseEnVivo([jornada], ANTES_DE_ABRIR)).toBeNull();
  });
});

describe('Integracion: el scheduler recorre jornadas reales y solo arranca las que corresponden', () => {
  const crearSnapshot = (jornada: JornadaInstruccion) => {
    const actualizaciones: Array<Record<string, unknown>> = [];
    return {
      data: () => jornada,
      ref: { update: async (cambios: Record<string, unknown>) => { actualizaciones.push(cambios); } },
      actualizaciones,
    };
  };

  it('arranca la jornada en horario y deja intactas las de otro dia u otro estado', async () => {
    const enHorario = crearSnapshot(jornadaBase({ id: 'en-horario' }));
    const otroDia = crearSnapshot(jornadaBase({ id: 'otro-dia', fecha: '2026-07-23' }));
    const yaCerrada = crearSnapshot(jornadaBase({ id: 'ya-cerrada', estado: 'cerrada' }));

    const iniciar = crearServicioIniciarJornadasPorHorario({
      listarJornadasConfirmadas: async () => [enHorario, otroDia, yaCerrada],
    });

    const resultado = await iniciar(new Date(DURANTE_LA_CLASE));

    expect(resultado).toEqual({ procesadas: 3, iniciadas: 1 });
    expect(enHorario.actualizaciones).toEqual([
      { estado: 'en_curso', actualizadoEn: DURANTE_LA_CLASE },
    ]);
    expect(otroDia.actualizaciones).toEqual([]);
    expect(yaCerrada.actualizaciones).toEqual([]);
  });

  it('una jornada que el scheduler acaba de arrancar queda dentro de la ventana del escaner', async () => {
    const snapshot = crearSnapshot(jornadaBase());
    const iniciar = crearServicioIniciarJornadasPorHorario({
      listarJornadasConfirmadas: async () => [snapshot],
    });

    await iniciar(new Date(DURANTE_LA_CLASE));

    // El scheduler la marco 'en_curso'; la ventana debe estar abierta en ese mismo instante
    // para que el maestro pueda escanear. Esta es la cadena completa Agenda -> Clase en Vivo.
    expect(snapshot.actualizaciones[0].estado).toBe('en_curso');
    expect(estaJornadaEnVentana(snapshot.data(), DURANTE_LA_CLASE)).toBe(true);
  });
});
