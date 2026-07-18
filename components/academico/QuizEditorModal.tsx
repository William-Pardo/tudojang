// components/academico/QuizEditorModal.tsx
// Editor del banco de preguntas de un recurso tipo "quiz". Antes de este componente no
// existía forma de crear/editar preguntas reales -- QuizView.tsx siempre mostraba una
// única pregunta hardcodeada (preguntasDemoQuiz), sin importar la asignación.

import React from 'react';
import { quizService as defaultQuizService } from '../../servicios/academico/quizService';
import type { PreguntaQuiz } from '../../models/academico/quiz';
import { useNotificacion } from '../../context/NotificacionContext';
import { IconoCerrar, IconoAgregar, IconoEliminar } from '../Iconos';

const generarIdPregunta = () => `pregunta-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const preguntaVacia = (): PreguntaQuiz => ({
  id: generarIdPregunta(),
  enunciado: '',
  opciones: ['', ''],
  respuestaCorrecta: '',
});

function validar(preguntas: PreguntaQuiz[]): string | null {
  if (preguntas.length === 0) return 'Agrega al menos una pregunta.';

  for (const [indice, pregunta] of preguntas.entries()) {
    if (!pregunta.enunciado.trim()) return `La pregunta ${indice + 1} necesita un enunciado.`;

    const opcionesValidas = pregunta.opciones.map((o) => o.trim()).filter(Boolean);
    if (opcionesValidas.length < 2) return `La pregunta ${indice + 1} necesita al menos 2 opciones.`;

    if (!pregunta.respuestaCorrecta.trim() || !opcionesValidas.includes(pregunta.respuestaCorrecta.trim())) {
      return `La pregunta ${indice + 1} necesita marcar cuál opción es la correcta.`;
    }
  }

  return null;
}

export interface QuizEditorModalProps {
  tenantId: string;
  recursoId: string;
  tituloRecurso: string;
  usuarioId: string;
  onCerrar: () => void;
  onGuardado?: () => void;
  quizService?: Pick<typeof defaultQuizService, 'obtenerQuiz' | 'guardarQuiz'>;
}

const QuizEditorModal: React.FC<QuizEditorModalProps> = ({
  tenantId,
  recursoId,
  tituloRecurso,
  usuarioId,
  onCerrar,
  onGuardado,
  quizService = defaultQuizService,
}) => {
  const { mostrarNotificacion } = useNotificacion();
  const [preguntas, setPreguntas] = React.useState<PreguntaQuiz[]>([]);
  const [cargando, setCargando] = React.useState(true);
  const [guardando, setGuardando] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    let activo = true;
    quizService.obtenerQuiz(tenantId, recursoId)
      .then((existentes) => {
        if (!activo) return;
        setPreguntas(existentes && existentes.length > 0 ? existentes : [preguntaVacia()]);
      })
      .catch(() => {
        if (activo) setPreguntas([preguntaVacia()]);
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => { activo = false; };
  }, [quizService, tenantId, recursoId]);

  const actualizarPregunta = (id: string, cambios: Partial<PreguntaQuiz>) => {
    setPreguntas((actuales) => actuales.map((p) => (p.id === id ? { ...p, ...cambios } : p)));
  };

  const agregarPregunta = () => {
    setPreguntas((actuales) => [...actuales, preguntaVacia()]);
  };

  const eliminarPregunta = (id: string) => {
    setPreguntas((actuales) => actuales.filter((p) => p.id !== id));
  };

  const actualizarOpcion = (pregunta: PreguntaQuiz, indiceOpcion: number, texto: string) => {
    const opcionAnterior = pregunta.opciones[indiceOpcion];
    const nuevasOpciones = pregunta.opciones.map((o, i) => (i === indiceOpcion ? texto : o));
    // Si la opción editada era la marcada como correcta, la respuesta correcta sigue el texto nuevo.
    const nuevaRespuestaCorrecta = pregunta.respuestaCorrecta === opcionAnterior ? texto : pregunta.respuestaCorrecta;
    actualizarPregunta(pregunta.id, { opciones: nuevasOpciones, respuestaCorrecta: nuevaRespuestaCorrecta });
  };

  const agregarOpcion = (pregunta: PreguntaQuiz) => {
    actualizarPregunta(pregunta.id, { opciones: [...pregunta.opciones, ''] });
  };

  const eliminarOpcion = (pregunta: PreguntaQuiz, indiceOpcion: number) => {
    if (pregunta.opciones.length <= 2) return;
    const opcionEliminada = pregunta.opciones[indiceOpcion];
    const nuevasOpciones = pregunta.opciones.filter((_, i) => i !== indiceOpcion);
    const nuevaRespuestaCorrecta = pregunta.respuestaCorrecta === opcionEliminada ? '' : pregunta.respuestaCorrecta;
    actualizarPregunta(pregunta.id, { opciones: nuevasOpciones, respuestaCorrecta: nuevaRespuestaCorrecta });
  };

  const guardar = async () => {
    const preguntasLimpias = preguntas.map((p) => ({
      ...p,
      enunciado: p.enunciado.trim(),
      opciones: p.opciones.map((o) => o.trim()).filter(Boolean),
      respuestaCorrecta: p.respuestaCorrecta.trim(),
    }));

    const mensajeError = validar(preguntasLimpias);
    if (mensajeError) {
      setError(mensajeError);
      return;
    }

    setError('');
    setGuardando(true);
    try {
      await quizService.guardarQuiz(tenantId, recursoId, preguntasLimpias, usuarioId);
      mostrarNotificacion('¡Banco de preguntas guardado!', 'success');
      onGuardado?.();
      onCerrar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el banco de preguntas.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[130] flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-12 sm:py-16"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-editar-quiz"
    >
      <div className="max-h-[calc(100dvh-8rem)] w-full max-w-2xl overflow-y-auto rounded-[2rem] bg-white p-6 shadow-2xl dark:bg-gray-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-tkd-red">Banco de preguntas</p>
            <h3 id="modal-editar-quiz" className="mt-2 text-2xl font-black uppercase text-tkd-dark dark:text-white">
              {tituloRecurso}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar editor de preguntas"
            className="shrink-0 w-10 h-10 rounded-2xl bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-300 hover:bg-tkd-red hover:text-white transition-all flex items-center justify-center"
          >
            <IconoCerrar className="w-5 h-5" />
          </button>
        </div>

        {cargando ? (
          <p className="mt-6 text-sm font-bold text-gray-400">Cargando preguntas...</p>
        ) : (
          <div className="mt-5 space-y-4">
            {error && (
              <div className="rounded-2xl bg-red-50 text-red-700 p-4 text-sm font-bold">{error}</div>
            )}

            {preguntas.map((pregunta, indicePregunta) => (
              <article
                key={pregunta.id}
                className="rounded-2xl border border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <label
                    htmlFor={`quiz-enunciado-${pregunta.id}`}
                    className="text-[10px] font-black uppercase tracking-widest text-gray-400"
                  >
                    Pregunta {indicePregunta + 1}
                  </label>
                  {preguntas.length > 1 && (
                    <button
                      type="button"
                      onClick={() => eliminarPregunta(pregunta.id)}
                      aria-label={`Eliminar pregunta ${indicePregunta + 1}`}
                      className="text-gray-400 hover:text-tkd-red"
                    >
                      <IconoEliminar className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <input
                  id={`quiz-enunciado-${pregunta.id}`}
                  value={pregunta.enunciado}
                  onChange={(e) => actualizarPregunta(pregunta.id, { enunciado: e.target.value })}
                  placeholder="Escribe el enunciado de la pregunta"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-bold dark:border-white/10 dark:bg-gray-950/40 dark:text-white"
                />

                <div className="space-y-2">
                  {pregunta.opciones.map((opcion, indiceOpcion) => (
                    <div key={indiceOpcion} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`quiz-correcta-${pregunta.id}`}
                        checked={Boolean(opcion) && opcion === pregunta.respuestaCorrecta}
                        onChange={() => actualizarPregunta(pregunta.id, { respuestaCorrecta: opcion })}
                        aria-label={`Marcar opción ${indiceOpcion + 1} de la pregunta ${indicePregunta + 1} como correcta`}
                      />
                      <input
                        value={opcion}
                        onChange={(e) => actualizarOpcion(pregunta, indiceOpcion, e.target.value)}
                        placeholder={`Opción ${indiceOpcion + 1}`}
                        className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-gray-950/40 dark:text-white"
                      />
                      {pregunta.opciones.length > 2 && (
                        <button
                          type="button"
                          onClick={() => eliminarOpcion(pregunta, indiceOpcion)}
                          aria-label={`Eliminar opción ${indiceOpcion + 1} de la pregunta ${indicePregunta + 1}`}
                          className="text-gray-400 hover:text-tkd-red"
                        >
                          <IconoCerrar className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => agregarOpcion(pregunta)}
                    className="text-[10px] font-black uppercase tracking-widest text-tkd-blue"
                  >
                    + Agregar opción
                  </button>
                </div>
              </article>
            ))}

            <button
              type="button"
              onClick={agregarPregunta}
              className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 dark:border-white/10 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:border-tkd-blue hover:text-tkd-blue"
            >
              <IconoAgregar className="w-4 h-4" /> Agregar pregunta
            </button>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-2xl border border-gray-200 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void guardar()}
            disabled={cargando || guardando}
            className="rounded-2xl bg-tkd-blue px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-50"
          >
            {guardando ? 'Guardando...' : 'Guardar preguntas'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuizEditorModal;
