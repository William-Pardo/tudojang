import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PdfViewer from './PdfViewer';

const mockRegistrarPaginaPdf = jest.fn();
const mockFlush = jest.fn();
// Fix 2026-07-21 (`npm run typecheck`): la implementacion no declaraba parametros, asi
// que TS infirio un mock de ARIDAD 0 y la llamada `mockUseProgressSync(options)` de
// abajo no compilaba. Se declara el parametro (sin usarlo) para fijar la aridad real.
const mockUseProgressSync = jest.fn((_options?: unknown) => ({
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

  it('renderiza la primera pagina y permite navegar con los controles', async () => {
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
    expect(screen.getByRole('button', { name: /anterior/i })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /siguiente/i }));
    expect(screen.getByText(/pagina 2 de 3/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /anterior/i })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: /siguiente/i }));
    expect(screen.getByText(/pagina 3 de 3/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /siguiente/i })).toBeDisabled();
  });

  it('marca la pagina actual como vista manualmente', async () => {
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

    await user.click(screen.getByRole('button', { name: /marcar pagina actual como vista/i }));

    expect(mockRegistrarPaginaPdf).toHaveBeenCalledWith(1);
  });

  it('cuando recibe una url real, renderiza el documento y usa el numero de paginas real del PDF', async () => {
    render(
      <PdfViewer
        tenantId="tenant-1"
        asignacionId="asig-1"
        titulo="Manual tecnico"
        url="https://drive-temporal.test/archivo.pdf"
        totalPaginas={3}
        sincronizar={jest.fn()}
      />
    );

    // El mock de react-pdf (__mocks__/react-pdf.tsx) resuelve siempre 5 paginas al recibir
    // `file`, y el numero real debe reemplazar la estimacion de totalPaginas (3).
    expect(await screen.findByText(/pagina 1 de 5/i)).toBeInTheDocument();
    expect(screen.getByTestId('mock-pdf-document')).toBeInTheDocument();
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
    expect(screen.queryByRole('button', { name: /marcar pagina actual/i })).not.toBeInTheDocument();
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

  it('no cuenta pagina solo por navegar; registra automaticamente tras permanencia minima', async () => {
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

    await user.click(screen.getByRole('button', { name: /siguiente/i }));
    expect(mockRegistrarPaginaPdf).not.toHaveBeenCalledWith(2);

    jest.advanceTimersByTime(4999);
    expect(mockRegistrarPaginaPdf).not.toHaveBeenCalledWith(2);

    jest.advanceTimersByTime(1);
    expect(mockRegistrarPaginaPdf).toHaveBeenCalledWith(2);
  });
});
