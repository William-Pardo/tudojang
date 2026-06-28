import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MaterialPreviewModal from './MaterialPreviewModal';
import type { AsignacionCentroEstudios } from '../../models/academico/asignacionService.types';
import { progresoRepository } from '../../servicios/academico/progresoRepository';

const asignacion: AsignacionCentroEstudios = {
  id: 'a1',
  tenantId: 'tenant-1',
  recursoId: 'r1',
  titulo: 'Quiz: seguridad y conducta',
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
  estadoProgreso: 'en_progreso',
  porcentajeProgreso: 45,
  urgencia: 'alta',
};

describe('MaterialPreviewModal', () => {
  it('renderiza quiz cuando el recurso es evaluación', () => {
    render(<MaterialPreviewModal asignacion={asignacion} onCerrar={jest.fn()} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: /quiz: seguridad y conducta/i })).toHaveLength(2);
    expect(screen.getByText(/quiz interactivo/i)).toBeInTheDocument();
    expect(screen.getByText('45%')).toBeInTheDocument();
  });

  it('renderiza visor PDF para material no evaluativo', () => {
    render(<MaterialPreviewModal asignacion={{ ...asignacion, uso: 'estudio', titulo: 'Material base' }} onCerrar={jest.fn()} />);

    expect(screen.getByText(/visor pdf/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /marcar pagina 1 como vista/i })).toBeInTheDocument();
  });

  it('carga progreso guardado al abrir material no evaluativo', async () => {
    const leerSync = jest.spyOn(progresoRepository, 'leerSync').mockReturnValue({
      paginasVistas: [1, 2],
      segundosUnicos: [],
    });

    render(<MaterialPreviewModal asignacion={{ ...asignacion, uso: 'estudio', titulo: 'Material base' }} onCerrar={jest.fn()} />);

    expect(await screen.findByText(/paginas registradas: 2\/3/i)).toBeInTheDocument();
    expect(leerSync).toHaveBeenCalledWith('tenant-1', 'a1');

    leerSync.mockRestore();
  });

  it('solo cierra con el botón de cerrar', async () => {
    const user = userEvent.setup();
    const onCerrar = jest.fn();
    render(<MaterialPreviewModal asignacion={asignacion} onCerrar={onCerrar} />);

    await user.click(screen.getByLabelText(/cerrar material/i));

    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  it('actualiza estado local del modal cuando el quiz se aprueba', async () => {
    const user = userEvent.setup();
    render(<MaterialPreviewModal asignacion={asignacion} onCerrar={jest.fn()} />);

    await user.click(screen.getByLabelText(/saludar, escuchar instrucciones/i));
    await user.click(screen.getByRole('button', { name: /enviar respuestas/i }));

    expect(screen.getByText(/quiz aprobado/i)).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('aprobado')).toBeInTheDocument();
  });
});
