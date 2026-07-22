/**
 * @jest-environment jsdom
 *
 * PRUEBAS DE INTEGRACION — Centro de Estudios, cadena de QUIZ.
 *
 * Es la cadena que ALIMENTA lo que el acudiente ve en el panel de progreso, asi que un
 * error acá no se nota en la app del estudiante: se nota en la reunion con el padre.
 *
 *   QuizEditorModal -> quizService.guardarQuiz(tenantId, recursoId, ...)
 *                        -> tenants/{t}/quizzes/{recursoId}
 *   MaterialPreviewModal -> quizService.obtenerQuiz(tenantId, asignacion.recursoId)
 *                        -> QuizView (preguntas reales, no la demo hardcodeada)
 *   QuizView.enviar()    -> evaluarQuiz()
 *                        -> progresoRepository.guardarQuiz()      (reanudar el intento)
 *                        -> actividadService.registrarActividad() (metrica del acudiente)
 *                        -> tenants/{t}/actividadLogs + tenants/{t}/metricasEstudiante
 *
 * La junta de mayor riesgo es la PRIMERA: el editor guarda con clave `recursoId` y el
 * lector consulta con `asignacion.recursoId`. Si esas dos claves se separan, el estudiante
 * ve "este quiz todavia no tiene preguntas configuradas" mientras el admin jura que las
 * cargo. Ya paso algo asi con la identidad del acudiente; no es hipotetico.
 *
 * Se mockea unicamente el SDK de Firestore: quizService y actividadService reales.
 */

jest.mock('firebase/firestore', () => require('../../test-utils/fakeFirestore').crearApiFirestoreFake());

jest.mock('../../firebase/config', () => ({
  db: {},
  auth: {},
  storage: {},
  messaging: null,
  app: {},
  appCheck: null,
  isFirebaseConfigured: true,
}));

import { limpiarFirestoreFake, leerDoc, listarPaths } from '../../test-utils/fakeFirestore';
import { crearQuizService } from './quizService';
import { crearActividadService } from './actividadService';
import { evaluarQuiz } from '../../components/academico/QuizView';
import type { PreguntaQuiz } from '../../models/academico/quiz';

const TENANT = 'tenant-gajog';
const RECURSO = 'recurso-taeguk-1';
const ASIGNACION = 'asig-1';
const ESTUDIANTE = 'est-juan';
const ADMIN = 'uid-admin-1';

// Servicios REALES contra el fake.
const quizzes = crearQuizService({ isFirebaseConfigured: true });
const actividad = crearActividadService({ isFirebaseConfigured: true });

const preguntas: PreguntaQuiz[] = [
  {
    id: 'p1',
    enunciado: '¿Con que se inicia Taeguk 1?',
    opciones: ['Ap Chagui', 'Arae Makki', 'Momtong Jirugui'],
    respuestaCorrecta: 'Arae Makki',
  },
  {
    id: 'p2',
    enunciado: '¿Cuantos movimientos tiene Taeguk 1?',
    opciones: ['18', '20', '24'],
    respuestaCorrecta: '18',
  },
];

/** Simula el envio de QuizView: evalua y registra la metrica, igual que `enviar()`. */
const responder = async (
  respuestas: Record<string, string>,
  intento = 1,
  estudianteId = ESTUDIANTE
) => {
  const resultado = evaluarQuiz(preguntas, respuestas, 70, intento);

  await actividad.registrarActividad({
    tenantId: TENANT,
    estudianteId,
    estudianteNombre: 'Juan Perez',
    asignacionId: ASIGNACION,
    recursoId: RECURSO,
    tituloRecurso: 'Taeguk 1',
    tipo: 'quiz',
    metadata: {
      totalPreguntas: resultado.totalPreguntas,
      correctas: resultado.respuestasCorrectas,
      incorrectas: resultado.totalPreguntas - resultado.respuestasCorrectas,
      score: resultado.puntaje,
      tiempoSegundos: 42,
      respuestas: preguntas.map((p) => ({
        preguntaId: p.id,
        seleccionada: respuestas[p.id] ?? '',
        correcta: respuestas[p.id] === p.respuestaCorrecta,
      })),
    },
  });

  return resultado;
};

const TODAS_BIEN = { p1: 'Arae Makki', p2: '18' };
const TODAS_MAL = { p1: 'Ap Chagui', p2: '24' };

beforeEach(() => limpiarFirestoreFake());

// --- Junta 1: el editor del admin y el lector del estudiante usan la MISMA clave --------

