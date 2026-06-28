import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, jest, beforeEach, expect } from '@jest/globals';
import VinculosView from './VinculosView';

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    usuario: { tenantId: 'tenant-123' }
  })
}));

jest.mock('../../context/NotificacionContext', () => ({
  useNotificacion: () => ({
    mostrarNotificacion: jest.fn()
  })
}));

jest.mock('../../context/DataContext', () => ({
  useEstudiantes: () => ({
    estudiantes: [
      { id: 'est-1', nombres: 'Juan', apellidos: 'Perez', grado: 'Blanco', numeroIdentificacion: '123' }
    ]
  })
}));

jest.mock('../../servicios/academico/vinculoService', () => ({
  linkTutorEstudiante: jest.fn(),
  unlinkTutorEstudiante: jest.fn(),
  listVinculos: jest.fn(() => Promise.resolve([]))
}));

describe('VinculosView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renderiza la vista de vinculos correctamente', async () => {
    render(<VinculosView />);
    expect(screen.getByText('Vínculos Tutor-Estudiante')).toBeInTheDocument();
    expect(screen.getByLabelText('Seleccionar Estudiante')).toBeInTheDocument();
    expect(screen.getByLabelText('Correo del Tutor')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Vincular Tutor/i })).toBeInTheDocument();

    // Esperar a que se complete la carga asíncrona inicial
    expect(await screen.findByText('No hay vínculos registrados.')).toBeInTheDocument();
  });
});
