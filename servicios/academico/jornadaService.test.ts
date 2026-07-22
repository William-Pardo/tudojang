import {
  cancelarJornada,
  cerrarJornada,
  confirmarJornada,
  createJornada,
  generateJornadasFromBloque,
  iniciarJornada,
  marcarPendienteCierre,
  rechazarTransicionInvalida,
  reprogramarJornada,
} from './jornadaService';

describe('jornadaService', () => {
  it('crea jornada en borrador con datos base', () => {
    const jornada = createJornada({
      tenantId: 'tenant-1',
      programaId: 'programa-1',
      ejecucionProgramaId: 'ejecucion-1',
      grupoId: 'grupo-infantil',
      sedeId: 'sede-principal',
      espacioId: 'tatami-1',
      instructorId: 'maestro-1',
      fecha: '2026-06-27',
      horaInicio: '08:00',
      horaFin: '09:00',
      objetivosPlaneados: ['obj-1'],
    });

    expect(jornada).toEqual(expect.objectContaining({
      tenantId: 'tenant-1',
      estado: 'borrador',
      objetivosPlaneados: ['obj-1'],
      objetivosImpartidos: [],
      asistenciaRegistrada: false,
    }));
  });

  it('transiciona ciclo normal hasta cerrada', () => {
    const jornada = createJornadaBase();
    const confirmada = confirmarJornada(jornada);
    const enCurso = iniciarJornada(confirmada);
    const pendienteCierre = marcarPendienteCierre(enCurso, {
      asistenciaRegistrada: true,
      objetivosImpartidos: ['obj-1'],
    });
    const cerrada = cerrarJornada(pendienteCierre);

    expect(confirmada.estado).toBe('confirmada');
    expect(enCurso.estado).toBe('en_curso');
    expect(pendienteCierre.estado).toBe('pendiente_cierre');
    expect(cerrada.estado).toBe('cerrada');
  });

  it('rechaza cierre sin asistencia registrada', () => {
    const jornada = marcarPendienteCierre(iniciarJornada(confirmarJornada(createJornadaBase())), {
      asistenciaRegistrada: false,
      objetivosImpartidos: ['obj-1'],
    });

    expect(() => cerrarJornada(jornada)).toThrow(/asistencia/i);
  });

  it('rechaza cierre sin objetivos impartidos', () => {
    const jornada = marcarPendienteCierre(iniciarJornada(confirmarJornada(createJornadaBase())), {
      asistenciaRegistrada: true,
      objetivosImpartidos: [],
    });

    expect(() => cerrarJornada(jornada)).toThrow(/objetivos/i);
  });

  it('permite cancelar jornada antes de cerrarla', () => {
    const cancelada = cancelarJornada(confirmarJornada(createJornadaBase()), 'Instructor no disponible');

    expect(cancelada.estado).toBe('cancelada');
    expect(cancelada.motivoCancelacion).toBe('Instructor no disponible');
  });

  // Rediseño 2026-07-13 (pedido explicito del usuario): posibilidad de restituir una
  // clase cancelada por error -- reutiliza confirmarJornada, unico camino de salida
  // de 'cancelada' (transicionesPermitidas.cancelada = ['confirmada']).
  it('permite restituir (confirmar) una jornada cancelada', () => {
    const cancelada = cancelarJornada(confirmarJornada(createJornadaBase()), 'Feriado nacional');

    const restituida = confirmarJornada(cancelada);

    expect(restituida.estado).toBe('confirmada');
  });

  it('rechaza transicionar una jornada cancelada a cualquier estado que no sea confirmada', () => {
    const cancelada = cancelarJornada(confirmarJornada(createJornadaBase()), 'Feriado nacional');

    expect(() => rechazarTransicionInvalida(cancelada, 'en_curso')).toThrow(/transicion invalida/i);
  });

  it('rechaza transiciones invalidas', () => {
    expect(() => rechazarTransicionInvalida(createJornadaBase(), 'cerrada')).toThrow(/transicion invalida/i);
  });

  // Rediseño 2026-07-12 (pedido explicito del usuario: "borrador como estado ya no
  // deberia existir", clases malleables por defecto): borrador ahora permite reprogramar
  // directamente, igual que confirmada -- revierte el rechazo que existia antes.
  it('permite transicion directa borrador -> reprogramada (jornadas malleables por defecto)', () => {
    expect(() => rechazarTransicionInvalida(createJornadaBase(), 'reprogramada')).not.toThrow();
  });

  it('rechaza transiciones realmente invalidas (borrador -> en_curso, sin pasar por confirmada)', () => {
    expect(() => rechazarTransicionInvalida(createJornadaBase(), 'en_curso')).toThrow(/transicion invalida/i);
  });

  it('reprograma una jornada confirmada con nueva fecha y horario en un solo paso', () => {
    const confirmada = confirmarJornada(createJornadaBase());

    const reprogramada = reprogramarJornada(confirmada, {
      fecha: '2026-07-04',
      horaInicio: '10:00',
      horaFin: '11:00',
    });

    expect(reprogramada.estado).toBe('confirmada');
    expect(reprogramada.fecha).toBe('2026-07-04');
    expect(reprogramada.horaInicio).toBe('10:00');
    expect(reprogramada.horaFin).toBe('11:00');
  });

  // Rediseño 2026-07-12: idem arriba -- una jornada recien creada (borrador) ahora se
  // puede reprogramar directamente sin confirmar primero, terminando en 'confirmada'
  // (mismo comportamiento que reprogramar desde 'confirmada').
  it('reprograma una jornada en borrador directamente, sin exigir confirmar primero', () => {
    const jornada = createJornadaBase();

    const reprogramada = reprogramarJornada(jornada, {
      fecha: '2026-07-04',
      horaInicio: '10:00',
      horaFin: '11:00',
    });

    expect(reprogramada.estado).toBe('confirmada');
    expect(reprogramada.fecha).toBe('2026-07-04');
  });

  it('rechaza reprogramar una jornada cerrada (estado terminal)', () => {
    const cerrada = cerrarJornada(marcarPendienteCierre(iniciarJornada(confirmarJornada(createJornadaBase())), {
      asistenciaRegistrada: true,
      objetivosImpartidos: ['obj-1'],
    }));

    expect(() => reprogramarJornada(cerrada, {
      fecha: '2026-07-04',
      horaInicio: '10:00',
      horaFin: '11:00',
    })).toThrow(/transicion invalida/i);
  });

  it('createJornada con estadoInicial explicito nace directamente en ese estado (batch de Centro de Estudios)', () => {
    const jornada = createJornada({
      tenantId: 'tenant-1',
      programaId: 'programa-1',
      ejecucionProgramaId: 'ejecucion-1',
      grupoId: 'grupo-infantil',
      sedeId: 'sede-principal',
      espacioId: 'tatami-1',
      instructorId: 'maestro-1',
      fecha: '2026-06-27',
      horaInicio: '08:00',
      horaFin: '09:00',
      objetivosPlaneados: ['obj-1'],
      estadoInicial: 'confirmada',
    });

    expect(jornada.estado).toBe('confirmada');
  });

  it('genera jornadas desde bloque recurrente por rango de fechas', () => {
    const jornadas = generateJornadasFromBloque({
      bloque: {
        id: 'bloque-1',
        tenantId: 'tenant-1',
        grupoId: 'grupo-infantil',
        sedeId: 'sede-principal',
        espacioId: 'tatami-1',
        instructorId: 'maestro-1',
        diaSemana: 6,
        horaInicio: '08:00',
        horaFin: '09:00',
        activo: true,
      },
      programaId: 'programa-1',
      ejecucionProgramaId: 'ejecucion-1',
      objetivosPlaneados: ['obj-1'],
      fechaInicio: '2026-06-01',
      fechaFin: '2026-06-30',
    });

    expect(jornadas.map((jornada) => jornada.fecha)).toEqual([
      '2026-06-06',
      '2026-06-13',
      '2026-06-20',
      '2026-06-27',
    ]);
    // Rediseño 2026-07-12: las jornadas generadas por Centro de Estudios (via bloque
    // recurrente) nacen directamente 'confirmada' -- malleables por defecto, sin paso
    // manual de "Confirmar" (ver createJornada({ estadoInicial: 'confirmada' }) mas abajo).
    expect(jornadas.every((jornada) => jornada.estado === 'confirmada')).toBe(true);
    expect(jornadas.every((jornada) => jornada.bloqueRecurrenteId === 'bloque-1')).toBe(true);
  });

  it('no genera jornadas si el bloque recurrente esta inactivo', () => {
    expect(generateJornadasFromBloque({
      bloque: {
        id: 'bloque-1',
        tenantId: 'tenant-1',
        grupoId: 'grupo-infantil',
        sedeId: 'sede-principal',
        espacioId: 'tatami-1',
        instructorId: 'maestro-1',
        diaSemana: 6,
        horaInicio: '08:00',
        horaFin: '09:00',
        activo: false,
      },
      programaId: 'programa-1',
      ejecucionProgramaId: 'ejecucion-1',
      objetivosPlaneados: ['obj-1'],
      fechaInicio: '2026-06-01',
      fechaFin: '2026-06-30',
    })).toEqual([]);
  });

  it('rechaza createJornada si horaFin es igual a horaInicio', () => {
    expect(() => createJornada({
      tenantId: 'tenant-1',
      programaId: 'programa-1',
      ejecucionProgramaId: 'ejecucion-1',
      grupoId: 'grupo-infantil',
      sedeId: 'sede-principal',
      espacioId: 'tatami-1',
      instructorId: 'maestro-1',
      fecha: '2026-06-27',
      horaInicio: '09:00',
      horaFin: '09:00',
      objetivosPlaneados: ['obj-1'],
    })).toThrow(/horaFin debe ser posterior/i);
  });

  it('rechaza createJornada si horaFin es anterior a horaInicio', () => {
    expect(() => createJornada({
      tenantId: 'tenant-1',
      programaId: 'programa-1',
      ejecucionProgramaId: 'ejecucion-1',
      grupoId: 'grupo-infantil',
      sedeId: 'sede-principal',
      espacioId: 'tatami-1',
      instructorId: 'maestro-1',
      fecha: '2026-06-27',
      horaInicio: '10:00',
      horaFin: '09:00',
      objetivosPlaneados: ['obj-1'],
    })).toThrow(/horaFin debe ser posterior/i);
  });

  it('rechaza reprogramarJornada si horaFin es igual a horaInicio', () => {
    const confirmada = confirmarJornada(createJornadaBase());
    expect(() => reprogramarJornada(confirmada, {
      fecha: '2026-07-04',
      horaInicio: '10:00',
      horaFin: '10:00',
    })).toThrow(/horaFin debe ser posterior/i);
  });

  it('rechaza reprogramarJornada si horaFin es anterior a horaInicio', () => {
    const confirmada = confirmarJornada(createJornadaBase());
    expect(() => reprogramarJornada(confirmada, {
      fecha: '2026-07-04',
      horaInicio: '11:00',
      horaFin: '09:00',
    })).toThrow(/horaFin debe ser posterior/i);
  });
});

function createJornadaBase() {
  return createJornada({
    tenantId: 'tenant-1',
    programaId: 'programa-1',
    ejecucionProgramaId: 'ejecucion-1',
    grupoId: 'grupo-infantil',
    sedeId: 'sede-principal',
    espacioId: 'tatami-1',
    instructorId: 'maestro-1',
    fecha: '2026-06-27',
    horaInicio: '08:00',
    horaFin: '09:00',
    objetivosPlaneados: ['obj-1'],
  });
}
