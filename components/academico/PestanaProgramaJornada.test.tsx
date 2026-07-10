import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PestanaProgramaJornada, {
  type OpcionesProgramaJornada,
  type PestanaProgramaJornadaProps,
} from './PestanaProgramaJornada';

const opciones: OpcionesProgramaJornada = {
  programas: [
    { id: 'programa-real', nombre: 'Programa real' },
    { id: 'programa-competencia', nombre: 'Programa competencia' },
  ],
  grupos: [
    { id: 'grupo-infantil', nombre: 'Grupo infantil' },
    { id: 'grupo-precadetes', nombre: 'Grupo precadetes' },
  ],
  sedes: [
    { id: 'sede-principal', nombre: 'Sede principal' },
    { id: 'sede-norte', nombre: 'Sede norte' },
  ],
  espacios: [
    { id: 'tatami-1', nombre: 'Tatami 1' },
    { id: 'tatami-2', nombre: 'Tatami 2' },
  ],
  instructores: [
    { id: 'maestro-real', nombre: 'Maestro real' },
    { id: 'maestro-suplente', nombre: 'Maestro suplente' },
  ],
};

const jornadaBase: PestanaProgramaJornadaProps['jornada'] = {
  programaId: 'programa-real',
  grupoId: 'grupo-infantil',
  sedeId: 'sede-principal',
  espacioId: 'tatami-1',
  instructorId: 'maestro-real',
};

const renderPestana = (overrides: Partial<PestanaProgramaJornadaProps> = {}) => {
  const handlers = {
    onProgramaChange: jest.fn(),
    onGrupoChange: jest.fn(),
    onSedeChange: jest.fn(),
    onEspacioChange: jest.fn(),
    onInstructorChange: jest.fn(),
  };
  const utils = render(
    <PestanaProgramaJornada
      jornada={jornadaBase}
      opciones={opciones}
      {...handlers}
      {...overrides}
    />
  );
  return { ...utils, ...handlers };
};

describe('PestanaProgramaJornada', () => {
  it('renderiza los 5 selects con sus opciones y refleja los valores actuales de la jornada', () => {
    renderPestana();

    expect((screen.getByLabelText(/programa/i) as HTMLSelectElement).value).toBe('programa-real');
    expect((screen.getByLabelText(/grupo/i) as HTMLSelectElement).value).toBe('grupo-infantil');
    expect((screen.getByLabelText(/sede/i) as HTMLSelectElement).value).toBe('sede-principal');
    expect((screen.getByLabelText(/espacio/i) as HTMLSelectElement).value).toBe('tatami-1');
    expect((screen.getByLabelText(/instructor/i) as HTMLSelectElement).value).toBe('maestro-real');

    const espacio = screen.getByLabelText(/espacio/i) as HTMLSelectElement;
    expect(Array.from(espacio.options).map((option) => option.value)).toEqual(['tatami-1', 'tatami-2']);
  });

  it('emite onProgramaChange con el id seleccionado', async () => {
    const user = userEvent.setup();
    const { onProgramaChange } = renderPestana();

    await user.selectOptions(screen.getByLabelText(/programa/i), 'programa-competencia');

    expect(onProgramaChange).toHaveBeenCalledWith('programa-competencia');
  });

  it('emite onGrupoChange / onSedeChange / onEspacioChange / onInstructorChange por campo', async () => {
    const user = userEvent.setup();
    const { onGrupoChange, onSedeChange, onEspacioChange, onInstructorChange } = renderPestana();

    await user.selectOptions(screen.getByLabelText(/grupo/i), 'grupo-precadetes');
    await user.selectOptions(screen.getByLabelText(/sede/i), 'sede-norte');
    await user.selectOptions(screen.getByLabelText(/espacio/i), 'tatami-2');
    await user.selectOptions(screen.getByLabelText(/instructor/i), 'maestro-suplente');

    expect(onGrupoChange).toHaveBeenCalledWith('grupo-precadetes');
    expect(onSedeChange).toHaveBeenCalledWith('sede-norte');
    expect(onEspacioChange).toHaveBeenCalledWith('tatami-2');
    expect(onInstructorChange).toHaveBeenCalledWith('maestro-suplente');
  });

  it('muestra un selector de espacio vacio cuando el tenant no tiene espacios cargados', () => {
    // Parte 3: para un tenant sin espacios reales el contexto entrega opciones.espacios = [].
    // El formulario no debe romperse: renderiza el select sin opciones.
    renderPestana({ opciones: { ...opciones, espacios: [] } });

    const espacio = screen.getByLabelText(/espacio/i) as HTMLSelectElement;
    expect(espacio.options).toHaveLength(0);
  });
});
