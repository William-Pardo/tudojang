import React from 'react';
import type { AsignacionCentroEstudios } from '../../models/academico/asignacionService.types';
import type { PreguntaQuiz } from '../../models/academico/quiz';
import { progresoRepository, type FirestoreProgressRepository, type ProgresoRepository } from '../../servicios/academico/progresoRepository';
import { useRegistrarActividad } from '../../hooks/academico/useRegistrarActividad';

// Re-exportado por compatibilidad -- la definición canónica vive en models/academico/quiz.ts
// (QuizEditorModal y quizService también la usan y no pueden depender de components/).
export type { PreguntaQuiz };

export interface ResultadoQuiz {
  puntaje: number;
  aprobado: boolean;
  respuestasCorrectas: number;
  totalPreguntas: number;
  intentosUsados: number;
  estadoPostQuiz: 'aprobado' | 'requiere_refuerzo';
}

export const preguntasDemoQuiz: PreguntaQuiz[] = [
  {
    id: 'seguridad-1',
    enunciado: '¿Qué debe hacer un estudiante antes de iniciar una práctica técnica?',
    opciones: [
      'Entrar al área sin autorización',
      'Saludar, escuchar instrucciones y revisar el espacio',
      'Practicar técnicas sin supervisión',
    ],
    respuestaCorrecta: 'Saludar, escuchar instrucciones y revisar el espacio',
  },
];

export function evaluarQuiz(
  preguntas: PreguntaQuiz[],
  respuestas: Record<string, string>,
  umbral = 70,
  intentosUsados = 1
): ResultadoQuiz {
  const respuestasCorrectas = preguntas.filter((pregunta) => respuestas[pregunta.id] === pregunta.respuestaCorrecta).length;
  const puntaje = preguntas.length === 0 ? 0 : Math.round((respuestasCorrectas / preguntas.length) * 100);
  const aprobado = puntaje >= umbral;

  return {
    puntaje,
    aprobado,
    respuestasCorrectas,
    totalPreguntas: preguntas.length,
    intentosUsados,
    estadoPostQuiz: aprobado ? 'aprobado' : 'requiere_refuerzo',
  };
}

interface QuizViewProps {
  asignacion: AsignacionCentroEstudios;
  preguntas?: PreguntaQuiz[];
  maxIntentos?: number;
  onResultado?: (resultado: ResultadoQuiz) => void;
  repository?: ProgresoRepository | FirestoreProgressRepository;
  /** Props opcionales para el registro de métricas académicas */
  estudianteId?: string;
  estudianteNombre?: string;
  recursoId?: string;
}

