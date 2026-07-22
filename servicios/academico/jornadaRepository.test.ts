import type { EjecucionPrograma } from '../../models/academico/programa';
import type { JornadaInstruccion } from '../../models/academico/jornada';
import { RolUsuario } from '../../tipos';
import { createJornada } from './jornadaService';
import {
  crearJornadaRepository,
  clearMockJornadas,
  getMockJornadas,
  mensajeConflictoHorario,
  ConflictoConcurrenciaError,
  MENSAJE_CONFLICTO_CONCURRENCIA,
  diffCambiosJornada,
  MENSAJE_ADVERTENCIA_AUDITORIA,
  evaluarEliminacionSegura,
  esJornadaOperada,
  EliminacionNoPermitidaError,
  MENSAJE_ELIMINACION_NO_PERMITIDA,
  detectarConflictosEnLote,
} from './jornadaRepository';

function crearJornadaDeLote(indice: number): JornadaInstruccion {
  return createJornada({
    tenantId: 'tenant-1',
    programaId: 'programa-1',
    ejecucionProgramaId: 'ejecucion-1',
    grupoId: 'grupo-infantil',
    sedeId: 'sede-principal',
    espacioId: 'tatami-1',
    instructorId: 'maestro-1',
    fecha: `2026-06-${String((indice % 28) + 1).padStart(2, '0')}`,
    horaInicio: '08:00',
    horaFin: '09:00',
    objetivosPlaneados: ['obj-1'],
  });
}

