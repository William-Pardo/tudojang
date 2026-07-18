import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuizEditorModal from './QuizEditorModal';
import type { PreguntaQuiz } from '../../models/academico/quiz';

const mockMostrarNotificacion = jest.fn();
jest.mock('../../context/NotificacionContext', () => ({
  useNotificacion: () => ({ mostrarNotificacion: mockMostrarNotificacion }),
}));

const crearQuizServiceMock = (preguntasExistentes: PreguntaQuiz[] | null = null) => ({
  obtenerQuiz: jest.fn().mockResolvedValue(preguntasExistentes),
  guardarQuiz: jest.fn().mockResolvedValue(undefined),
});

describe('QuizEditorModal', () => {
  beforeEach(() => {
    mockMostrarNotificacion.mockClear();
  });

  it('arranca con una pregunta en blanco cuando el recurso no tiene preguntas configuradas', async () => {
    const quizService = crearQuizServiceMock(null);
    render(
      <QuizEditorModal
        tenantId="tenant-1"
        recursoId="recurso-1"
        tituloRecurso="Evaluación Poomsae"
        usuarioId="admin-1"
        onCerrar={jest.fn()}
        quizService={quizService}
      />
    );

    expect(await screen.findByLabelText(/^pregunta 1$/i)).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText(/opción/i)).toHaveLength(2);
  });

  it('precarga las preguntas existentes del recurso', async () => {
    const existentes: PreguntaQuiz[] = [
      { id: 'p1', enunciado: '¿Qué es un poomsae?', opciones: ['Una forma', 'Un arma'], respuestaCorrecta: 'Una forma' },
    ];
    const quizService = crearQuizServiceMock(existentes);
    render(
      <QuizEditorModal
        tenantId="tenant-1"
        recursoId="recurso-1"
        tituloRecurso="Evaluación Poomsae"
        usuarioId="admin-1"
        onCerrar={jest.fn()}
        quizService={quizService}
      />
    );

    expect(await screen.findByDisplayValue('¿Qué es un poomsae?')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Una forma')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Un arma')).toBeInTheDocument();
  });

  it('agrega y elimina preguntas', async () => {
    const user = userEvent.setup();
    const quizService = crearQuizServiceMock([]);
    render(
      <QuizEditorModal
        tenantId="tenant-1"
        recursoId="recurso-1"
        tituloRecurso="Evaluación"
        usuarioId="admin-1"
        onCerrar={jest.fn()}
        quizService={quizService}
      />
    );

    await screen.findByLabelText(/^pregunta 1$/i);
    await user.click(screen.getByRole('button', { name: /agregar pregunta/i }));
    expect(screen.getByLabelText(/^pregunta 2$/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /eliminar pregunta 2/i }));
    expect(screen.queryByLabelText(/^pregunta 2$/i)).not.toBeInTheDocument();
  });

  it('no deja bajar de 2 opciones por pregunta', async () => {
    render(
      <QuizEditorModal
        tenantId="tenant-1"
        recursoId="recurso-1"
        tituloRecurso="Evaluación"
        usuarioId="admin-1"
        onCerrar={jest.fn()}
        quizService={crearQuizServiceMock([])}
      />
    );

    await screen.findByLabelText(/^pregunta 1$/i);
    expect(screen.queryByRole('button', { name: /eliminar opción/i })).not.toBeInTheDocument();
  });

  it('rechaza guardar si falta el enunciado o no hay respuesta correcta marcada', async () => {
    const user = userEvent.setup();
    const quizService = crearQuizServiceMock([]);
    render(
      <QuizEditorModal
        tenantId="tenant-1"
        recursoId="recurso-1"
        tituloRecurso="Evaluación"
        usuarioId="admin-1"
        onCerrar={jest.fn()}
        quizService={quizService}
      />
    );

    await screen.findByLabelText(/^pregunta 1$/i);
    await user.click(screen.getByRole('button', { name: /guardar preguntas/i }));

    expect(await screen.findByText(/necesita un enunciado/i)).toBeInTheDocument();
    expect(quizService.guardarQuiz).not.toHaveBeenCalled();
  });

  it('guarda el banco de preguntas válido y cierra el modal', async () => {
    const user = userEvent.setup();
    const quizService = crearQuizServiceMock([]);
    const onCerrar = jest.fn();
    render(
      <QuizEditorModal
        tenantId="tenant-1"
        recursoId="recurso-1"
        tituloRecurso="Evaluación"
        usuarioId="admin-1"
        onCerrar={onCerrar}
        quizService={quizService}
      />
    );

    await screen.findByLabelText(/^pregunta 1$/i);
    await user.type(screen.getByLabelText(/^pregunta 1$/i), '¿Cuál es la posición base?');

    const opciones = screen.getAllByPlaceholderText(/opción/i);
    await user.type(opciones[0], 'Ap Seogi');
    await user.type(opciones[1], 'Bandal Chagui');
    await user.click(screen.getByRole('radio', { name: /opción 1/i }));

    await user.click(screen.getByRole('button', { name: /guardar preguntas/i }));

    await waitFor(() => {
      expect(quizService.guardarQuiz).toHaveBeenCalledWith(
        'tenant-1',
        'recurso-1',
        [expect.objectContaining({
          enunciado: '¿Cuál es la posición base?',
          opciones: ['Ap Seogi', 'Bandal Chagui'],
          respuestaCorrecta: 'Ap Seogi',
        })],
        'admin-1'
      );
    });
    expect(mockMostrarNotificacion).toHaveBeenCalledWith(expect.stringMatching(/guardado/i), 'success');
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  it('el botón de cerrar (X) no guarda nada', async () => {
    const user = userEvent.setup();
    const quizService = crearQuizServiceMock([]);
    const onCerrar = jest.fn();
    render(
      <QuizEditorModal
        tenantId="tenant-1"
        recursoId="recurso-1"
        tituloRecurso="Evaluación"
        usuarioId="admin-1"
        onCerrar={onCerrar}
        quizService={quizService}
      />
    );

    await screen.findByLabelText(/^pregunta 1$/i);
    await user.click(screen.getByLabelText(/cerrar editor de preguntas/i));

    expect(onCerrar).toHaveBeenCalledTimes(1);
    expect(quizService.guardarQuiz).not.toHaveBeenCalled();
  });
});
