import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PdfViewer from './PdfViewer';

const mockRegistrarPaginaPdf = jest.fn();
const mockFlush = jest.fn();
const mockUseProgressSync = jest.fn(() => ({
  progreso: { paginasVistas: [], segundosUnicos: [] },
  registrarPaginaPdf: mockRegistrarPaginaPdf,
  flush: mockFlush,
}));

jest.mock('../../hooks/academico/useProgressSync', () => ({
  useProgressSync: (options: unknown) => mockUseProgressSync(options),
}));

describe('PdfViewer', () => {
  beforeEach(() => {
    mockRegistrarPaginaPdf.mockClear();
    mockFlush.mockClear();
    mockUseProgressSync.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renderiza paginas del PDF y registra pagina vista', async () => {
    const user = userEvent.setup();

    render(
      <PdfViewer
        tenantId="tenant-1"
        asignacionId="asig-1"
        titulo="Manual tecnico"
        totalPaginas={3}
        sincronizar={jest.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: /manual tecnico/i })).toBeInTheDocument();
    expect(screen.getByText(/pagina 1 de 3/i)).toBeInTheDocument();
    expect(screen.getByText(/pagina 3 de 3/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /marcar pagina 2 como vista/i }));

    expect(mockRegistrarPaginaPdf).toHaveBeenCalledWith(2);
  });

  it('fuerza sincronizacion manual del avance acumulado', async () => {
    const user = userEvent.setup();

    render(
      <PdfViewer
        tenantId="tenant-1"
        asignacionId="asig-1"
        titulo="Manual tecnico"
        totalPaginas={1}
        sincronizar={jest.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /sincronizar avance/i }));

    expect(mockFlush).toHaveBeenCalledTimes(1);
  });

  it('muestra estado vacio cuando no hay paginas disponibles', () => {
    render(
      <PdfViewer
        tenantId="tenant-1"
        asignacionId="asig-1"
        titulo="Manual vacio"
        totalPaginas={0}
        sincronizar={jest.fn()}
      />
    );

    expect(screen.getByText(/sin paginas disponibles/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /marcar pagina/i })).not.toBeInTheDocument();
  });

  it('conecta la carga de progreso guardado para reanudar lectura', () => {
    const cargarProgreso = jest.fn();

    render(
      <PdfViewer
        tenantId="tenant-1"
        asignacionId="asig-1"
        titulo="Manual tecnico"
        totalPaginas={3}
        sincronizar={jest.fn()}
        cargarProgreso={cargarProgreso}
      />
    );

    expect(mockUseProgressSync).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      asignacionId: 'asig-1',
      tipo: 'pdf',
      cargarProgreso,
    }));
  });

  it('no cuenta pagina solo por navegar; registra tras permanencia minima visible', async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    render(
      <PdfViewer
        tenantId="tenant-1"
        asignacionId="asig-1"
        titulo="Manual tecnico"
        totalPaginas={3}
        permanenciaMinimaMs={5000}
        sincronizar={jest.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /abrir pagina 2/i }));
    expect(mockRegistrarPaginaPdf).not.toHaveBeenCalledWith(2);

    jest.advanceTimersByTime(4999);
    expect(mockRegistrarPaginaPdf).not.toHaveBeenCalledWith(2);

    jest.advanceTimersByTime(1);
    expect(mockRegistrarPaginaPdf).toHaveBeenCalledWith(2);
  });
});
