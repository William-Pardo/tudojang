import {
  crearClaveProgresoQuiz,
  guardarProgresoQuizLocal,
  leerProgresoQuizLocal,
  aplicarProgresoQuizLocal,
  type ProgresoQuizLocal,
} from './progresoLocal';

describe('progresoLocal', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('crea una clave estable por tenant y asignación', () => {
    expect(crearClaveProgresoQuiz('tenant-1', 'asignacion-1')).toBe(
      'tudojang:centro-estudios:quiz:tenant-1:asignacion-1'
    );
  });

  it('guarda y lee progreso local de quiz', () => {
    const progreso: ProgresoQuizLocal = {
      tenantId: 'tenant-1',
      asignacionId: 'quiz-1',
      puntaje: 100,
      aprobado: true,
      intentosUsados: 1,
      estadoPostQuiz: 'aprobado',
      actualizadoEn: '2026-06-26T00:00:00.000Z',
    };

    guardarProgresoQuizLocal(progreso);

    expect(leerProgresoQuizLocal('tenant-1', 'quiz-1')).toEqual(progreso);
  });

  it('devuelve null si el valor guardado está corrupto', () => {
    localStorage.setItem(crearClaveProgresoQuiz('tenant-1', 'quiz-1'), '{bad-json');

    expect(leerProgresoQuizLocal('tenant-1', 'quiz-1')).toBeNull();
  });

  it('aplica progreso local a asignaciones de evaluación', () => {
    guardarProgresoQuizLocal({
      tenantId: 'tenant-1',
      asignacionId: 'quiz-1',
      puntaje: 100,
      aprobado: true,
      intentosUsados: 1,
      estadoPostQuiz: 'aprobado',
      actualizadoEn: '2026-06-26T00:00:00.000Z',
    });

    const [asignacion] = aplicarProgresoQuizLocal([
      {
        id: 'quiz-1',
        tenantId: 'tenant-1',
        uso: 'evaluacion',
        estadoProgreso: 'disponible',
        porcentajeProgreso: 0,
      },
    ]);

    expect(asignacion).toEqual({
      id: 'quiz-1',
      tenantId: 'tenant-1',
      uso: 'evaluacion',
      estadoProgreso: 'aprobado',
      porcentajeProgreso: 100,
    });
  });
});
