// servicios/academico/quizService.test.ts
// Tests unitarios para quizService. Usa modo local (isFirebaseConfigured: false).

import { crearQuizService, __resetMockQuizStore, __getMockQuizzes } from './quizService';
import type { PreguntaQuiz } from '../../models/academico/quiz';

jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db: unknown, ...path: unknown[]) => path),
  getDoc: jest.fn(() => Promise.resolve({ exists: () => false })),
  setDoc: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../firebase/config', () => ({
  isFirebaseConfigured: false,
  db: 'db-mock',
}));

const service = crearQuizService({ isFirebaseConfigured: false });

const preguntas: PreguntaQuiz[] = [
  { id: 'p1', enunciado: '¿Qué es un poomsae?', opciones: ['Una forma', 'Un arma'], respuestaCorrecta: 'Una forma' },
];

beforeEach(() => {
  __resetMockQuizStore();
});

describe('quizService — modo local', () => {
  it('obtenerQuiz devuelve null si nunca se configuró el recurso', async () => {
    const resultado = await service.obtenerQuiz('tenant-1', 'recurso-1');
    expect(resultado).toBeNull();
  });

  it('guardarQuiz persiste las preguntas y obtenerQuiz las devuelve', async () => {
    await service.guardarQuiz('tenant-1', 'recurso-1', preguntas, 'admin-1');

    const resultado = await service.obtenerQuiz('tenant-1', 'recurso-1');
    expect(resultado).toEqual(preguntas);
  });

  it('guardarQuiz sobrescribe el banco de preguntas anterior del mismo recurso', async () => {
    await service.guardarQuiz('tenant-1', 'recurso-1', preguntas, 'admin-1');
    const nuevasPreguntas: PreguntaQuiz[] = [
      { id: 'p2', enunciado: 'Otra pregunta', opciones: ['a', 'b'], respuestaCorrecta: 'a' },
    ];
    await service.guardarQuiz('tenant-1', 'recurso-1', nuevasPreguntas, 'admin-1');

    const resultado = await service.obtenerQuiz('tenant-1', 'recurso-1');
    expect(resultado).toEqual(nuevasPreguntas);
  });

  it('aisla el banco de preguntas por tenant + recurso', async () => {
    await service.guardarQuiz('tenant-1', 'recurso-1', preguntas, 'admin-1');

    expect(await service.obtenerQuiz('tenant-2', 'recurso-1')).toBeNull();
    expect(await service.obtenerQuiz('tenant-1', 'recurso-2')).toBeNull();
    expect(Object.keys(__getMockQuizzes())).toEqual(['tenant-1:recurso-1']);
  });
});
