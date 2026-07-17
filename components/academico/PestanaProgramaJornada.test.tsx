import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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

  // Subtarea 12.9: campos adicionales que pide la seccion 6 del documento de mejora
  // (hora de inicio, hora de fin, fecha) y que JornadasView.tsx NUNCA paso como prop (esa
  // vista no los edita, solo los muestra como texto de solo lectura fuera de este
  // componente). Se implementan como OPCIONALES: cada bloque nuevo solo se renderiza si su
  // callback on*Change correspondiente esta presente, para que el consumidor existente
  // (JornadasView, que no pasa estos props) siga viendo exactamente el mismo markup que
  // antes -- ver los 4 tests de esta suite que NO pasan overrides, siguen en verde sin
  // cambios.
  it('no renderiza fecha/hora cuando el consumidor no pasa esos callbacks (compatibilidad con JornadasView)', () => {
    renderPestana();

    expect(screen.queryByLabelText(/fecha de la clase/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/hora de inicio/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/hora de fin/i)).not.toBeInTheDocument();
  });

  it('renderiza fecha/hora cuando el consumidor pasa valores y callbacks, y emite el cambio de cada uno', async () => {
    const onFechaChange = jest.fn();
    const onHoraInicioChange = jest.fn();
    const onHoraFinChange = jest.fn();

    renderPestana({
      fecha: '2026-07-07',
      horaInicio: '08:00',
      horaFin: '09:00',
      onFechaChange,
      onHoraInicioChange,
      onHoraFinChange,
    });

    expect((screen.getByLabelText(/fecha de la clase/i) as HTMLInputElement).value).toBe('2026-07-07');
    expect((screen.getByLabelText(/hora de inicio/i) as HTMLInputElement).value).toBe('08:00');
    expect((screen.getByLabelText(/hora de fin/i) as HTMLInputElement).value).toBe('09:00');

    fireEvent.change(screen.getByLabelText(/fecha de la clase/i), { target: { value: '2026-07-08' } });
    expect(onFechaChange).toHaveBeenCalledWith('2026-07-08');

    fireEvent.change(screen.getByLabelText(/hora de inicio/i), { target: { value: '10:00' } });
    expect(onHoraInicioChange).toHaveBeenCalledWith('10:00');

    fireEvent.change(screen.getByLabelText(/hora de fin/i), { target: { value: '11:00' } });
    expect(onHoraFinChange).toHaveBeenCalledWith('11:00');
  });

  it('deshabilita el selector de instructor cuando instructorDeshabilitado es true (maestro asignado no-admin no puede reasignar)', () => {
    renderPestana({ instructorDeshabilitado: true });

    expect(screen.getByLabelText(/instructor/i)).toBeDisabled();
  });

  it('no deshabilita el selector de instructor por defecto', () => {
    renderPestana();

    expect(screen.getByLabelText(/instructor/i)).not.toBeDisabled();
  });

  // Rediseño post-cierre modulo 12 (ver CIERRE CENTRO DE ESTUDIOS.md): Programa/Grupo/
  // Espacio pasan a ser OPCIONALES porque el modal de edicion singular de una clase ya no
  // los edita (decision explicita del usuario) pero JornadasView.tsx (creacion de clases)
  // SI los sigue necesitando. Sede e Instructor quedan siempre obligatorios/visibles.
  describe('Programa/Grupo/Espacio opcionales (compatibilidad con el modal de edicion singular)', () => {
    it('no renderiza Programa/Grupo/Espacio cuando el consumidor no pasa esos callbacks, pero si Sede e Instructor', () => {
      render(
        <PestanaProgramaJornada
          jornada={jornadaBase}
          opciones={opciones}
          onSedeChange={jest.fn()}
          onInstructorChange={jest.fn()}
        />
      );

      expect(screen.queryByLabelText(/^programa$/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/^grupo$/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/^espacio$/i)).not.toBeInTheDocument();
      expect(screen.getByLabelText(/^sede$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^instructor$/i)).toBeInTheDocument();
    });

    it('renderiza Programa/Grupo/Espacio cuando el consumidor SI pasa los 3 callbacks (JornadasView sigue viendo los 5 campos)', () => {
      renderPestana();

      expect(screen.getByLabelText(/^programa$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^grupo$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^espacio$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^sede$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^instructor$/i)).toBeInTheDocument();
    });
  });

  // Estado y "grados excluidos de esta clase" se ELIMINARON por completo de este
  // componente (rediseño post-cierre modulo 12): eran exclusivos del modal de edicion
  // singular, que ahora los maneja de otra forma (ver ModalEdicionJornada.tsx). Este
  // componente ya no conoce ninguno de los dos conceptos.
  it('ya no expone un selector de Estado ni el checklist de grados excluidos', () => {
    renderPestana({
      fecha: '2026-07-07',
      onFechaChange: jest.fn(),
    });

    expect(screen.queryByLabelText(/^estado$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/grados excluidos/i)).not.toBeInTheDocument();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });
});
