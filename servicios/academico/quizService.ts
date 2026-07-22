// servicios/academico/quizService.ts
// Banco de preguntas editable de un recurso tipo "quiz" de la biblioteca.
//
// Colección Firestore: tenants/{tenantId}/quizzes/{recursoId}
//
// Antes de este servicio, QuizView.tsx SIEMPRE usaba una pregunta hardcodeada
// (preguntasDemoQuiz) porque no existía ninguna fuente de datos real para las preguntas.
//
// En modo local (Firebase no configurado) usa almacenamiento en memoria.

import { doc, getDoc, setDoc, Firestore } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../firebase/config';
import type { PreguntaQuiz, QuizRecurso } from '../../models/academico/quiz';

// ---------------------------------------------------------------------------
// Almacenamiento en memoria para modo local / tests
// ---------------------------------------------------------------------------

let _mockQuizzes: Record<string, QuizRecurso> = {};

const claveMock = (tenantId: string, recursoId: string) => `${tenantId}:${recursoId}`;

export const __resetMockQuizStore = () => {
  _mockQuizzes = {};
};

export const __getMockQuizzes = () => _mockQuizzes;

// ---------------------------------------------------------------------------
// Implementación del servicio
// ---------------------------------------------------------------------------

export interface QuizServiceDeps {
  db?: Firestore;
  isFirebaseConfigured?: boolean;
}

export const crearQuizService = (deps: QuizServiceDeps = {}) => {
  const getDb = () => deps.db ?? db;
  const firebaseActivo = () =>
    deps.isFirebaseConfigured !== undefined ? deps.isFirebaseConfigured : isFirebaseConfigured;

  /** Devuelve las preguntas configuradas para el recurso, o `null` si todavía no se configuró ninguna. */
  const obtenerQuiz = async (tenantId: string, recursoId: string): Promise<PreguntaQuiz[] | null> => {
    if (!firebaseActivo()) {
      const registro = _mockQuizzes[claveMock(tenantId, recursoId)];
      return registro?.preguntas ?? null;
    }

    const ref = doc(getDb(), 'tenants', tenantId, 'quizzes', recursoId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;

    const data = snap.data() as QuizRecurso;
    return data.preguntas ?? null;
  };

  const guardarQuiz = async (
    tenantId: string,
    recursoId: string,
    preguntas: PreguntaQuiz[],
    actualizadoPorUid: string
  ): Promise<void> => {
    const registro: QuizRecurso = {
      recursoId,
      tenantId,
      preguntas,
      actualizadoPorUid,
      actualizadoEn: new Date().toISOString(),
    };

    if (!firebaseActivo()) {
      _mockQuizzes[claveMock(tenantId, recursoId)] = registro;
      return;
    }

    const ref = doc(getDb(), 'tenants', tenantId, 'quizzes', recursoId);
    await setDoc(ref, registro);
  };

  return { obtenerQuiz, guardarQuiz };
};

// Instancia singleton
export const quizService = crearQuizService();

// Exports individuales para importación destructurada
export const { obtenerQuiz, guardarQuiz } = quizService;
