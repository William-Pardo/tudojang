import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import FormularioEvento from './FormularioEvento';

let status = 'idle';
let hasDraft = false;
const clearDraft = jest.fn();
const restoreDraft = jest.fn();

jest.mock('../hooks/useAutosave', () => ({
  useAutosave: () => ({ status, hasDraft, clearDraft, restoreDraft }),
}));
jest.mock('./AutosavePrompt', () => (props: any) => (
  <div>
    <button onClick={props.onRestore}>Restaurar</button>
    <button onClick={props.onDiscard}>Descartar</button>
  </div>
));

const props = (extra: any = {}) => ({
  abierto: true,
  onCerrar: jest.fn(),
  onGuardar: jest.fn().mockResolvedValue(undefined),
  eventoActual: null,
  cargando: false,
  ...extra,
});

const change = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const completar = () => {
  change('Nombre del Evento', 'Torneo');
  change('Lugar', 'Dojang');
  change('Descripción', 'Evento nacional');
  change('Inicio Inscripción', '2026-01-01');
  change('Fin Inscripción', '2026-02-01');
  change('Fecha del Evento', '2026-03-01');
  change('Valor de Inscripción (COP)', '150');
  change('Requisitos', 'Cinturón');
};

describe('FormularioEvento', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    status = 'idle';
    hasDraft = false;
  });

  afterEach(() => jest.useRealTimers());

  it('permanece vacío cerrado, abre, evita cierre interior y ejecuta ambos cierres', () => {
    jest.useFakeTimers();
    const p = props({ abierto: false });
    const { container, rerender } = render(<FormularioEvento {...p} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<FormularioEvento {...p} abierto />);

    fireEvent.click(screen.getByText('Agregar Nuevo Evento'));
    act(() => jest.advanceTimersByTime(200));
    expect(p.onCerrar).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Cancelar'));
    act(() => jest.advanceTimersByTime(200));
    expect(p.onCerrar).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('dialog'));
    act(() => jest.advanceTimersByTime(200));
    expect(p.onCerrar).toHaveBeenCalledTimes(2);
  });

  it('muestra validaciones de fechas y guarda todos los datos nuevos', async () => {
    const p = props();
    render(<FormularioEvento {...p} />);
    change('Nombre del Evento', 'Torneo');
    change('Lugar', 'Dojang');
    change('Inicio Inscripción', '2026-03-01');
    change('Fin Inscripción', '2026-02-01');
    expect(await screen.findByText('Debe ser posterior a la fecha de inicio.')).toBeInTheDocument();

    change('Inicio Inscripción', '2026-01-01');
    change('Fecha del Evento', '2026-01-15');
    expect(await screen.findByText('Debe ser posterior a la fecha de fin de inscripción.')).toBeInTheDocument();

    change('Fecha del Evento', '2026-03-01');
    change('Descripción', 'Evento nacional');
    change('Valor de Inscripción (COP)', '150');
    change('Requisitos', 'Cinturón');
    await waitFor(() => expect(screen.getByText('Guardar Evento').closest('button')).toBeEnabled());
    fireEvent.click(screen.getByText('Guardar Evento'));
    await waitFor(() => expect(p.onGuardar).toHaveBeenCalledWith(expect.objectContaining({
      nombre: 'Torneo',
      descripcion: 'Evento nacional',
      valor: 150,
      requisitos: 'Cinturón',
    })));
    expect(clearDraft).toHaveBeenCalled();
  });

  it('muestra errores requeridos, numérico y valor negativo', async () => {
    render(<FormularioEvento {...props()} />);
    change('Nombre del Evento', ' ');
    change('Lugar', ' ');
    change('Inicio Inscripción', '2026-01-01');
    change('Inicio Inscripción', '');
    change('Fin Inscripción', '');
    change('Fecha del Evento', '');
    change('Valor de Inscripción (COP)', 'texto');
    expect(await screen.findByText('El nombre del evento es obligatorio.')).toBeInTheDocument();
    expect(screen.getByText('El lugar es obligatorio.')).toBeInTheDocument();
    expect(screen.getByText('La fecha de inicio de inscripción es obligatoria.')).toBeInTheDocument();
    expect(screen.getByText('El valor debe ser un número.')).toBeInTheDocument();
    change('Valor de Inscripción (COP)', '-1');
    expect(await screen.findByText('El valor no puede ser negativo.')).toBeInTheDocument();
  });

  it('sube y descarta el banner e ignora selección vacía', async () => {
    class Reader {
      result = 'data:image/png;base64,x';
      onloadend?: () => void;
      readAsDataURL() { this.onloadend?.(); }
    }
    (global as any).FileReader = Reader;
    render(<FormularioEvento {...props()} />);
    const input = screen.getByLabelText('Seleccionar archivo');
    fireEvent.change(input, { target: { files: [new File(['x'], 'x.png', { type: 'image/png' })] } });
    expect(await screen.findByAltText('Vista previa del evento')).toHaveAttribute('src', 'data:image/png;base64,x');
    fireEvent.click(screen.getByLabelText('Descartar banner'));
    expect(screen.queryByAltText('Vista previa del evento')).not.toBeInTheDocument();
    fireEvent.change(input, { target: { files: [] } });
  });

  it('edita con opcionales ausentes y conserva el borrador cuando guardar falla', async () => {
    status = 'saving';
    hasDraft = true;
    const eventoActual: any = {
      id: '1', nombre: 'Viejo', lugar: 'L', fechaInicioInscripcion: '2026-01-01',
      fechaFinInscripcion: '2026-02-01', fechaEvento: '2026-03-01', valor: 1,
    };
    const onGuardar = jest.fn().mockRejectedValue(new Error('fallo'));
    const error = jest.spyOn(console, 'error').mockImplementation();
    render(<FormularioEvento {...props({ eventoActual, onGuardar })} />);
    expect(screen.getByText('Editar Evento')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Viejo')).toBeInTheDocument();
    expect(screen.getByText('Guardando borrador...')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Restaurar'));
    fireEvent.click(screen.getByText('Descartar'));
    expect(restoreDraft).toHaveBeenCalled();
    expect(clearDraft).toHaveBeenCalled();
    completar();
    await waitFor(() => expect(screen.getByText('Guardar Evento').closest('button')).toBeEnabled());
    fireEvent.click(screen.getByText('Guardar Evento'));
    await waitFor(() => expect(onGuardar).toHaveBeenCalledWith(expect.objectContaining({ id: '1', nombre: 'Torneo' })));
    expect(error).toHaveBeenCalled();
  });

  it.each([
    ['saved', 'Borrador guardado ✓'],
    ['error', 'Error al guardar borrador'],
  ])('presenta el estado autosave %s y bloqueo de carga', (state, text) => {
    status = state;
    render(<FormularioEvento {...props({ cargando: true })} />);
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.getByText('Guardando...').closest('button')).toBeDisabled();
  });

  it('reinicializa al cambiar de evento y al cerrar', () => {
    const first: any = {
      id: '1', nombre: 'Uno', lugar: 'L', descripcion: '', fechaInicioInscripcion: '2026-01-01',
      fechaFinInscripcion: '2026-02-01', fechaEvento: '2026-03-01', valor: 0, requisitos: '', imagenUrl: '',
    };
    const second = { ...first, id: '2', nombre: 'Dos' };
    const p = props({ eventoActual: first });
    const { rerender } = render(<FormularioEvento {...p} />);
    expect(screen.getByDisplayValue('Uno')).toBeInTheDocument();
    rerender(<FormularioEvento {...p} eventoActual={second} />);
    expect(screen.getByDisplayValue('Dos')).toBeInTheDocument();
    rerender(<FormularioEvento {...p} abierto={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
