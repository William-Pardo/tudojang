import { cerrarJornadaConPrograma } from './closeJornada';
import { createJornada, iniciarJornada, confirmarJornada, marcarPendienteCierre } from './jornadaService';
import { assignProgramaToGrupo, createPrograma, publishPrograma } from './programaService';

const programa = publishPrograma(createPrograma({
  tenantId: 'tenant-1',
  nombre: 'Programa base',
  descripcion: 'Fundamentos',
  unidades: [
    {
      id: 'unidad-1',
      nombre: 'Fundamentos',
      orden: 1,
      objetivos: [
        { id: 'obj-1', descripcion: 'Saludo', orden: 1 },
        { id: 'obj-2', descripcion: 'Patada', orden: 2 },
      ],
    },
  ],
}));

describe('closeJornada', () => {
  it('cierra jornada completa y avanza ciclo del programa', () => {
    const ejecucion = assignProgramaToGrupo(programa, {
      grupoId: 'grupo-infantil',
      sedeId: 'sede-principal',
      fechaInicio: '2026-06-27',
    });
    const jornada = crearJornadaPendienteCierre(true, ['obj-1']);

    const resultado = cerrarJornadaConPrograma({
      jornada,
      programa,
      ejecucion,
    });

    expect(resultado.jornada.estado).toBe('cerrada');
    expect(resultado.ejecucion.objetivosCompletados).toEqual(['obj-1']);
    expect(resultado.ejecucion.objetivoActualId).toBe('obj-2');
    expect(resultado.refuerzoRequerido).toBe(false);
  });

  it('soporta cierre parcial marcando refuerzo requerido sin avanzar objetivos no impartidos', () => {
    const ejecucion = assignProgramaToGrupo(programa, {
      grupoId: 'grupo-infantil',
      sedeId: 'sede-principal',
      fechaInicio: '2026-06-27',
    });
    const jornada = crearJornadaPendienteCierre(true, ['obj-1']);

    const resultado = cerrarJornadaConPrograma({
      jornada: { ...jornada, objetivosPlaneados: ['obj-1', 'obj-2'] },
      programa,
      ejecucion,
    });

    expect(resultado.jornada.estado).toBe('cerrada');
    expect(resultado.ejecucion.objetivosCompletados).toEqual(['obj-1']);
    expect(resultado.ejecucion.objetivoActualId).toBe('obj-2');
    expect(resultado.refuerzoRequerido).toBe(true);
    expect(resultado.objetivosPendientesRefuerzo).toEqual(['obj-2']);
  });

  it('rechaza cierre sin asistencia', () => {
    const ejecucion = assignProgramaToGrupo(programa, {
      grupoId: 'grupo-infantil',
      sedeId: 'sede-principal',
      fechaInicio: '2026-06-27',
    });

    expect(() => cerrarJornadaConPrograma({
      jornada: crearJornadaPendienteCierre(false, ['obj-1']),
      programa,
      ejecucion,
    })).toThrow(/asistencia/i);
  });
});

function crearJornadaPendienteCierre(asistenciaRegistrada: boolean, objetivosImpartidos: string[]) {
  const jornada = createJornada({
    tenantId: 'tenant-1',
    programaId: programa.id,
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

  return marcarPendienteCierre(iniciarJornada(confirmarJornada(jornada)), {
    asistenciaRegistrada,
    objetivosImpartidos,
  });
}
