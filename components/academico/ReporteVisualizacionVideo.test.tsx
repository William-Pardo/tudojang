import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReporteVisualizacionVideo from './ReporteVisualizacionVideo';
import type { VisualizacionVideo } from '../../servicios/academico/visualizacionRepository';

function crearVisualizacion(overrides: Partial<VisualizacionVideo> = {}): VisualizacionVideo {
  return {
    tenantId: 'tenant-1',
    recursoId: 'recurso-1',
    estudianteId: 'est-1',
    estudianteNombre: 'Ana Gomez',
    primeraReproduccion: '2026-07-10T10:00:00.000Z',
    ultimaPosicionSegundos: 80,
    duracionSegundos: 90,
    porcentajeVisto: 89,
    completado: false,
    vecesIniciado: 1,
    actualizadoEn: '2026-07-15T12:00:00.000Z',
    ...overrides,
  };
}

describe('ReporteVisualizacionVideo', () => {
  it('muestra un estado de carga mientras se obtiene el reporte', () => {
    const repository = { listarPorRecurso: jest.fn(() => new Promise(() => {})) };

    render(
      <ReporteVisualizacionVideo
        tenantId="tenant-1"
        recursoId="recurso-1"
        tituloRecurso="Clase 1: patadas"
        onCerrar={jest.fn()}
        repository={repository as any}
      />
    );

    expect(screen.getByText(/cargando reporte de visualizaci/i)).toBeInTheDocument();
  });

  it('muestra un mensaje vacio cuando nadie miro el video todavia', async () => {
    const repository = { listarPorRecurso: jest.fn().mockResolvedValue([]) };

    render(
      <ReporteVisualizacionVideo
        tenantId="tenant-1"
        recursoId="recurso-1"
        tituloRecurso="Clase 1: patadas"
        onCerrar={jest.fn()}
        repository={repository as any}
      />
    );

    expect(await screen.findByText(/todav.a nadie mir. este video/i)).toBeInTheDocument();
  });

  it('renderiza la tabla alumno / % visto / completado / ultima vez visto', async () => {
    const repository = {
      listarPorRecurso: jest.fn().mockResolvedValue([
        crearVisualizacion({ estudianteId: 'est-1', estudianteNombre: 'Beto Ruiz', porcentajeVisto: 40, completado: false }),
        crearVisualizacion({ estudianteId: 'est-2', estudianteNombre: 'Ana Gomez', porcentajeVisto: 100, completado: true }),
      ]),
    };

    render(
      <ReporteVisualizacionVideo
        tenantId="tenant-1"
        recursoId="recurso-1"
        tituloRecurso="Clase 1: patadas"
        onCerrar={jest.fn()}
        repository={repository as any}
      />
    );

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Alumno')).toBeInTheDocument();
    expect(screen.getByText('% visto')).toBeInTheDocument();
    expect(screen.getByText('Completado')).toBeInTheDocument();
    expect(screen.getByText('Última vez visto')).toBeInTheDocument();

    const filas = screen.getAllByRole('row');
    // fila 0 = encabezado; orden alfabético: Ana antes que Beto
    expect(filas[1]).toHaveTextContent('Ana Gomez');
    expect(filas[1]).toHaveTextContent('100%');
    expect(filas[1]).toHaveTextContent('Sí');
    expect(filas[2]).toHaveTextContent('Beto Ruiz');
    expect(filas[2]).toHaveTextContent('40%');
    expect(filas[2]).toHaveTextContent('No');
  });

  it('calcula el resumen (total, completados, promedio visto)', async () => {
    const repository = {
      listarPorRecurso: jest.fn().mockResolvedValue([
        crearVisualizacion({ estudianteId: 'est-1', porcentajeVisto: 100, completado: true }),
        crearVisualizacion({ estudianteId: 'est-2', porcentajeVisto: 50, completado: false }),
      ]),
    };

    render(
      <ReporteVisualizacionVideo
        tenantId="tenant-1"
        recursoId="recurso-1"
        tituloRecurso="Clase 1: patadas"
        onCerrar={jest.fn()}
        repository={repository as any}
      />
    );

    await screen.findByRole('table');
    expect(screen.getByText('2')).toBeInTheDocument(); // total alumnos
    expect(screen.getByText('1')).toBeInTheDocument(); // completados
    expect(screen.getByText('75%')).toBeInTheDocument(); // promedio visto
  });

  it('muestra un error controlado si falla la carga del reporte', async () => {
    const repository = { listarPorRecurso: jest.fn().mockRejectedValue(new Error('boom')) };

    render(
      <ReporteVisualizacionVideo
        tenantId="tenant-1"
        recursoId="recurso-1"
        tituloRecurso="Clase 1: patadas"
        onCerrar={jest.fn()}
        repository={repository as any}
      />
    );

    expect(await screen.findByText(/no se pudo cargar el reporte/i)).toBeInTheDocument();
  });

  it('llama a onCerrar al hacer click en el boton de cerrar', async () => {
    const user = userEvent.setup();
    const onCerrar = jest.fn();
    const repository = { listarPorRecurso: jest.fn().mockResolvedValue([]) };

    render(
      <ReporteVisualizacionVideo
        tenantId="tenant-1"
        recursoId="recurso-1"
        tituloRecurso="Clase 1: patadas"
        onCerrar={onCerrar}
        repository={repository as any}
      />
    );

    await waitFor(() => screen.getByText(/todav.a nadie mir. este video/i));
    await user.click(screen.getByLabelText(/cerrar reporte de visualizaci/i));

    expect(onCerrar).toHaveBeenCalledTimes(1);
  });
});
