// vistas/CensoPublico.test.tsx
// Cobertura de la INTEGRACIÓN de UI agregada en el PR #71 (validaciones "preguntar y
// confirmar") sobre el formulario público de censo: advertencia inline de duplicado en el blur
// de correo, y el gating del ModalConfirmacion en el submit. La lógica pura (generarAlertasAsistenciales)
// ya tiene tests propios en utils/validacionAsistencial.test.ts -- acá solo se prueba el cableado.

import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CensoPublico from './CensoPublico';
import { useTenant } from '../components/BrandingProvider';
import { registrarAspirantePublico, obtenerMisionPorId, verificarDuplicadoAspirante } from '../servicios/censoApi';
import { MISION_ID_DIRECTO } from '../constantes';

// Mock del contexto de Branding -- mismo patrón que FormularioEstudiante.test.tsx.
jest.mock('../components/BrandingProvider', () => ({
  useTenant: jest.fn(),
}));

// Mock completo de censoApi -- CensoPublico.tsx solo importa estas 3 funciones de este módulo.
jest.mock('../servicios/censoApi', () => ({
  registrarAspirantePublico: jest.fn(),
  obtenerMisionPorId: jest.fn(),
  verificarDuplicadoAspirante: jest.fn(),
}));

const useTenantMock = useTenant as jest.Mock;
const registrarAspirantePublicoMock = registrarAspirantePublico as jest.Mock;
const obtenerMisionPorIdMock = obtenerMisionPorId as jest.Mock;
const verificarDuplicadoAspiranteMock = verificarDuplicadoAspirante as jest.Mock;

