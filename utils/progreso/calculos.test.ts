import {
  calcularPdfProgress,
  calcularQuizProgress,
  calcularVideoProgress,
} from './calculos';

describe('calculos de progreso academico', () => {
  describe('calcularPdfProgress', () => {
    it('calcula porcentaje por paginas unicas vistas y completa al cumplir pagina final y permanencia minima', () => {
      expect(calcularPdfProgress({
        paginasVistas: [1, 2, 3, 4, 5],
        permanenciaSegundos: 180,
        totalPaginas: 5,
        permanenciaMinimaSegundos: 120,
      })).toEqual({
        porcentaje: 100,
        completado: true,
      });
    });

    it('no completa PDF si no alcanza el tramo final aunque tenga permanencia', () => {
      expect(calcularPdfProgress({
        paginasVistas: [1, 2, 3],
        permanenciaSegundos: 180,
        totalPaginas: 5,
        permanenciaMinimaSegundos: 120,
      })).toEqual({
        porcentaje: 60,
        completado: false,
      });
    });

    it('ignora paginas duplicadas o fuera de rango', () => {
      expect(calcularPdfProgress({
        paginasVistas: [1, 1, 2, 99, -1],
        permanenciaSegundos: 180,
        totalPaginas: 4,
      })).toEqual({
        porcentaje: 50,
        completado: false,
      });
    });
  });

  describe('calcularVideoProgress', () => {
    it('calcula porcentaje por segundos unicos y completa desde 78%', () => {
      expect(calcularVideoProgress({
        segundosUnicos: 78,
        totalSegundos: 100,
      })).toEqual({
        porcentaje: 78,
        completado: true,
      });
    });

    it('limita el porcentaje de video a 100 aunque se reporten mas segundos', () => {
      expect(calcularVideoProgress({
        segundosUnicos: 130,
        totalSegundos: 100,
      })).toEqual({
        porcentaje: 100,
        completado: true,
      });
    });

    it('devuelve cero si el video no tiene duracion valida', () => {
      expect(calcularVideoProgress({
        segundosUnicos: 30,
        totalSegundos: 0,
      })).toEqual({
        porcentaje: 0,
        completado: false,
      });
    });

    it('calcula video desde lista de segundos unicos ignorando duplicados y fuera de rango', () => {
      expect(calcularVideoProgress({
        segundosUnicos: [1, 1, 2, 3, 101, -1],
        totalSegundos: 4,
      })).toEqual({
        porcentaje: 75,
        completado: false,
      });
    });
  });

  describe('calcularQuizProgress', () => {
    it('calcula puntaje y aprueba cuando alcanza el umbral', () => {
      expect(calcularQuizProgress({
        respuestasCorrectas: 4,
        totalPreguntas: 5,
        umbralAprobacion: 70,
      })).toEqual({
        porcentaje: 80,
        aprobado: true,
        completado: true,
      });
    });

    it('marca requiere refuerzo cuando queda por debajo del umbral', () => {
      expect(calcularQuizProgress({
        respuestasCorrectas: 2,
        totalPreguntas: 5,
        umbralAprobacion: 70,
      })).toEqual({
        porcentaje: 40,
        aprobado: false,
        completado: false,
      });
    });

    it('devuelve cero si no hay preguntas evaluables', () => {
      expect(calcularQuizProgress({
        respuestasCorrectas: 0,
        totalPreguntas: 0,
        umbralAprobacion: 70,
      })).toEqual({
        porcentaje: 0,
        aprobado: false,
        completado: false,
      });
    });

    it('calcula quiz desde arreglo de respuestas evaluadas', () => {
      expect(calcularQuizProgress({
        respuestas: [
          { correcta: true },
          { correcta: false },
          { correcta: true },
          { correcta: true },
        ],
        umbralAprobacion: 75,
      })).toEqual({
        porcentaje: 75,
        aprobado: true,
        completado: true,
      });
    });
  });
});