describe('jornadaRepository', () => {
  beforeEach(() => {
    clearMockJornadas();
  });

  it('persiste jornadas en memoria cuando Firebase no esta configurado', async () => {
    const repository = crearJornadaRepository({ isFirebaseConfigured: false });
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

    await repository.guardarJornada(jornada);

    expect(getMockJornadas()).toHaveLength(1);
    expect(getMockJornadas()[0]).toMatchObject({
      id: jornada.id,
      tenantId: 'tenant-1',
      estado: 'borrador',
    });
  });

  it('persiste jornada, ejecucion y auditoria en Firestore con rutas por tenant', async () => {
    const writes: Array<{ path: string[]; data: unknown; options?: unknown }> = [];
    const repository = crearJornadaRepository({
      isFirebaseConfigured: true,
      db: 'db-mock' as any,
      deps: {
        collection: (...path: any[]) => path,
        doc: (...path: any[]) => path,
        getDocs: async () => ({ docs: [] }),
        query: (...args: unknown[]) => args,
        setDoc: async (ref: string[], data: unknown, options?: unknown) => {
          writes.push({ path: ref, data, options });
        },
        where: (...args: unknown[]) => args,
      },
    });
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
    const ejecucion: EjecucionPrograma = {
      id: 'ejecucion-1',
      tenantId: 'tenant-1',
      programaId: 'programa-1',
      grupoId: 'grupo-infantil',
      sedeId: 'sede-principal',
      estado: 'activo',
      fechaInicio: '2026-06-27',
      unidadActualId: 'unidad-1',
      objetivoActualId: 'obj-1',
      objetivosCompletados: [],
      creadoEn: '2026-06-27T00:00:00.000Z',
      actualizadoEn: '2026-06-27T00:00:00.000Z',
    };

    await repository.guardarJornada(jornada);
    await repository.guardarEjecucion(ejecucion);
    await repository.registrarAuditoria({
      tenantId: 'tenant-1',
      jornadaId: jornada.id,
      usuarioId: 'maestro-1',
      rol: RolUsuario.Editor,
      fuente: 'jornadas',
      accion: 'confirmar',
      cambios: [{ campo: 'estado', anterior: 'borrador', nuevo: 'confirmada' }],
    });

    expect(writes.map((write) => write.path)).toEqual([
      ['db-mock', 'tenants', 'tenant-1', 'jornadas', jornada.id],
      ['db-mock', 'tenants', 'tenant-1', 'ejecucionesPrograma', 'ejecucion-1'],
      ['db-mock', 'tenants', 'tenant-1', 'jornadas', jornada.id, 'auditoria', expect.stringMatching(/^audit-/)],
    ]);
    // Subtarea 12.5: la auditoria debe guardar el rol de quien hizo el cambio y la
    // fuente (vista de origen), ademas del diff campo por campo con anterior/nuevo.
    expect(writes[2].data).toMatchObject({
      rol: RolUsuario.Editor,
      fuente: 'jornadas',
      cambios: [{ campo: 'estado', anterior: 'borrador', nuevo: 'confirmada' }],
    });
  });

  // Fix 3 (CIERRE CENTRO DE ESTUDIOS.md, subseccion "Fix: persistencia y seleccion de
  // Programa academico"): AsignacionesView necesita leer la EjecucionPrograma guardada de
  // un programa real hidratado para reconstruir horario/sede/instructor/fechas en vez de
  // dejarlos en blanco/default. `obtenerEjecucion` es opcional en la interfaz (no rompe los
  // fakes de test existentes que no lo implementan).
  describe('obtenerEjecucion', () => {
    const ejecucionBase: EjecucionPrograma = {
      id: 'ejecucion-programa-1',
      tenantId: 'tenant-1',
      programaId: 'programa-1',
      grupoId: 'grupo-infantil',
      sedeId: 'sede-principal',
      estado: 'activo',
      fechaInicio: '2026-07-01',
      fechaFin: '2026-09-30',
      unidadActualId: null,
      objetivoActualId: null,
      objetivosCompletados: [],
      creadoEn: '2026-06-27T00:00:00.000Z',
      actualizadoEn: '2026-06-27T00:00:00.000Z',
      bloques: [{
        id: 'bloque-1',
        tenantId: 'tenant-1',
        grupoId: 'grupo-infantil',
        sedeId: 'sede-principal',
        espacioId: 'tatami-1',
        instructorId: 'maestro-1',
        diaSemana: 2,
        horaInicio: '16:00',
        horaFin: '17:00',
        activo: true,
      }],
    };

    it('devuelve la ejecucion en memoria por id cuando Firebase no esta configurado', async () => {
      const repository = crearJornadaRepository({ isFirebaseConfigured: false });
      await repository.guardarEjecucion(ejecucionBase);

      const resultado = await repository.obtenerEjecucion!('tenant-1', 'ejecucion-programa-1');

      expect(resultado).toEqual(ejecucionBase);
    });

    it('devuelve null en memoria si no existe la ejecucion', async () => {
      const repository = crearJornadaRepository({ isFirebaseConfigured: false });

      const resultado = await repository.obtenerEjecucion!('tenant-1', 'ejecucion-inexistente');

      expect(resultado).toBeNull();
    });

    it('lee la ejecucion desde Firestore con la ruta por tenant', async () => {
      const repository = crearJornadaRepository({
        isFirebaseConfigured: true,
        db: 'db-mock' as any,
        deps: {
          doc: (...path: any[]) => path,
          getDoc: async (ref: any) => ({
            exists: () => true,
            data: () => ejecucionBase,
          }),
          setDoc: async () => {},
        },
      });

      const resultado = await repository.obtenerEjecucion!('tenant-1', 'ejecucion-programa-1');

      expect(resultado).toEqual(ejecucionBase);
    });

    it('devuelve null desde Firestore si el documento no existe', async () => {
      const repository = crearJornadaRepository({
        isFirebaseConfigured: true,
        db: 'db-mock' as any,
        deps: {
          doc: (...path: any[]) => path,
          getDoc: async () => ({ exists: () => false }),
          setDoc: async () => {},
        },
      });

      const resultado = await repository.obtenerEjecucion!('tenant-1', 'ejecucion-inexistente');

      expect(resultado).toBeNull();
    });
  });

  it('detecta conflicto local por misma sede, espacio, fecha y hora con otra jornada activa', async () => {
    const repository = crearJornadaRepository({ isFirebaseConfigured: false });
    const jornadaExistente = createJornada({
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
    const jornadaNueva = createJornada({
      tenantId: 'tenant-1',
      programaId: 'programa-2',
      ejecucionProgramaId: 'ejecucion-2',
      grupoId: 'grupo-precadetes',
      sedeId: 'sede-principal',
      espacioId: 'tatami-1',
      instructorId: 'maestro-2',
      fecha: '2026-06-27',
      horaInicio: '08:00',
      horaFin: '09:00',
      objetivosPlaneados: ['obj-2'],
    });

    await repository.guardarJornada({ ...jornadaExistente, estado: 'confirmada' });

    await expect(repository.existeConflictoHorario(jornadaNueva)).resolves.toEqual({
      hayConflicto: true,
      motivo: 'espacio',
    });
  });

  it('detecta conflicto local por solapamiento parcial de horario', async () => {
    const repository = crearJornadaRepository({ isFirebaseConfigured: false });
    const jornadaExistente = createJornada({
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
    const jornadaNueva = createJornada({
      tenantId: 'tenant-1',
      programaId: 'programa-2',
      ejecucionProgramaId: 'ejecucion-2',
      grupoId: 'grupo-precadetes',
      sedeId: 'sede-principal',
      espacioId: 'tatami-1',
      instructorId: 'maestro-2',
      fecha: '2026-06-27',
      horaInicio: '08:30',
      horaFin: '09:30',
      objetivosPlaneados: ['obj-2'],
    });

    await repository.guardarJornada({ ...jornadaExistente, estado: 'confirmada' });

    await expect(repository.existeConflictoHorario(jornadaNueva)).resolves.toEqual({
      hayConflicto: true,
      motivo: 'espacio',
    });
  });

  // Fix 2026-07-16 (bug real reportado por el usuario: la alta masiva de jornadas al
  // guardar un Programa academico -- AsignacionesView.tsx -- generaba TODA la agenda
  // semanal recurrente sin revisar contra jornadas existentes de OTRO programa. Version
  // en memoria de la MISMA logica pura que ya usa existeConflictoHorario, para poder
  // chequear un lote completo sin pagar una consulta a Firestore por cada jornada nueva.
  describe('detectarConflictosEnLote', () => {
    it('detecta conflicto de instructor entre una jornada nueva y una existente activa', () => {
      const existente = createJornada({
        tenantId: 'tenant-1',
        programaId: 'programa-1',
        ejecucionProgramaId: 'ejecucion-1',
        grupoId: 'grupo-infantil',
        sedeId: 'sede-a',
        espacioId: 'tatami-1',
        instructorId: 'maestro-1',
        fecha: '2026-07-06',
        horaInicio: '08:00',
        horaFin: '09:00',
        estadoInicial: 'confirmada',
        objetivosPlaneados: ['obj-1'],
      });
      const nueva = createJornada({
        tenantId: 'tenant-1',
        programaId: 'programa-2',
        ejecucionProgramaId: 'ejecucion-2',
        grupoId: 'grupo-precadetes',
        // Distinta sede/espacio a proposito -- el choque debe detectarse SOLO por
        // instructor, sin depender de que la sede tambien coincida.
        sedeId: 'sede-b',
        espacioId: 'tatami-2',
        instructorId: 'maestro-1',
        fecha: '2026-07-06',
        horaInicio: '08:00',
        horaFin: '09:00',
        objetivosPlaneados: ['obj-2'],
      });

      const conflictos = detectarConflictosEnLote([nueva], [existente]);

      expect(conflictos).toEqual([{ jornadaNueva: nueva, jornadaExistente: existente, motivo: 'instructor' }]);
    });

    it('detecta conflicto de sede+espacio entre una jornada nueva y una existente activa (distinto instructor)', () => {
      const existente = createJornada({
        tenantId: 'tenant-1',
        programaId: 'programa-1',
        ejecucionProgramaId: 'ejecucion-1',
        grupoId: 'grupo-infantil',
        sedeId: 'sede-a',
        espacioId: 'tatami-1',
        instructorId: 'maestro-1',
        fecha: '2026-07-06',
        horaInicio: '08:00',
        horaFin: '09:00',
        estadoInicial: 'confirmada',
        objetivosPlaneados: ['obj-1'],
      });
      const nueva = createJornada({
        tenantId: 'tenant-1',
        programaId: 'programa-2',
        ejecucionProgramaId: 'ejecucion-2',
        grupoId: 'grupo-precadetes',
        sedeId: 'sede-a',
        espacioId: 'tatami-1',
        instructorId: 'maestro-2',
        fecha: '2026-07-06',
        horaInicio: '08:30',
        horaFin: '09:30',
        objetivosPlaneados: ['obj-2'],
      });

      const conflictos = detectarConflictosEnLote([nueva], [existente]);

      expect(conflictos).toEqual([{ jornadaNueva: nueva, jornadaExistente: existente, motivo: 'espacio' }]);
    });

    it('no detecta conflicto si no hay solapamiento de horario, aunque coincidan instructor/sede/fecha', () => {
      const existente = createJornada({
        tenantId: 'tenant-1', programaId: 'p-1', ejecucionProgramaId: 'e-1', grupoId: 'grupo-infantil',
        sedeId: 'sede-a', espacioId: 'tatami-1', instructorId: 'maestro-1',
        fecha: '2026-07-06', horaInicio: '08:00', horaFin: '09:00', estadoInicial: 'confirmada', objetivosPlaneados: [],
      });
      const nueva = createJornada({
        tenantId: 'tenant-1', programaId: 'p-2', ejecucionProgramaId: 'e-2', grupoId: 'grupo-precadetes',
        sedeId: 'sede-a', espacioId: 'tatami-1', instructorId: 'maestro-1',
        fecha: '2026-07-06', horaInicio: '09:00', horaFin: '10:00', objetivosPlaneados: [],
      });

      expect(detectarConflictosEnLote([nueva], [existente])).toEqual([]);
    });

    it('ignora jornadas existentes en estado inactivo (borrador/cerrada/cancelada) -- mismo criterio que existeConflictoHorario', () => {
      const existenteBorrador = createJornada({
        tenantId: 'tenant-1', programaId: 'p-1', ejecucionProgramaId: 'e-1', grupoId: 'grupo-infantil',
        sedeId: 'sede-a', espacioId: 'tatami-1', instructorId: 'maestro-1',
        fecha: '2026-07-06', horaInicio: '08:00', horaFin: '09:00', estadoInicial: 'borrador', objetivosPlaneados: [],
      });
      const nueva = createJornada({
        tenantId: 'tenant-1', programaId: 'p-2', ejecucionProgramaId: 'e-2', grupoId: 'grupo-precadetes',
        sedeId: 'sede-a', espacioId: 'tatami-1', instructorId: 'maestro-1',
        fecha: '2026-07-06', horaInicio: '08:00', horaFin: '09:00', objetivosPlaneados: [],
      });

      expect(detectarConflictosEnLote([nueva], [existenteBorrador])).toEqual([]);
    });

    it('detecta un conflicto por cada jornada nueva que choque, dentro de un lote de varias', () => {
      const existente = createJornada({
        tenantId: 'tenant-1', programaId: 'p-1', ejecucionProgramaId: 'e-1', grupoId: 'grupo-infantil',
        sedeId: 'sede-a', espacioId: 'tatami-1', instructorId: 'maestro-1',
        fecha: '2026-07-06', horaInicio: '08:00', horaFin: '09:00', estadoInicial: 'confirmada', objetivosPlaneados: [],
      });
      const nuevaSinChoque = createJornada({
        tenantId: 'tenant-1', programaId: 'p-2', ejecucionProgramaId: 'e-2', grupoId: 'grupo-precadetes',
        sedeId: 'sede-a', espacioId: 'tatami-1', instructorId: 'maestro-1',
        fecha: '2026-07-13', horaInicio: '08:00', horaFin: '09:00', objetivosPlaneados: [],
      });
      const nuevaConChoque = createJornada({
        tenantId: 'tenant-1', programaId: 'p-2', ejecucionProgramaId: 'e-2', grupoId: 'grupo-precadetes',
        sedeId: 'sede-a', espacioId: 'tatami-1', instructorId: 'maestro-1',
        fecha: '2026-07-06', horaInicio: '08:00', horaFin: '09:00', objetivosPlaneados: [],
      });

      const conflictos = detectarConflictosEnLote([nuevaSinChoque, nuevaConChoque], [existente]);

      expect(conflictos).toEqual([{ jornadaNueva: nuevaConChoque, jornadaExistente: existente, motivo: 'instructor' }]);
    });
  });

  it('lista jornadas en memoria filtradas por tenant cuando Firebase no esta configurado', async () => {
    const repository = crearJornadaRepository({ isFirebaseConfigured: false });
    const jornadaTenant1 = createJornada({
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
    const jornadaOtroTenant = createJornada({
      tenantId: 'tenant-2',
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

    await repository.guardarJornada(jornadaTenant1);
    await repository.guardarJornada(jornadaOtroTenant);

    const resultado = await repository.listarJornadasPorTenant('tenant-1');

    expect(resultado).toHaveLength(1);
    expect(resultado[0].id).toBe(jornadaTenant1.id);
  });

  it('lista jornadas desde Firestore consultando la coleccion del tenant', async () => {
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
    const repository = crearJornadaRepository({
      isFirebaseConfigured: true,
      db: 'db-mock' as any,
      deps: {
        collection: (...path: any[]) => path,
        doc: (...path: any[]) => path,
        getDocs: async () => ({ docs: [{ id: jornada.id, data: () => jornada }] }),
        query: (...args: unknown[]) => args,
        setDoc: async () => {},
        where: (...args: unknown[]) => args,
      },
    });

    const resultado = await repository.listarJornadasPorTenant('tenant-1');

    expect(resultado).toEqual([jornada]);
  });

  // Subtarea 12.8 (Vista Agenda: parrilla semanal). `listarJornadasPorTenant` no filtra
  // por fecha (trae TODO el tenant) -- viola el requisito de rendimiento de la seccion 21
  // del documento de mejora ("Cargar solo la semana visible... usar filtros por tenant,
  // rango de fechas y estado"). `listarJornadasPorRangoFechas` es la funcion nueva que
  // consume la parrilla semanal para traer solo el rango Lunes-Domingo visible.
  describe('listarJornadasPorRangoFechas', () => {
    it('en memoria: filtra por tenant y por rango de fechas (ambos limites inclusive)', async () => {
      const repository = crearJornadaRepository({ isFirebaseConfigured: false });
      const dentroDelRango = createJornada({
        tenantId: 'tenant-1',
        programaId: 'programa-1',
        ejecucionProgramaId: 'ejecucion-1',
        grupoId: 'grupo-infantil',
        sedeId: 'sede-principal',
        espacioId: 'tatami-1',
        instructorId: 'maestro-1',
        fecha: '2026-07-08',
        horaInicio: '08:00',
        horaFin: '09:00',
        objetivosPlaneados: ['obj-1'],
      });
      const enElLimiteInicio = createJornada({
        tenantId: 'tenant-1',
        programaId: 'programa-1',
        ejecucionProgramaId: 'ejecucion-1',
        grupoId: 'grupo-infantil',
        sedeId: 'sede-principal',
        espacioId: 'tatami-1',
        instructorId: 'maestro-1',
        fecha: '2026-07-06',
        horaInicio: '08:00',
        horaFin: '09:00',
        objetivosPlaneados: ['obj-1'],
      });
      const fueraDelRango = createJornada({
        tenantId: 'tenant-1',
        programaId: 'programa-1',
        ejecucionProgramaId: 'ejecucion-1',
        grupoId: 'grupo-infantil',
        sedeId: 'sede-principal',
        espacioId: 'tatami-1',
        instructorId: 'maestro-1',
        fecha: '2026-07-13',
        horaInicio: '08:00',
        horaFin: '09:00',
        objetivosPlaneados: ['obj-1'],
      });
      const deOtroTenant = createJornada({
        tenantId: 'tenant-2',
        programaId: 'programa-1',
        ejecucionProgramaId: 'ejecucion-1',
        grupoId: 'grupo-infantil',
        sedeId: 'sede-principal',
        espacioId: 'tatami-1',
        instructorId: 'maestro-1',
        fecha: '2026-07-08',
        horaInicio: '08:00',
        horaFin: '09:00',
        objetivosPlaneados: ['obj-1'],
      });

      await repository.guardarJornada(dentroDelRango);
      await repository.guardarJornada(enElLimiteInicio);
      await repository.guardarJornada(fueraDelRango);
      await repository.guardarJornada(deOtroTenant);

      const resultado = await repository.listarJornadasPorRangoFechas('tenant-1', '2026-07-06', '2026-07-12');

      expect(resultado.map((jornada) => jornada.id).sort()).toEqual(
        [dentroDelRango.id, enElLimiteInicio.id].sort(),
      );
    });

    it('en Firestore: consulta la coleccion del tenant filtrando por fecha >= inicio y fecha <= fin', async () => {
      const queryArgs: any[] = [];
      const jornada = createJornada({
        tenantId: 'tenant-1',
        programaId: 'programa-1',
        ejecucionProgramaId: 'ejecucion-1',
        grupoId: 'grupo-infantil',
        sedeId: 'sede-principal',
        espacioId: 'tatami-1',
        instructorId: 'maestro-1',
        fecha: '2026-07-08',
        horaInicio: '08:00',
        horaFin: '09:00',
        objetivosPlaneados: ['obj-1'],
      });
      const repository = crearJornadaRepository({
        isFirebaseConfigured: true,
        db: 'db-mock' as any,
        deps: {
          collection: (...path: any[]) => path,
          doc: (...path: any[]) => path,
          getDocs: async () => ({ docs: [{ id: jornada.id, data: () => jornada }] }),
          query: (...args: any[]) => {
            queryArgs.push(args);
            return args;
          },
          setDoc: async () => {},
          where: (...args: any[]) => args,
        },
      });

      const resultado = await repository.listarJornadasPorRangoFechas('tenant-1', '2026-07-06', '2026-07-12');

      expect(resultado).toEqual([jornada]);
      expect(queryArgs[0]).toContainEqual(['fecha', '>=', '2026-07-06']);
      expect(queryArgs[0]).toContainEqual(['fecha', '<=', '2026-07-12']);
    });

    it('en Firestore: devuelve [] si las deps de consulta no estan disponibles', async () => {
      const repository = crearJornadaRepository({
        isFirebaseConfigured: true,
        db: 'db-mock' as any,
        deps: {
          doc: (...path: any[]) => path,
          setDoc: async () => {},
        },
      });

      const resultado = await repository.listarJornadasPorRangoFechas('tenant-1', '2026-07-06', '2026-07-12');

      expect(resultado).toEqual([]);
    });
  });

  it('guarda jornadas en memoria cuando Firebase no esta configurado', async () => {
    const repository = crearJornadaRepository({ isFirebaseConfigured: false });
    const jornadas = Array.from({ length: 5 }, (_, indice) => crearJornadaDeLote(indice));

    await repository.guardarJornadasEnLote(jornadas);

    expect(getMockJornadas()).toHaveLength(5);
  });

  it('trocea el guardado en lotes de maximo 400 al persistir en Firestore', async () => {
    const commits: number[] = [];
    const sets: Array<{ ref: unknown; data: unknown }> = [];
    const repository = crearJornadaRepository({
      isFirebaseConfigured: true,
      db: 'db-mock' as any,
      deps: {
        collection: (...path: any[]) => path,
        doc: (...path: any[]) => path,
        getDocs: async () => ({ docs: [] }),
        query: (...args: unknown[]) => args,
        setDoc: async () => {},
        where: (...args: unknown[]) => args,
        writeBatch: () => {
          const pendientes: Array<{ ref: unknown; data: unknown }> = [];
          return {
            set: (ref: unknown, data: unknown) => {
              pendientes.push({ ref, data });
              sets.push({ ref, data });
            },
            // Fix 2026-07-21 (`npm run typecheck`): faltaba `delete`, miembro obligatorio de
            // FirestoreBatchLike. Este caso solo ejercita `set`+`commit` (guardado en lote),
            // asi que el metodo queda como no-op.
            delete: () => {},
            commit: async () => {
              commits.push(pendientes.length);
            },
          };
        },
      },
    });
    const jornadas = Array.from({ length: 900 }, (_, indice) => crearJornadaDeLote(indice));

    await repository.guardarJornadasEnLote(jornadas);

    expect(commits).toEqual([400, 400, 100]);
    expect(sets).toHaveLength(900);
  });

  it('actualizarTemaJornada lanza si la jornada no existe en Firestore', async () => {
    const repository = crearJornadaRepository({
      isFirebaseConfigured: true,
      db: 'db-mock' as any,
      deps: {
        doc: (...path: any[]) => path,
        getDoc: async () => ({ exists: () => false }),
        setDoc: async () => {},
      },
    });

    await expect(
      repository.actualizarTemaJornada('tenant-1', 'jornada-inexistente', 'Formas basicas')
    ).rejects.toThrow(/no encontrada/i);
  });

  it('actualizarTemaJornada persiste el tema con merge cuando la jornada existe en Firestore', async () => {
    const writes: Array<{ path: unknown[]; data: unknown; options?: unknown }> = [];
    const repository = crearJornadaRepository({
      isFirebaseConfigured: true,
      db: 'db-mock' as any,
      deps: {
        doc: (...path: any[]) => path,
        getDoc: async () => ({ exists: () => true }),
        setDoc: async (ref: unknown[], data: unknown, options?: unknown) => {
          writes.push({ path: ref, data, options });
        },
      },
    });

    await repository.actualizarTemaJornada('tenant-1', 'jornada-1', 'Formas basicas');

    expect(writes).toEqual([
      {
        path: ['db-mock', 'tenants', 'tenant-1', 'jornadas', 'jornada-1'],
        data: expect.objectContaining({ tema: 'Formas basicas' }),
        options: { merge: true },
      },
    ]);
  });

  it('actualizarTemaJornada lanza si la jornada no existe en memoria cuando Firebase no esta configurado', async () => {
    const repository = crearJornadaRepository({ isFirebaseConfigured: false });

    await expect(
      repository.actualizarTemaJornada('tenant-1', 'jornada-inexistente', 'Formas basicas')
    ).rejects.toThrow(/no encontrada/i);
  });

  it('actualizarTemaJornada actualiza el tema en memoria cuando Firebase no esta configurado', async () => {
    const repository = crearJornadaRepository({ isFirebaseConfigured: false });
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
    await repository.guardarJornada(jornada);

    await repository.actualizarTemaJornada('tenant-1', jornada.id, 'Formas basicas');

    expect(getMockJornadas()[0]).toMatchObject({ id: jornada.id, tema: 'Formas basicas' });
  });

  it('detecta conflicto por instructor ocupado en otra sede/espacio en el mismo horario', async () => {
    const repository = crearJornadaRepository({ isFirebaseConfigured: false });
    const jornadaExistente = createJornada({
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
    const jornadaNueva = createJornada({
      tenantId: 'tenant-1',
      programaId: 'programa-2',
      ejecucionProgramaId: 'ejecucion-2',
      grupoId: 'grupo-precadetes',
      sedeId: 'sede-norte', // Otra Sede
      espacioId: 'tatami-2', // Otro Espacio
      instructorId: 'maestro-1', // Mismo Instructor!
      fecha: '2026-06-27',
      horaInicio: '08:30', // Se cruzan
      horaFin: '09:30',
      objetivosPlaneados: ['obj-2'],
    });

    await repository.guardarJornada({ ...jornadaExistente, estado: 'confirmada' });

    await expect(repository.existeConflictoHorario(jornadaNueva)).resolves.toEqual({
      hayConflicto: true,
      motivo: 'instructor',
    });
  });

  it('detecta conflicto de instructor en otra sede/espacio simulando el filtrado real de Firestore', async () => {
    const queryArgs: any[] = [];
    const dbJornada = createJornada({
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
    dbJornada.estado = 'confirmada';
    const dataset = [dbJornada];

    const repository = crearJornadaRepository({
      isFirebaseConfigured: true,
      db: 'db-mock' as any,
      deps: {
        collection: (...path: any[]) => path,
        doc: (...path: any[]) => path,
        // getDocs simula Firestore de verdad: aplica cada filtro where de igualdad al dataset.
        // Con el bug (query por sedeId+espacioId), la jornada del mismo maestro en otra sede
        // nunca llega a memoria y el choque queda sin detectar (falso negativo).
        getDocs: async (consulta: any[]) => {
          // consulta[0] es la referencia a la coleccion (tambien un array, por el mock de
          // `collection`); los filtros where() son el resto de los argumentos de query().
          const [, ...filtros] = consulta as Array<[string, string, unknown]>;
          const docs = dataset
            .filter((jornada) => filtros.every(([campo, , valor]) => (jornada as any)[campo] === valor))
            .map((jornada) => ({ id: jornada.id, data: () => jornada }));
          return { docs };
        },
        query: (...args: any[]) => {
          queryArgs.push(args);
          return args;
        },
        setDoc: async () => {},
        where: (...args: any[]) => args,
      },
    });

    const jornadaNueva = createJornada({
      tenantId: 'tenant-1',
      programaId: 'programa-2',
      ejecucionProgramaId: 'ejecucion-2',
      grupoId: 'grupo-precadetes',
      sedeId: 'sede-norte',
      espacioId: 'tatami-2',
      instructorId: 'maestro-1',
      fecha: '2026-06-27',
      horaInicio: '08:30',
      horaFin: '09:30',
      objetivosPlaneados: ['obj-2'],
    });

    const resultado = await repository.existeConflictoHorario(jornadaNueva);
    expect(resultado).toEqual({ hayConflicto: true, motivo: 'instructor' });
    // La consulta NO debe filtrar por sede ni espacio: si lo hiciera, perderia
    // los choques del mismo maestro en otra sede. Solo debe filtrar por fecha.
    expect(queryArgs[0]).toContainEqual(['fecha', '==', '2026-06-27']);
    expect(queryArgs[0]).not.toContainEqual(['sedeId', '==', 'sede-norte']);
    expect(queryArgs[0]).not.toContainEqual(['espacioId', '==', 'tatami-2']);
  });

  it('no detecta conflicto cuando instructor, sede y espacio son todos distintos', async () => {
    const repository = crearJornadaRepository({ isFirebaseConfigured: false });
    const jornadaExistente = createJornada({
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
    const jornadaNueva = createJornada({
      tenantId: 'tenant-1',
      programaId: 'programa-2',
      ejecucionProgramaId: 'ejecucion-2',
      grupoId: 'grupo-precadetes',
      sedeId: 'sede-norte',
      espacioId: 'tatami-2',
      instructorId: 'maestro-2',
      fecha: '2026-06-27',
      horaInicio: '08:00',
      horaFin: '09:00',
      objetivosPlaneados: ['obj-2'],
    });

    await repository.guardarJornada({ ...jornadaExistente, estado: 'confirmada' });

    await expect(repository.existeConflictoHorario(jornadaNueva)).resolves.toEqual({ hayConflicto: false });
  });

  it('elimina jornadas en memoria cuando Firebase no esta configurado', async () => {
    const repository = crearJornadaRepository({ isFirebaseConfigured: false });
    const j1 = crearJornadaDeLote(1);
    const j2 = crearJornadaDeLote(2);
    await repository.guardarJornada(j1);
    await repository.guardarJornada(j2);

    expect(getMockJornadas()).toHaveLength(2);

    await repository.eliminarJornadasEnLote('tenant-1', [j1.id]);
    expect(getMockJornadas()).toHaveLength(1);
    expect(getMockJornadas()[0].id).toBe(j2.id);
  });

  it('elimina jornadas en lotes en Firestore usando batch.delete', async () => {
    const deletes: string[][] = [];
    const repository = crearJornadaRepository({
      isFirebaseConfigured: true,
      db: 'db-mock' as any,
      deps: {
        doc: (...path: any[]) => path,
        // Fix 2026-07-21 (`npm run typecheck`): faltaba `setDoc`, miembro OBLIGATORIO de
        // JornadaRepositoryDeps. Este caso solo ejercita el borrado en lote, asi que se
        // declara como no-op para cumplir el contrato sin cambiar lo que el test verifica.
        setDoc: async () => {},
        writeBatch: () => {
          const pendientes: string[][] = [];
          return {
            set: () => {},
            delete: (ref: string[]) => {
              pendientes.push(ref);
              deletes.push(ref);
            },
            commit: async () => {},
          };
        },
      },
    });

    await repository.eliminarJornadasEnLote('tenant-1', ['jornada-1', 'jornada-2']);

    expect(deletes).toEqual([
      ['db-mock', 'tenants', 'tenant-1', 'jornadas', 'jornada-1'],
      ['db-mock', 'tenants', 'tenant-1', 'jornadas', 'jornada-2'],
    ]);
  });
});

// Subtarea 12.6: guardas de eliminacion/desactivacion segura (seccion 8 del documento de
// mejora del modulo Agenda). NO se puede borrar FISICAMENTE una jornada que ya se opero
// realmente (asistencia registrada o estado operado): perderia trazabilidad historica; para
// esas jornadas solo se permite el camino soft (cancelarJornada). El borrado fisico se
// canaliza por eliminarJornadaSegura, que aplica la guarda antes de tocar Firestore.
describe('guardas de eliminacion segura (12.6)', () => {
  beforeEach(() => {
    clearMockJornadas();
  });

  const jornadaBase = () => crearJornadaDeLote(1);

  describe('evaluarEliminacionSegura', () => {
    it('permite borrar una jornada nunca operada (borrador, sin asistencia)', () => {
      const jornada = { ...jornadaBase(), estado: 'borrador' as const, asistenciaRegistrada: false };
      expect(evaluarEliminacionSegura(jornada)).toEqual({ permitido: true });
      expect(esJornadaOperada(jornada)).toBe(false);
    });

    it.each(['confirmada', 'cancelada', 'reprogramada', 'pendiente_confirmacion', 'pendiente_sustitucion'] as const)(
      'permite borrar una jornada en estado no operado: %s',
      (estado) => {
        const jornada = { ...jornadaBase(), estado, asistenciaRegistrada: false };
        expect(evaluarEliminacionSegura(jornada).permitido).toBe(true);
      },
    );

    it('bloquea el borrado si la jornada tiene asistencia registrada', () => {
      const jornada = { ...jornadaBase(), estado: 'confirmada' as const, asistenciaRegistrada: true };
      expect(evaluarEliminacionSegura(jornada)).toEqual({ permitido: false, motivo: 'asistencia_registrada' });
      expect(esJornadaOperada(jornada)).toBe(true);
    });

    it.each(['en_curso', 'pendiente_cierre', 'cerrada', 'parcial'] as const)(
      'bloquea el borrado de una jornada ya operada en Clase en Vivo: %s',
      (estado) => {
        const jornada = { ...jornadaBase(), estado, asistenciaRegistrada: false };
        expect(evaluarEliminacionSegura(jornada)).toEqual({ permitido: false, motivo: 'clase_operada' });
        expect(esJornadaOperada(jornada)).toBe(true);
      },
    );

    it('prioriza asistencia_registrada sobre clase_operada cuando ambas condiciones aplican', () => {
      const jornada = { ...jornadaBase(), estado: 'cerrada' as const, asistenciaRegistrada: true };
      expect(evaluarEliminacionSegura(jornada).motivo).toBe('asistencia_registrada');
    });

    it('expone un mensaje de negocio por cada motivo de bloqueo', () => {
      expect(MENSAJE_ELIMINACION_NO_PERMITIDA.asistencia_registrada).toMatch(/asistencia/i);
      expect(MENSAJE_ELIMINACION_NO_PERMITIDA.clase_operada).toMatch(/Clase en Vivo/i);
    });
  });

  describe('eliminarJornadaSegura', () => {
    it('borra fisicamente una jornada segura en memoria', async () => {
      const repository = crearJornadaRepository({ isFirebaseConfigured: false });
      const jornada = { ...jornadaBase(), estado: 'borrador' as const, asistenciaRegistrada: false };
      await repository.guardarJornada(jornada);
      expect(getMockJornadas()).toHaveLength(1);

      await repository.eliminarJornadaSegura(jornada);

      expect(getMockJornadas()).toHaveLength(0);
    });

    it('lanza EliminacionNoPermitidaError y NO borra una jornada con asistencia registrada', async () => {
      const repository = crearJornadaRepository({ isFirebaseConfigured: false });
      const jornada = { ...jornadaBase(), estado: 'confirmada' as const, asistenciaRegistrada: true };
      await repository.guardarJornada(jornada);

      await expect(repository.eliminarJornadaSegura(jornada)).rejects.toBeInstanceOf(EliminacionNoPermitidaError);
      expect(getMockJornadas()).toHaveLength(1);
    });

    it('lanza EliminacionNoPermitidaError con motivo clase_operada para una jornada en_curso', async () => {
      const repository = crearJornadaRepository({ isFirebaseConfigured: false });
      const jornada = { ...jornadaBase(), estado: 'en_curso' as const, asistenciaRegistrada: false };
      await repository.guardarJornada(jornada);

      await expect(repository.eliminarJornadaSegura(jornada)).rejects.toMatchObject({
        name: 'EliminacionNoPermitidaError',
        motivo: 'clase_operada',
      });
      expect(getMockJornadas()).toHaveLength(1);
    });

    it('en Firestore, una jornada operada nunca llega a batch.delete', async () => {
      const deletes: string[][] = [];
      const repository = crearJornadaRepository({
        isFirebaseConfigured: true,
        db: 'db-mock' as any,
        deps: {
          doc: (...path: any[]) => path,
          writeBatch: () => ({
            set: () => {},
            delete: (ref: string[]) => { deletes.push(ref); },
            commit: async () => {},
          }),
        } as any,
      });
      const jornada = { ...jornadaBase(), estado: 'cerrada' as const, asistenciaRegistrada: true };

      await expect(repository.eliminarJornadaSegura(jornada)).rejects.toBeInstanceOf(EliminacionNoPermitidaError);
      expect(deletes).toEqual([]);
    });

    it('en Firestore, una jornada segura llega a batch.delete con la ruta por tenant', async () => {
      const deletes: string[][] = [];
      const repository = crearJornadaRepository({
        isFirebaseConfigured: true,
        db: 'db-mock' as any,
        deps: {
          doc: (...path: any[]) => path,
          writeBatch: () => ({
            set: () => {},
            delete: (ref: string[]) => { deletes.push(ref); },
            commit: async () => {},
          }),
        } as any,
      });
      const jornada = { ...jornadaBase(), id: 'jornada-safe', tenantId: 'tenant-1', estado: 'confirmada' as const, asistenciaRegistrada: false };

      await repository.eliminarJornadaSegura(jornada);

      expect(deletes).toEqual([['db-mock', 'tenants', 'tenant-1', 'jornadas', 'jornada-safe']]);
    });
  });

  // Caracterizacion del gap que motiva 12.6: eliminarJornadasEnLote sigue siendo una
  // PRIMITIVA de hard delete SIN guardas (limpieza de previews de AsignacionesView). Este
  // test documenta por que 12.6 introduce eliminarJornadaSegura en vez de reutilizar esta
  // funcion para el futuro flujo de "eliminar clase" de Agenda (12.9).
  it('eliminarJornadasEnLote NO valida y borra hasta una jornada operada (primitiva de previews)', async () => {
    const repository = crearJornadaRepository({ isFirebaseConfigured: false });
    const jornada = { ...jornadaBase(), estado: 'cerrada' as const, asistenciaRegistrada: true };
    await repository.guardarJornada(jornada);

    await repository.eliminarJornadasEnLote('tenant-1', [jornada.id]);

    expect(getMockJornadas()).toHaveLength(0);
  });
});

// Subtarea 12.3: mensajes de error especificos por campo (instructor vs. espacio) en vez
// de un unico mensaje generico de "conflicto de horario".
describe('mensajeConflictoHorario', () => {
  const jornada = createJornada({
    tenantId: 'tenant-1',
    programaId: 'programa-1',
    ejecucionProgramaId: 'ejecucion-1',
    grupoId: 'grupo-infantil',
    sedeId: 'sede-principal',
    espacioId: 'tatami-1',
    instructorId: 'maestro-1',
    fecha: '2026-06-27',
    horaInicio: '16:00',
    horaFin: '17:00',
    objetivosPlaneados: ['obj-1'],
  });

  it('devuelve el mensaje de maestro ocupado cuando el motivo es instructor', () => {
    expect(mensajeConflictoHorario({ hayConflicto: true, motivo: 'instructor' }, jornada)).toBe(
      'El maestro ya tiene una clase asignada en este horario.'
    );
  });

  it('devuelve el mensaje de sede no disponible con el rango horario cuando el motivo es espacio', () => {
    expect(mensajeConflictoHorario({ hayConflicto: true, motivo: 'espacio' }, jornada)).toBe(
      'La sede seleccionada no esta disponible entre 16:00 y 17:00.'
    );
  });

  it('devuelve un mensaje generico si hay conflicto sin motivo especifico', () => {
    expect(mensajeConflictoHorario({ hayConflicto: true }, jornada)).toBe(
      'Ya existe una jornada confirmada en esa sede, espacio y horario.'
    );
  });
});

// Subtarea 12.4: bloqueo optimista. Si dos usuarios editan la misma jornada y uno graba
// primero, el segundo no debe pisar el cambio en silencio: guardarJornada compara el
// actualizadoEn que la vista tenia al leer contra el actualizadoEn actual en Firestore.
describe('jornadaRepository - concurrencia optimista', () => {
  beforeEach(() => {
    clearMockJornadas();
  });

  const T1 = '2026-07-08T10:00:00.000Z'; // version leida por la vista
  const T2 = '2026-07-08T10:05:00.000Z'; // otro usuario grabo despues (> T1)

  function jornadaConActualizadoEn(actualizadoEn: string): JornadaInstruccion {
    return {
      ...createJornada({
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
      }),
      id: 'jornada-1',
      actualizadoEn,
    };
  }

  it('rechaza con ConflictoConcurrenciaError y NO escribe si actualizadoEn cambio en Firestore entre lectura y escritura', async () => {
    const writes: Array<{ data: unknown }> = [];
    const repository = crearJornadaRepository({
      isFirebaseConfigured: true,
      db: 'db-mock' as any,
      deps: {
        doc: (...path: any[]) => path,
        // El documento vivo en Firestore ya fue grabado por otro usuario (T2 > T1).
        getDoc: async () => ({ exists: () => true, data: () => ({ actualizadoEn: T2 }) }),
        setDoc: async (_ref: unknown, data: unknown) => {
          writes.push({ data });
        },
      },
    });

    // La vista construyo su edicion sobre la copia vieja (base T1) y le puso su propio
    // actualizadoEn nuevo; el que importa para el lock es el base (T1) que leyo.
    const edicionSobreCopiaVieja = { ...jornadaConActualizadoEn('2026-07-08T10:06:00.000Z'), tema: 'Tema del segundo usuario' };

    await expect(
      repository.guardarJornada(edicionSobreCopiaVieja, { actualizadoEnEsperado: T1 }),
    ).rejects.toThrow(ConflictoConcurrenciaError);
    expect(writes).toHaveLength(0);
  });

  it('el mensaje del error es el sugerido por el documento de negocio', async () => {
    const repository = crearJornadaRepository({
      isFirebaseConfigured: true,
      db: 'db-mock' as any,
      deps: {
        doc: (...path: any[]) => path,
        getDoc: async () => ({ exists: () => true, data: () => ({ actualizadoEn: T2 }) }),
        setDoc: async () => {},
      },
    });

    await expect(
      repository.guardarJornada(jornadaConActualizadoEn('T3'), { actualizadoEnEsperado: T1 }),
    ).rejects.toThrow(MENSAJE_CONFLICTO_CONCURRENCIA);
  });

  it('escribe normalmente cuando el actualizadoEn en Firestore coincide con el leido por la vista', async () => {
    const writes: Array<{ data: unknown }> = [];
    const repository = crearJornadaRepository({
      isFirebaseConfigured: true,
      db: 'db-mock' as any,
      deps: {
        doc: (...path: any[]) => path,
        getDoc: async () => ({ exists: () => true, data: () => ({ actualizadoEn: T1 }) }),
        setDoc: async (_ref: unknown, data: unknown) => {
          writes.push({ data });
        },
      },
    });

    await repository.guardarJornada(jornadaConActualizadoEn('nuevo'), { actualizadoEnEsperado: T1 });

    expect(writes).toHaveLength(1);
  });

  it('permite crear la jornada cuando el documento aun no existe en Firestore (primer guardado)', async () => {
    const writes: Array<{ data: unknown }> = [];
    const repository = crearJornadaRepository({
      isFirebaseConfigured: true,
      db: 'db-mock' as any,
      deps: {
        doc: (...path: any[]) => path,
        getDoc: async () => ({ exists: () => false }),
        setDoc: async (_ref: unknown, data: unknown) => {
          writes.push({ data });
        },
      },
    });

    await repository.guardarJornada(jornadaConActualizadoEn('nuevo'), { actualizadoEnEsperado: T1 });

    expect(writes).toHaveLength(1);
  });

  it('sin actualizadoEnEsperado no consulta el documento ni bloquea (retrocompatible)', async () => {
    let getDocCalls = 0;
    const writes: Array<{ data: unknown }> = [];
    const repository = crearJornadaRepository({
      isFirebaseConfigured: true,
      db: 'db-mock' as any,
      deps: {
        doc: (...path: any[]) => path,
        getDoc: async () => {
          getDocCalls += 1;
          return { exists: () => true, data: () => ({ actualizadoEn: T2 }) };
        },
        setDoc: async (_ref: unknown, data: unknown) => {
          writes.push({ data });
        },
      },
    });

    await repository.guardarJornada(jornadaConActualizadoEn('nuevo'));

    expect(getDocCalls).toBe(0);
    expect(writes).toHaveLength(1);
  });

  it('bloquea en memoria (Firebase no configurado) si la version guardada difiere de la base', async () => {
    const repository = crearJornadaRepository({ isFirebaseConfigured: false });
    const original = jornadaConActualizadoEn(T1);
    await repository.guardarJornada(original); // linea base sin lock
    // Otro proceso graba una version mas nueva (T2).
    await repository.guardarJornada({ ...original, actualizadoEn: T2, tema: 'otro usuario' });

    // La vista intenta guardar con base T1, que ya quedo viejo.
    await expect(
      repository.guardarJornada({ ...original, actualizadoEn: '2026-07-08T10:07:00.000Z' }, { actualizadoEnEsperado: T1 }),
    ).rejects.toThrow(ConflictoConcurrenciaError);
    expect(getMockJornadas()[0].tema).toBe('otro usuario');
  });
});

// Subtarea 12.5: auditoria completa por cambio. El diagnostico (12.1) encontro que
// `cambios` solo guardaba el estado resultante, sin valor anterior, y sin rol ni fuente
// del cambio. `diffCambiosJornada` es el helper puro que compara jornada antes/despues
// de una operacion y devuelve solo los campos que efectivamente cambiaron.
describe('diffCambiosJornada', () => {
  const base = createJornada({
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

  it('devuelve un array vacio si no hay diferencias entre anterior y nueva', () => {
    expect(diffCambiosJornada(base, { ...base })).toEqual([]);
  });

  it('devuelve solo los campos que cambiaron, con su valor anterior y nuevo', () => {
    const nueva: JornadaInstruccion = { ...base, estado: 'confirmada' };

    expect(diffCambiosJornada(base, nueva)).toEqual([
      { campo: 'estado', anterior: 'borrador', nuevo: 'confirmada' },
    ]);
  });

  it('detecta varios campos modificados a la vez y preserva el valor anterior de cada uno', () => {
    const nueva: JornadaInstruccion = {
      ...base,
      estado: 'cancelada',
      motivoCancelacion: 'Feriado nacional',
    };

    expect(diffCambiosJornada(base, nueva)).toEqual([
      { campo: 'estado', anterior: 'borrador', nuevo: 'cancelada' },
      { campo: 'motivoCancelacion', anterior: undefined, nuevo: 'Feriado nacional' },
    ]);
  });

  it('detecta cambios en campos array (objetivosImpartidos) comparando por contenido, no por referencia', () => {
    const nueva: JornadaInstruccion = { ...base, objetivosImpartidos: ['obj-1'] };

    expect(diffCambiosJornada(base, nueva)).toEqual([
      { campo: 'objetivosImpartidos', anterior: [], nuevo: ['obj-1'] },
    ]);
    // Mismo contenido, distinta referencia -> NO debe reportarse como cambio.
    expect(diffCambiosJornada(base, { ...base, objetivosPlaneados: [...base.objetivosPlaneados] })).toEqual([]);
  });

  it('no incluye id, tenantId, creadoEn ni actualizadoEn aunque difieran (bookkeeping, no "cambios")', () => {
    const nueva: JornadaInstruccion = {
      ...base,
      id: 'otro-id',
      tenantId: 'otro-tenant',
      creadoEn: '2026-01-01T00:00:00.000Z',
      actualizadoEn: '2026-01-02T00:00:00.000Z',
    };

    expect(diffCambiosJornada(base, nueva)).toEqual([]);
  });
});

// Subtarea 12.5: el fallo de auditoria ya no debe ser un console.warn silencioso — las
// vistas deben mostrar este mensaje al usuario aunque el guardado principal si se aplique
// (ver "Registro de cierre" de 12.5 en CIERRE CENTRO DE ESTUDIOS.md para el motivo).
describe('MENSAJE_ADVERTENCIA_AUDITORIA', () => {
  it('es un texto no vacio pensado para mostrarse al usuario', () => {
    expect(typeof MENSAJE_ADVERTENCIA_AUDITORIA).toBe('string');
    expect(MENSAJE_ADVERTENCIA_AUDITORIA.length).toBeGreaterThan(0);
  });
});
