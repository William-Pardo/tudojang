import {
  avanceAsignacionCompletado,
  UMBRAL_APROBACION_QUIZ,
  UMBRAL_CONSUMO_COMPLETADO,
  type AvanceAsignacion,
} from './actividad';

const base: AvanceAsignacion = {
  asignacionId: 'a1',
  tituloRecurso: 'X',
  tipoRecurso: 'video',
  porcentajeConsumo: 0,
};

describe('avanceAsignacionCompletado — regla de "asignacion completada"', () => {
  describe('quiz: completar es APROBAR (>= 70)', () => {
    it('score exactamente 70 (el limite) cuenta como completada', () => {
      expect(avanceAsignacionCompletado({ ...base, tipoRecurso: 'quiz', scoreUltimaEvaluacion: UMBRAL_APROBACION_QUIZ })).toBe(true);
    });

    it('score 69 (un punto por debajo) NO cuenta', () => {
      expect(avanceAsignacionCompletado({ ...base, tipoRecurso: 'quiz', scoreUltimaEvaluacion: 69 })).toBe(false);
    });

    it('score 0 NO cuenta', () => {
      expect(avanceAsignacionCompletado({ ...base, tipoRecurso: 'quiz', scoreUltimaEvaluacion: 0 })).toBe(false);
    });

    it('quiz sin score registrado NO cuenta (no se asume aprobado)', () => {
      expect(avanceAsignacionCompletado({ ...base, tipoRecurso: 'quiz', scoreUltimaEvaluacion: undefined })).toBe(false);
    });

    it('el consumo del quiz es IRRELEVANTE: 100% de consumo pero reprobado no cuenta', () => {
      expect(avanceAsignacionCompletado({ ...base, tipoRecurso: 'quiz', porcentajeConsumo: 100, scoreUltimaEvaluacion: 50 })).toBe(false);
    });
  });

  describe('material NO-quiz: completar es CONSUMIR (>= 80)', () => {
    it('video con consumo exactamente 80 cuenta', () => {
      expect(avanceAsignacionCompletado({ ...base, tipoRecurso: 'video', porcentajeConsumo: UMBRAL_CONSUMO_COMPLETADO })).toBe(true);
    });

    it('video con consumo 79 NO cuenta', () => {
      expect(avanceAsignacionCompletado({ ...base, tipoRecurso: 'video', porcentajeConsumo: 79 })).toBe(false);
    });

    it('pdf al 100% cuenta', () => {
      expect(avanceAsignacionCompletado({ ...base, tipoRecurso: 'pdf', porcentajeConsumo: 100 })).toBe(true);
    });
  });
});