describe('Integracion: lo que el admin configura es lo que el estudiante recibe', () => {
  it('las preguntas guardadas por recursoId se leen con asignacion.recursoId', async () => {
    await quizzes.guardarQuiz(TENANT, RECURSO, preguntas, ADMIN);

    // El lector real usa `asignacion.recursoId`, no el id de la asignacion.
    const asignacion = { tenantId: TENANT, recursoId: RECURSO, id: ASIGNACION };
    const recuperadas = await quizzes.obtenerQuiz(asignacion.tenantId, asignacion.recursoId);

    expect(recuperadas).toEqual(preguntas);
    expect(listarPaths(`tenants/${TENANT}/quizzes`)).toEqual([`tenants/${TENANT}/quizzes/${RECURSO}`]);
  });

  it('consultar por el id de la ASIGNACION no encuentra nada (la clave es el recurso)', async () => {
    await quizzes.guardarQuiz(TENANT, RECURSO, preguntas, ADMIN);

    // Documenta la clave real: confundir asignacionId con recursoId deja al estudiante
    // viendo "este quiz todavia no tiene preguntas configuradas".
    expect(await quizzes.obtenerQuiz(TENANT, ASIGNACION)).toBeNull();
  });

  it('un recurso sin quiz configurado devuelve null, no una pregunta demo', async () => {
    expect(await quizzes.obtenerQuiz(TENANT, 'recurso-sin-quiz')).toBeNull();
  });

  it('reeditar el banco REEMPLAZA las preguntas, no las acumula', async () => {
    await quizzes.guardarQuiz(TENANT, RECURSO, preguntas, ADMIN);
    const soloUna = [preguntas[0]];
    await quizzes.guardarQuiz(TENANT, RECURSO, soloUna, 'otro-admin');

    expect(await quizzes.obtenerQuiz(TENANT, RECURSO)).toHaveLength(1);
    expect(leerDoc(`tenants/${TENANT}/quizzes/${RECURSO}`)?.actualizadoPorUid).toBe('otro-admin');
  });

  it('aisla por tenant: el quiz de un club no se filtra a otro', async () => {
    await quizzes.guardarQuiz(TENANT, RECURSO, preguntas, ADMIN);

    expect(await quizzes.obtenerQuiz('tenant-ajeno', RECURSO)).toBeNull();
  });
});

// --- Junta 2: responder escribe el log y recalcula la metrica --------------------------

describe('Integracion: responder el quiz alimenta la metrica del acudiente', () => {
  it('un intento perfecto persiste log y metrica con el score correcto', async () => {
    const resultado = await responder(TODAS_BIEN);

    expect(resultado.puntaje).toBe(100);
    expect(resultado.aprobado).toBe(true);

    expect(listarPaths(`tenants/${TENANT}/actividadLogs`)).toHaveLength(1);

    const metricas = leerDoc(`tenants/${TENANT}/metricasEstudiante/${ESTUDIANTE}`)!;
    expect(metricas.promedioScoreEvaluaciones).toBe(100);
    expect(metricas.totalEvaluacionesRealizadas).toBe(1);
    expect(metricas.estudianteNombre).toBe('Juan Perez');
  });

  it('el score que ve el acudiente es el de la ULTIMA evaluacion, y el promedio los agrega', async () => {
    // Reloj controlado: sin esto la prueba depende de si los dos intentos caen o no en el
    // mismo milisegundo, que es exactamente el defecto que la prueba de abajo fija.
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2026-07-22T10:00:00.000Z'));
      await responder(TODAS_MAL, 1);   // 0%
      jest.setSystemTime(new Date('2026-07-22T10:05:00.000Z'));
      await responder(TODAS_BIEN, 2);  // 100%
    } finally {
      jest.useRealTimers();
    }

    const metricas = leerDoc(`tenants/${TENANT}/metricasEstudiante/${ESTUDIANTE}`)!;
    expect(metricas.totalEvaluacionesRealizadas).toBe(2);
    expect(metricas.promedioScoreEvaluaciones).toBe(50);

    const avance = metricas.avancePorAsignacion.find((a: any) => a.asignacionId === ASIGNACION);
    expect(avance.scoreUltimaEvaluacion).toBe(100);
    expect(avance.vecesEvaluado).toBe(2);
  });

  it('con timestamps EMPATADOS, la ultima evaluacion sigue siendo la ultima registrada', async () => {
    // REGRESION. `registradoEn` es un ISO a milisegundos y `calcularScoreUltimoQuiz` ordenaba
    // con sort()+localeCompare descendente. sort() es estable, asi que ante empate conservaba
    // el orden de entrada y devolvia el PRIMER intento -- lo contrario de lo que promete el
    // nombre del campo (`scoreUltimaEvaluacion`).
    //
    // No es teorico: alcanza con que el reloj del dispositivo se atrase entre dos intentos
    // (sincronizacion NTP, cambio manual de hora) para que el acudiente vea congelado el
    // score viejo. El empate exacto es solo la forma mas facil de reproducirlo.
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2026-07-22T10:00:00.000Z'));
      await responder(TODAS_MAL, 1);   // 0%  — primero
      await responder(TODAS_BIEN, 2);  // 100% — segundo, MISMO milisegundo
    } finally {
      jest.useRealTimers();
    }

    const metricas = leerDoc(`tenants/${TENANT}/metricasEstudiante/${ESTUDIANTE}`)!;
    const avance = metricas.avancePorAsignacion.find((a: any) => a.asignacionId === ASIGNACION);

    expect(avance.scoreUltimaEvaluacion).toBe(100);
  });

  it('un intento parcial calcula el puntaje proporcional', async () => {
    const resultado = await responder({ p1: 'Arae Makki', p2: '24' });

    expect(resultado.puntaje).toBe(50);
    expect(resultado.aprobado).toBe(false);
    expect(resultado.estadoPostQuiz).toBe('requiere_refuerzo');
  });

  it('aisla por estudiante: la metrica de uno no contamina la del otro', async () => {
    await responder(TODAS_BIEN, 1, ESTUDIANTE);
    await responder(TODAS_MAL, 1, 'est-maria');

    expect(leerDoc(`tenants/${TENANT}/metricasEstudiante/${ESTUDIANTE}`)!.promedioScoreEvaluaciones).toBe(100);
    expect(leerDoc(`tenants/${TENANT}/metricasEstudiante/est-maria`)!.promedioScoreEvaluaciones).toBe(0);
  });

  it('registrar sin estudianteId falla explicitamente en vez de escribir basura', async () => {
    await expect(
      actividad.registrarActividad({
        tenantId: TENANT,
        estudianteId: '',
        asignacionId: ASIGNACION,
        recursoId: RECURSO,
        tipo: 'quiz',
        metadata: {} as any,
      })
    ).rejects.toThrow(/requeridos/i);

    expect(listarPaths(`tenants/${TENANT}/actividadLogs`)).toHaveLength(0);
  });
});

