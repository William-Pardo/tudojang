import { validarConfirmacionJornada } from './confirmJornada';
import type { JornadaInstruccion } from '../../models/academico/jornada';

const jornadaBase: JornadaInstruccion = {
  id: 'jornada-1',
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
  estado: 'borrador',
  objetivosPlaneados: ['obj-1'],
  objetivosImpartidos: [],
  asistenciaRegistrada: false,
  creadoEn: '2026-06-27T00:00:00.000Z',
  actualizadoEn: '2026-06-27T00:00:00.000Z',
};

const contextoBase = {
  tenantId: 'tenant-1',
  sedesPermitidasInstructor: ['sede-principal'],
  capacidadEspacio: 20,
  totalEstudiantesGrupo: 12,
  disciplinasEspacio: ['taekwondo'],
  disciplinaJornada: 'taekwondo',
  reservas: [],
  jornadasInstructor: [],
  jornadasGrupo: [],
};

describe('confirmJornada', () => {
  it('aprueba una jornada sin conflictos', () => {
    expect(validarConfirmacionJornada(jornadaBase, contextoBase)).toEqual({
      ok: true,
      errores: [],
    });
  });

  it('rechaza tenant incorrecto', () => {
    const resultado = validarConfirmacionJornada(jornadaBase, {
      ...contextoBase,
      tenantId: 'otro-tenant',
    });

    expect(resultado.ok).toBe(false);
    expect(resultado.errores).toContain('tenant_invalido');
  });

  it('rechaza instructor sin autorizacion para la sede', () => {
    const resultado = validarConfirmacionJornada(jornadaBase, {
      ...contextoBase,
      sedesPermitidasInstructor: ['otra-sede'],
    });

    expect(resultado.errores).toContain('instructor_no_autorizado_sede');
  });

  it('rechaza capacidad insuficiente del espacio', () => {
    const resultado = validarConfirmacionJornada(jornadaBase, {
      ...contextoBase,
      capacidadEspacio: 8,
    });

    expect(resultado.errores).toContain('capacidad_insuficiente');
  });

  it('rechaza incompatibilidad disciplina-espacio', () => {
    const resultado = validarConfirmacionJornada(jornadaBase, {
      ...contextoBase,
      disciplinasEspacio: ['yoga'],
    });

    expect(resultado.errores).toContain('disciplina_no_compatible');
  });

  it('rechaza cruce de espacio, instructor y grupo', () => {
    const reserva = {
      id: 'reserva-1',
      espacioId: 'tatami-1',
      fecha: '2026-06-27',
      horaInicio: '08:30',
      horaFin: '09:30',
      referenciaId: 'jornada-previa',
    };

    const jornadaCruzada = {
      ...jornadaBase,
      id: 'jornada-previa',
    };

    const resultado = validarConfirmacionJornada(jornadaBase, {
      ...contextoBase,
      reservas: [reserva],
      jornadasInstructor: [jornadaCruzada],
      jornadasGrupo: [jornadaCruzada],
    });

    expect(resultado.errores).toEqual(expect.arrayContaining([
      'espacio_no_disponible',
      'instructor_no_disponible',
      'grupo_no_disponible',
    ]));
  });
});