const QuizView: React.FC<QuizViewProps> = ({
  asignacion,
  preguntas = preguntasDemoQuiz,
  maxIntentos = 2,
  onResultado,
  repository = progresoRepository,
  estudianteId,
  estudianteNombre,
  recursoId,
}) => {
  const inicioQuizRef = React.useRef<number>(Date.now());

  const { registrarResultadoQuiz } = useRegistrarActividad({
    tenantId: asignacion.tenantId,
    estudianteId: estudianteId ?? '',
    estudianteNombre,
    asignacionId: asignacion.id,
    recursoId: recursoId ?? asignacion.recursoId,
    tituloRecurso: asignacion.titulo,
  });
  const [respuestas, setRespuestas] = React.useState<Record<string, string>>({});
  const [resultado, setResultado] = React.useState<ResultadoQuiz | null>(null);
  const [intentosUsados, setIntentosUsados] = React.useState(0);

  React.useEffect(() => {
    let cancelado = false;

    async function cargarProgresoQuiz() {
      const progresoGuardado = await repository.leerQuiz(asignacion.tenantId, asignacion.id);
      if (cancelado || !progresoGuardado) return;

      const resultadoRestaurado: ResultadoQuiz = {
        puntaje: progresoGuardado.puntaje,
        aprobado: progresoGuardado.aprobado,
        respuestasCorrectas: 0,
        totalPreguntas: preguntas.length,
        intentosUsados: progresoGuardado.intentosUsados,
        estadoPostQuiz: progresoGuardado.estadoPostQuiz,
      };

      setIntentosUsados(progresoGuardado.intentosUsados);
      setResultado(resultadoRestaurado);
      onResultado?.(resultadoRestaurado);
    }

    cargarProgresoQuiz();

    return () => {
      cancelado = true;
    };
  }, [asignacion.id, asignacion.tenantId, onResultado, preguntas.length, repository]);

  const puedeEnviar = preguntas.every((pregunta) => Boolean(respuestas[pregunta.id]));
  const intentosRestantes = Math.max(maxIntentos - intentosUsados, 0);
  const bloqueado = intentosRestantes <= 0 || resultado?.aprobado === true;

  const enviar = async () => {
    if (!puedeEnviar || bloqueado) return;

    const siguienteIntento = intentosUsados + 1;
    const nuevoResultado = evaluarQuiz(preguntas, respuestas, 70, siguienteIntento);
    const tiempoSegundos = Math.round((Date.now() - inicioQuizRef.current) / 1000);

    setIntentosUsados(siguienteIntento);
    setResultado(nuevoResultado);
    await repository.guardarQuiz({
      tenantId: asignacion.tenantId,
      asignacionId: asignacion.id,
      puntaje: nuevoResultado.puntaje,
      aprobado: nuevoResultado.aprobado,
      intentosUsados: nuevoResultado.intentosUsados,
      estadoPostQuiz: nuevoResultado.estadoPostQuiz,
      actualizadoEn: new Date().toISOString(),
    });

    // Registrar métrica de evaluación si tenemos datos del estudiante
    if (estudianteId) {
      await registrarResultadoQuiz({
        totalPreguntas: nuevoResultado.totalPreguntas,
        correctas: nuevoResultado.respuestasCorrectas,
        incorrectas: nuevoResultado.totalPreguntas - nuevoResultado.respuestasCorrectas,
        score: nuevoResultado.puntaje,
        tiempoSegundos,
        respuestas: preguntas.map((p) => ({
          preguntaId: p.id,
          seleccionada: respuestas[p.id] ?? '',
          correcta: respuestas[p.id] === p.respuestaCorrecta,
        })),
      });
    }

    onResultado?.(nuevoResultado);

    if (!nuevoResultado.aprobado && siguienteIntento < maxIntentos) {
      setRespuestas({});
      inicioQuizRef.current = Date.now(); // Reset timer for next attempt
    }
  };

  return (
    <section className="rounded-[1.5rem] bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 p-6">
      <div className="mb-5">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-tkd-red">Quiz interactivo</p>
        <h3 className="mt-2 text-xl font-black uppercase text-tkd-dark dark:text-white">{asignacion.titulo}</h3>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-300">
          Responde las preguntas para validar comprensión del material asignado.
        </p>
        <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-gray-400">
          Intentos disponibles: {intentosRestantes}
        </p>
      </div>

      <div className="space-y-5">
        {preguntas.map((pregunta, indice) => (
          <fieldset
            key={pregunta.id}
            disabled={bloqueado}
            className="rounded-2xl bg-white dark:bg-gray-900 p-5 border border-gray-100 dark:border-white/10 disabled:opacity-70"
          >
            <legend className="text-sm font-black text-tkd-dark dark:text-white">
              {indice + 1}. {pregunta.enunciado}
            </legend>
            <div className="mt-4 space-y-3">
              {pregunta.opciones.map((opcion) => (
                <label key={opcion} className="flex items-start gap-3 rounded-xl border border-gray-100 dark:border-white/10 p-3 cursor-pointer hover:border-tkd-blue transition-all">
                  <input
                    type="radio"
                    name={pregunta.id}
                    value={opcion}
                    checked={respuestas[pregunta.id] === opcion}
                    onChange={() => setRespuestas((actual) => ({ ...actual, [pregunta.id]: opcion }))}
                    className="mt-1"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-300">{opcion}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>

      <button
        type="button"
        onClick={enviar}
        disabled={!puedeEnviar || bloqueado}
        className="mt-6 w-full rounded-2xl bg-tkd-blue text-white py-4 text-[11px] font-black uppercase tracking-[0.22em] hover:bg-tkd-dark transition-all disabled:bg-gray-300 disabled:cursor-not-allowed"
      >
        Enviar respuestas
      </button>

      {resultado && (
        <div className={`mt-5 rounded-2xl p-5 border ${resultado.aprobado ? 'bg-green-50 border-green-100 text-green-700' : 'bg-yellow-50 border-yellow-100 text-yellow-800'}`}>
          <p className="text-sm font-black uppercase tracking-widest">
            {resultado.aprobado ? 'Quiz aprobado' : 'Requiere refuerzo'}
          </p>
          <p className="mt-1 text-sm">
            Puntaje: {resultado.puntaje}% · {resultado.respuestasCorrectas}/{resultado.totalPreguntas} correctas · Intento {resultado.intentosUsados}/{maxIntentos}
          </p>
        </div>
      )}
    </section>
  );
};

export default QuizView;
