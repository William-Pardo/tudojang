export interface ResultadoProgreso {
  porcentaje: number;
  completado: boolean;
}

export interface CalcularPdfProgressInput {
  paginasVistas: number[];
  permanenciaSegundos: number;
  totalPaginas: number;
  permanenciaMinimaSegundos?: number;
}

export interface CalcularVideoProgressInput {
  segundosUnicos: number | number[];
  totalSegundos: number;
  umbralCompletado?: number;
}

export interface RespuestaQuizProgress {
  correcta: boolean;
}

export interface CalcularQuizProgressInput {
  respuestasCorrectas?: number;
  totalPreguntas?: number;
  respuestas?: RespuestaQuizProgress[];
  umbralAprobacion?: number;
}

export interface ResultadoQuizProgress extends ResultadoProgreso {
  aprobado: boolean;
}

function normalizarPorcentaje(valor: number): number {
  if (!Number.isFinite(valor)) return 0;
  return Math.max(0, Math.min(100, Math.round(valor)));
}

export function calcularPdfProgress({
  paginasVistas,
  permanenciaSegundos,
  totalPaginas,
  permanenciaMinimaSegundos = 120,
}: CalcularPdfProgressInput): ResultadoProgreso {
  const paginasUnicas = new Set(
    paginasVistas.filter((pagina) => Number.isInteger(pagina) && pagina >= 1 && pagina <= totalPaginas)
  );
  const porcentaje = totalPaginas <= 0 ? 0 : normalizarPorcentaje((paginasUnicas.size / totalPaginas) * 100);
  const llegoAlTramoFinal = totalPaginas > 0 && paginasUnicas.has(totalPaginas);
  const cumplePermanencia = permanenciaSegundos >= permanenciaMinimaSegundos;

  return {
    porcentaje,
    completado: porcentaje === 100 && llegoAlTramoFinal && cumplePermanencia,
  };
}

export function calcularVideoProgress({
  segundosUnicos,
  totalSegundos,
  umbralCompletado = 78,
}: CalcularVideoProgressInput): ResultadoProgreso {
  const totalUnico = Array.isArray(segundosUnicos)
    ? new Set(
        segundosUnicos.filter((segundo) => (
          Number.isInteger(segundo)
          && segundo >= 0
          && segundo < totalSegundos
        ))
      ).size
    : segundosUnicos;
  const porcentaje = totalSegundos <= 0 ? 0 : normalizarPorcentaje((totalUnico / totalSegundos) * 100);

  return {
    porcentaje,
    completado: porcentaje >= umbralCompletado,
  };
}

export function calcularQuizProgress({
  respuestasCorrectas,
  totalPreguntas,
  respuestas,
  umbralAprobacion = 70,
}: CalcularQuizProgressInput): ResultadoQuizProgress {
  const correctas = Array.isArray(respuestas)
    ? respuestas.filter((respuesta) => respuesta.correcta).length
    : respuestasCorrectas ?? 0;
  const total = Array.isArray(respuestas)
    ? respuestas.length
    : totalPreguntas ?? 0;
  const porcentaje = total <= 0 ? 0 : normalizarPorcentaje((correctas / total) * 100);
  const aprobado = porcentaje >= umbralAprobacion;

  return {
    porcentaje,
    aprobado,
    completado: aprobado,
  };
}