describe('CensoPublico', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useTenantMock.mockReturnValue({
      tenant: {
        tenantId: 'test-tenant',
        nombreClub: 'Test Club',
        colorPrimario: '#000000',
        colorSecundario: '#111111',
        colorAcento: '#222222',
        valorMatricula: 10000,
        valorMensualidad: 50000,
        activarMatriculaAnual: false,
      },
      estaCargado: true,
    });
    verificarDuplicadoAspiranteMock.mockResolvedValue({ correoExiste: false, telefonoExiste: false });
    registrarAspirantePublicoMock.mockResolvedValue(undefined);
    obtenerMisionPorIdMock.mockResolvedValue(null);
  });

  // Se usa el link fijo (MISION_ID_DIRECTO) en la ruta para que `esMisionReal` sea false --
  // así el componente entra directo al formulario, sin pasar por la verificación async de
  // obtenerMisionPorId (que es un flujo pre-existente al PR #71, fuera del alcance acá).
  const renderCenso = () => render(
    <MemoryRouter initialEntries={[`/censo/${MISION_ID_DIRECTO}`]}>
      <Routes>
        <Route path="/censo/:misionId" element={<CensoPublico />} />
      </Routes>
    </MemoryRouter>
  );

  const llenarCamposObligatorios = (container: HTMLElement, datos: {
    nombres: string; apellidos: string; email: string; telefono: string; fechaNacimiento: string;
  }) => {
    fireEvent.change(screen.getByPlaceholderText('EJ: JUAN'), { target: { value: datos.nombres } });
    fireEvent.change(screen.getByPlaceholderText('EJ: PEREZ'), { target: { value: datos.apellidos } });
    fireEvent.change(screen.getByPlaceholderText('EMAIL@EJEMPLO.COM'), { target: { value: datos.email } });
    fireEvent.change(screen.getByPlaceholderText('3001234567'), { target: { value: datos.telefono } });
    fireEvent.change(container.querySelector('input[name="fechaNacimiento"]')!, { target: { value: datos.fechaNacimiento } });
    fireEvent.change(screen.getByPlaceholderText('EPS'), { target: { value: 'Sura' } });
    fireEvent.change(container.querySelector('select[name="rh"]')!, { target: { value: 'O+' } });
    fireEvent.change(screen.getByPlaceholderText('CALLE/CARRERA...'), { target: { value: 'Calle 1 # 2-3' } });
    fireEvent.change(screen.getByPlaceholderText('BARRIO'), { target: { value: 'Centro' } });
  };

  it('muestra una advertencia inline sin identidad al perder foco en correo cuando verificarDuplicadoAspirante marca correoExiste', async () => {
    verificarDuplicadoAspiranteMock.mockResolvedValueOnce({ correoExiste: true, telefonoExiste: false });
    renderCenso();

    const emailInput = await screen.findByPlaceholderText('EMAIL@EJEMPLO.COM');
    fireEvent.change(emailInput, { target: { value: 'dup@test.com' } });
    fireEvent.blur(emailInput);

    await waitFor(() => {
      expect(screen.getByText('Ya existe un registro con este dato en nuestro sistema.')).toBeInTheDocument();
    });
    expect(verificarDuplicadoAspiranteMock).toHaveBeenCalledWith('test-tenant', { correo: 'dup@test.com' });
  });

  it('con un duplicado detectado, el submit muestra el ModalConfirmacion antes de enviar; confirmando, se llama a registrarAspirantePublico', async () => {
    verificarDuplicadoAspiranteMock.mockResolvedValueOnce({ correoExiste: true, telefonoExiste: false });
    const { container } = renderCenso();

    const emailInput = await screen.findByPlaceholderText('EMAIL@EJEMPLO.COM');
    fireEvent.change(emailInput, { target: { value: 'dup@test.com' } });
    fireEvent.blur(emailInput);
    await waitFor(() => expect(verificarDuplicadoAspiranteMock).toHaveBeenCalled());

    const hoy = new Date();
    llenarCamposObligatorios(container, {
      nombres: 'Carlos', apellidos: 'Ruiz', email: 'dup@test.com', telefono: '3001112233', fechaNacimiento: `${hoy.getFullYear() - 25}-01-01`,
    });

    const form = screen.getByRole('button', { name: /Finalizar Registro/i }).closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => expect(screen.getByText('Revisa antes de enviar')).toBeInTheDocument());
    expect(registrarAspirantePublicoMock).not.toHaveBeenCalled();

    const user = userEvent.setup({ delay: null });
    await user.click(screen.getByRole('button', { name: /Enviar de todas formas/i }));

    await waitFor(() => expect(registrarAspirantePublicoMock).toHaveBeenCalledTimes(1));
  });

  it('con alertas asistenciales (nombre del aspirante calcado del tutor), el submit muestra el modal antes de enviar', async () => {
    const { container } = renderCenso();

    // Aspirante menor de edad con el mismo nombre completo que el tutor -- dispara
    // nombreCoincideConTutor (utils/validacionAsistencial.ts).
    const hoy = new Date();
    const fechaMenor = `${hoy.getFullYear() - 10}-01-01`;
    llenarCamposObligatorios(container, {
      nombres: 'Carlos', apellidos: 'Ruiz', email: 'carlos@test.com', telefono: '3001112233', fechaNacimiento: fechaMenor,
    });

    // Los labels del bloque de tutor no tienen htmlFor/id (son hermanos del input, no
    // wrappers) -- getByLabelText no los asocia, así que se apunta por atributo `name`.
    await waitFor(() => expect(container.querySelector('input[name="tutorNombre"]')).toBeInTheDocument());
    fireEvent.change(container.querySelector('input[name="tutorNombre"]')!, { target: { value: 'Carlos' } });
    fireEvent.change(container.querySelector('input[name="tutorApellidos"]')!, { target: { value: 'Ruiz' } });
    fireEvent.change(container.querySelector('input[name="tutorCedula"]')!, { target: { value: '123456' } });
    fireEvent.change(container.querySelector('input[name="tutorEmail"]')!, { target: { value: 'tutor@test.com' } });
    fireEvent.change(container.querySelector('input[name="tutorTelefono"]')!, { target: { value: '3009998888' } });

    const form = screen.getByRole('button', { name: /Finalizar Registro/i }).closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => expect(screen.getByText('Revisa antes de enviar')).toBeInTheDocument());
    expect(registrarAspirantePublicoMock).not.toHaveBeenCalled();

    const user = userEvent.setup({ delay: null });
    await user.click(screen.getByRole('button', { name: /Enviar de todas formas/i }));

    await waitFor(() => expect(registrarAspirantePublicoMock).toHaveBeenCalledTimes(1));
  });

  it('sin alertas ni duplicados, el submit llama a registrarAspirantePublico directo, sin modal', async () => {
    const { container } = renderCenso();

    // Adulto (evita el bloque de tutor) y por debajo de EDAD_INUSUAL_MINIMA (33, ver
    // utils/validacionAsistencial.ts) -- una fecha fija como 1990-01-01 dispararía la alerta
    // de edad inusual a medida que pasan los años, así que se calcula relativo a "hoy".
    const hoy = new Date();
    const fechaAdultoSinAlertas = `${hoy.getFullYear() - 25}-01-01`;
    llenarCamposObligatorios(container, {
      nombres: 'Carlos', apellidos: 'Ruiz', email: 'carlos@test.com', telefono: '3001112233', fechaNacimiento: fechaAdultoSinAlertas,
    });

    const form = await screen.findByRole('button', { name: /Finalizar Registro/i });
    fireEvent.submit(form.closest('form')!);

    await waitFor(() => expect(registrarAspirantePublicoMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Revisa antes de enviar')).not.toBeInTheDocument();
  });
});
