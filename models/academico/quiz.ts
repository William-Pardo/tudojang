// models/academico/quiz.ts
// Banco de preguntas editable de un recurso tipo "quiz" de la biblioteca.
// Colección: `tenants/{tenantId}/quizzes/{recursoId}` -- un documento por recurso.

export interface PreguntaQuiz {
  id: string;
  enunciado: string;
  opciones: string[];
  respuestaCorrecta: string;
}

export interface QuizRecurso {
  recursoId: string;
  tenantId: string;
  preguntas: PreguntaQuiz[];
  actualizadoPorUid: string;
  actualizadoEn: string;
}
