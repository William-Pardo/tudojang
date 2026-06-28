import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuizView, { evaluarQuiz, type PreguntaQuiz } from './QuizView';
import type { AsignacionCentroEstudios } from '../../models/academico/asignacionService.types';

const preguntas: PreguntaQuiz[] = [
  {
    id: 'p1',
    enunciado: 'Pregunta de prueba',
    opciones: ['Incorrecta', 'Correcta'],
    respuestaCorrecta: 'Correcta',
  },
];

const asignacion: AsignacionCentroEstudios = {
  id: 'quiz-1',
  tenantId: 'tenant-1',
  recursoId: 'r1',
  titulo: 'Quiz demo',
  descripcion: 'Evaluación',
  destinatario: { tipo: 'grupo', grupo: 'Todos' },
  uso: 'evaluacion',
  momento: 'durante',
  obligatoria: true,
  fechaApertura: '2026-06-26T00:00:00.000Z',
  estado: 'publicada',
  creadoPorUid: 'admin',
  creadoEn: '2026-06-26T00:00:00.000Z',
  actualizadoEn: '2026-06-26T00:00:00.000Z',
  estadoProgreso: 'disponible',
  porcentajeProgreso: 0,
  urgencia: 'alta',
};

describe('QuizView', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('evalúa quiz aprobado con umbral por defecto y estado post-quiz', () => {
    expect(evaluarQuiz(preguntas, { p1: 'Correcta' })).toEqual({
      puntaje: 100,
      aprobado: true,
      respuestasCorrectas: 1,
      totalPreguntas: 1,
      intentosUsados: 1,
      estadoPostQuiz: 'aprobado',
    });
  });

  it('bloquea envío hasta responder y luego muestra resultado aprobado', async () => {
    const user = userEvent.setup();
    const onResultado = jest.fn();
    render(<QuizView asignacion={asignacion} preguntas={preguntas} onResultado={onResultado} />);

    expect(screen.getByRole('button', { name: /enviar respuestas/i })).toBeDisabled();

    await user.click(screen.getByLabelText('Correcta'));
    await user.click(screen.getByRole('button', { name: /enviar respuestas/i }));

    expect(screen.getByText(/quiz aprobado/i)).toBeInTheDocument();
    expect(screen.getByText(/puntaje: 100%/i)).toBeInTheDocument();
    expect(onResultado).toHaveBeenCalledWith(expect.objectContaining({
      aprobado: true,
      estadoPostQuiz: 'aprobado',
    }));
  });

  it('agota intentos y deja el quiz en requiere refuerzo', async () => {
    const user = userEvent.setup();
    const onResultado = jest.fn();
    render(<QuizView asignacion={asignacion} preguntas={preguntas} maxIntentos={1} onResultado={onResultado} />);

    await user.click(screen.getByLabelText('Incorrecta'));
    await user.click(screen.getByRole('button', { name: /enviar respuestas/i }));

    expect(screen.getByText(/requiere refuerzo/i)).toBeInTheDocument();
    expect(screen.getByText(/intento 1\/1/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enviar respuestas/i })).toBeDisabled();
    expect(onResultado).toHaveBeenCalledWith(expect.objectContaining({
      aprobado: false,
      estadoPostQuiz: 'requiere_refuerzo',
      intentosUsados: 1,
    }));
  });

  it('guarda y reanuda resultado aprobado desde localStorage', async () => {
    const user = userEvent.setup();
    const onResultadoInicial = jest.fn();
    const { unmount } = render(
      <QuizView asignacion={asignacion} preguntas={preguntas} onResultado={onResultadoInicial} />
    );

    await user.click(screen.getByLabelText('Correcta'));
    await user.click(screen.getByRole('button', { name: /enviar respuestas/i }));
    expect(screen.getByText(/quiz aprobado/i)).toBeInTheDocument();

    unmount();

    const onResultadoRestaurado = jest.fn();
    render(<QuizView asignacion={asignacion} preguntas={preguntas} onResultado={onResultadoRestaurado} />);

    expect(screen.getByText(/quiz aprobado/i)).toBeInTheDocument();
    expect(screen.getByText(/puntaje: 100%/i)).toBeInTheDocument();
    expect(onResultadoRestaurado).toHaveBeenCalledWith(expect.objectContaining({
      aprobado: true,
      estadoPostQuiz: 'aprobado',
    }));
  });
});