// --- Junta 3: la metrica leida de vuelta es la que se escribio -------------------------

describe('Integracion: obtenerMetricas devuelve lo que el panel del acudiente muestra', () => {
  it('la metrica persistida se recupera por estudiante', async () => {
    await responder(TODAS_BIEN);

    const { metricas } = await actividad.obtenerMetricas({ tenantId: TENANT, estudianteId: ESTUDIANTE });

    expect(metricas).toHaveLength(1);
    expect(metricas[0].estudianteId).toBe(ESTUDIANTE);
    expect(metricas[0].promedioScoreEvaluaciones).toBe(100);
  });

  it('los logs de la asignacion se recuperan filtrados', async () => {
    await responder(TODAS_MAL, 1);
    await responder(TODAS_BIEN, 2);

    const { logs } = await actividad.obtenerActividades({
      tenantId: TENANT,
      estudianteId: ESTUDIANTE,
      asignacionId: ASIGNACION,
    });

    expect(logs).toHaveLength(2);
    expect(logs.every((l) => l.tipo === 'quiz')).toBe(true);
  });
});

// --- CARACTERIZACION: "completada" NO significa "aprobada" ------------------------------

describe('Caracterizacion: reprobar el quiz igual cuenta la asignacion como COMPLETADA', () => {
  // Esto NO es una prueba de que el comportamiento sea correcto: fija el comportamiento
  // ACTUAL para que un cambio no pase inadvertido.
  //
  // `calcularPorcentajeConsumo` devuelve 100 apenas existe UN log de tipo quiz ("intentarlo
  // cuenta como consumir el material"), y `asignacionesCompletadas` cuenta todo lo que tenga
  // consumo >= 80. Resultado: un estudiante que saca 0% aparece con la asignacion COMPLETADA.
  //
  // El dato del score si esta (promedioScoreEvaluaciones), asi que la informacion no se
  // pierde -- pero el rotulo "completadas" mezcla "abrio el material" con "lo aprobo", y es
  // justo el numero que el acudiente lee primero.
  //
  // Registrado en ACCIONES_PENDIENTES.md. Requiere decision de producto, no de codigo.
  it('score 0 => porcentajeConsumo 100 y asignacionesCompletadas 1', async () => {
    const resultado = await responder(TODAS_MAL);
    expect(resultado.aprobado).toBe(false);
    expect(resultado.puntaje).toBe(0);

    const metricas = leerDoc(`tenants/${TENANT}/metricasEstudiante/${ESTUDIANTE}`)!;

    expect(metricas.asignacionesCompletadas).toBe(1);
    expect(metricas.porcentajeGlobalConsumo).toBe(100);
    // El score reprobado SI queda registrado: la informacion existe, el rotulo la ignora.
    expect(metricas.promedioScoreEvaluaciones).toBe(0);
  });
});
