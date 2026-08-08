// components/PrecioCalculadora.test.tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PrecioCalculadora from './PrecioCalculadora';
import { calcularFacturacionMensual } from '../utils/facturacion';

// SDD pricing-cupo-real (Bloque 4, precio-publico-calculadora): PrecioCalculadora es
// presentacional -- recibe el `ResultadoFacturacion` ya calculado por el padre
// (calcularFacturacionMensual, utils/facturacion.ts, Bloque 2 -- NO se reabre esa lógica
// acá) y solo emite los contadores crudos hacia arriba. Este test NO importa
// calcularFacturacionMensual para verificar aritmética -- eso ya está cubierto por
// utils/facturacion.test.ts -- lo usa solo para construir fixtures realistas de
// ResultadoFacturacion.

describe('PrecioCalculadora', () => {
  const onEstudiantesChange = jest.fn();
  const onSedesExtraChange = jest.fn();
  const onEquipoTecnicoExtraChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Scenario "Simulación con extras": muestra el desglose por tramos + extras sumados', () => {
    const resultado = calcularFacturacionMensual({
      estudiantesFacturables: 80,
      sedesExtraContratadas: 1,
      equipoTecnicoExtraContratado: 0,
    });

    render(
      <PrecioCalculadora
        estudiantes={80}
        sedesExtra={1}
        equipoTecnicoExtra={0}
        resultado={resultado}
        onEstudiantesChange={onEstudiantesChange}
        onSedesExtraChange={onSedesExtraChange}
        onEquipoTecnicoExtraChange={onEquipoTecnicoExtraChange}
      />
    );

    // 80 estudiantes cruza 2 tramos (1-70 y 71-150) -- el desglose muestra AMBOS, no un
    // monto único, y el total resultante sí es la suma (estudiantes + sede extra).
    const filas = screen.getAllByTestId('tramo-fila');
    expect(filas).toHaveLength(2);
    expect(filas[0]).toHaveTextContent('70 alumnos');
    expect(filas[1]).toHaveTextContent('10 alumnos');
    const totalEsperado = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(resultado.totalPesos);
    expect(screen.getByTestId('precio-total').textContent?.replace(/\s/g, '')).toBe(totalEsperado.replace(/\s/g, ''));
  });

  it('no asume una longitud fija de tramos -- renderiza solo los tramos con cantidad>0 (array disperso)', () => {
    // 30 estudiantes cae ENTERO dentro del primer tramo (1-70): el array `tramos` que
    // calcularFacturacionMensual devuelve tiene largo 1, no 4 -- el componente no debe
    // asumir índices fijos.
    const resultado = calcularFacturacionMensual({
      estudiantesFacturables: 30,
      sedesExtraContratadas: 0,
      equipoTecnicoExtraContratado: 0,
    });
    expect(resultado.estudiantes.tramos).toHaveLength(1);

    render(
      <PrecioCalculadora
        estudiantes={30}
        sedesExtra={0}
        equipoTecnicoExtra={0}
        resultado={resultado}
        onEstudiantesChange={onEstudiantesChange}
        onSedesExtraChange={onSedesExtraChange}
        onEquipoTecnicoExtraChange={onEquipoTecnicoExtraChange}
      />
    );

    expect(screen.getAllByTestId('tramo-fila')).toHaveLength(1);
  });

  it('con 0 estudiantes no rompe (tramos vacío) y muestra el total en $0', () => {
    const resultado = calcularFacturacionMensual({
      estudiantesFacturables: 0,
      sedesExtraContratadas: 0,
      equipoTecnicoExtraContratado: 0,
    });
    expect(resultado.estudiantes.tramos).toHaveLength(0);

    render(
      <PrecioCalculadora
        estudiantes={0}
        sedesExtra={0}
        equipoTecnicoExtra={0}
        resultado={resultado}
        onEstudiantesChange={onEstudiantesChange}
        onSedesExtraChange={onSedesExtraChange}
        onEquipoTecnicoExtraChange={onEquipoTecnicoExtraChange}
      />
    );

    expect(screen.queryAllByTestId('tramo-fila')).toHaveLength(0);
    expect(screen.getByTestId('precio-total').textContent?.replace(/\s/g, '')).toBe('$0');
  });

  it('el slider de estudiantes emite el conteo crudo -- el componente no calcula nada', () => {
    const resultado = calcularFacturacionMensual({
      estudiantesFacturables: 10,
      sedesExtraContratadas: 0,
      equipoTecnicoExtraContratado: 0,
    });
    render(
      <PrecioCalculadora
        estudiantes={10}
        sedesExtra={0}
        equipoTecnicoExtra={0}
        resultado={resultado}
        onEstudiantesChange={onEstudiantesChange}
        onSedesExtraChange={onSedesExtraChange}
        onEquipoTecnicoExtraChange={onEquipoTecnicoExtraChange}
      />
    );

    fireEvent.change(screen.getByLabelText(/estudiantes/i), { target: { value: '120' } });
    expect(onEstudiantesChange).toHaveBeenCalledWith(120);
  });

  it('los steppers de sedes y equipo técnico extra emiten +1/-1 sin math propia', () => {
    const resultado = calcularFacturacionMensual({
      estudiantesFacturables: 10,
      sedesExtraContratadas: 1,
      equipoTecnicoExtraContratado: 2,
    });
    render(
      <PrecioCalculadora
        estudiantes={10}
        sedesExtra={1}
        equipoTecnicoExtra={2}
        resultado={resultado}
        onEstudiantesChange={onEstudiantesChange}
        onSedesExtraChange={onSedesExtraChange}
        onEquipoTecnicoExtraChange={onEquipoTecnicoExtraChange}
      />
    );

    fireEvent.click(screen.getByLabelText('Sumar sede extra'));
    expect(onSedesExtraChange).toHaveBeenCalledWith(2);
    fireEvent.click(screen.getByLabelText('Restar sede extra'));
    expect(onSedesExtraChange).toHaveBeenCalledWith(0);

    fireEvent.click(screen.getByLabelText('Sumar equipo técnico extra'));
    expect(onEquipoTecnicoExtraChange).toHaveBeenCalledWith(3);
    fireEvent.click(screen.getByLabelText('Restar equipo técnico extra'));
    expect(onEquipoTecnicoExtraChange).toHaveBeenCalledWith(1);
  });

  it('el stepper de extras nunca baja de 0', () => {
    const resultado = calcularFacturacionMensual({
      estudiantesFacturables: 10,
      sedesExtraContratadas: 0,
      equipoTecnicoExtraContratado: 0,
    });
    render(
      <PrecioCalculadora
        estudiantes={10}
        sedesExtra={0}
        equipoTecnicoExtra={0}
        resultado={resultado}
        onEstudiantesChange={onEstudiantesChange}
        onSedesExtraChange={onSedesExtraChange}
        onEquipoTecnicoExtraChange={onEquipoTecnicoExtraChange}
      />
    );

    fireEvent.click(screen.getByLabelText('Restar sede extra'));
    expect(onSedesExtraChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText('Restar equipo técnico extra'));
    expect(onEquipoTecnicoExtraChange).not.toHaveBeenCalled();
  });
});
