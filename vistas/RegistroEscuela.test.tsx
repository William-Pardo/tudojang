// vistas/RegistroEscuela.test.tsx
// SDD pricing-cupo-real (Bloque 4, tarea 4.11 -- "remove plan selection; 7-day demo trial
// untouched"): no existía test file para esta vista antes de este cambio. Cubre el
// reemplazo del flujo (registro -> checkout Wompi -> pantalla de éxito tras el retorno) por
// (registro -> pantalla de éxito directa) -- registrarNuevaEscuela ya crea el tenant en
// 'demo' incondicionalmente, así que el paso de pago antes de poder usar la cuenta era
// redundante con el trial de 7 días y quedaba inconsistente al eliminar los planes fijos.
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RegistroEscuela from './RegistroEscuela';

jest.mock('../servicios/configuracionApi', () => ({
  registrarNuevaEscuela: jest.fn(),
  buscarTenantPorSlug: jest.fn(),
}));
jest.mock('../servicios/emailService', () => ({
  enviarEmailBienvenida: jest.fn(),
  provisionarUsuarioOnboarding: jest.fn(),
  activarSuscripcionManual: jest.fn(),
}));
jest.mock('../servicios/wompiApi', () => ({
  construirUrlCheckoutWompi: jest.fn(),
}));
const mockMostrarNotificacion = jest.fn();
jest.mock('../context/NotificacionContext', () => ({
  useNotificacion: () => ({ mostrarNotificacion: mockMostrarNotificacion }),
}));

import { registrarNuevaEscuela, buscarTenantPorSlug } from '../servicios/configuracionApi';
import { enviarEmailBienvenida, provisionarUsuarioOnboarding } from '../servicios/emailService';
import { construirUrlCheckoutWompi } from '../servicios/wompiApi';

const registrarNuevaEscuelaMock = registrarNuevaEscuela as jest.MockedFunction<typeof registrarNuevaEscuela>;
const buscarTenantPorSlugMock = buscarTenantPorSlug as jest.MockedFunction<typeof buscarTenantPorSlug>;
const provisionarUsuarioOnboardingMock = provisionarUsuarioOnboarding as jest.MockedFunction<typeof provisionarUsuarioOnboarding>;
const construirUrlCheckoutWompiMock = construirUrlCheckoutWompi as jest.MockedFunction<typeof construirUrlCheckoutWompi>;

const llenarYEnviarFormulario = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByPlaceholderText(/CLUB DRAGONES DEL SUR/i), 'Academia de Prueba');
  await user.type(screen.getByPlaceholderText(/DIRECTOR@DOJANG.COM/i), 'director@test.com');
  await user.type(screen.getByPlaceholderText(/\+57 300/i), '3001234567');
  await user.click(screen.getByLabelText(/política de privacidad/i));
  await user.click(screen.getByLabelText(/términos del servicio/i));
  await user.click(screen.getByRole('button', { name: /crear mi academia|ir al pago seguro/i }));
};

describe('RegistroEscuela', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    buscarTenantPorSlugMock.mockResolvedValue(null);
    registrarNuevaEscuelaMock.mockResolvedValue('tnt-123');
    provisionarUsuarioOnboardingMock.mockResolvedValue(undefined as any);
  });

  it('Scenario "signup no selecciona plan": registra la escuela sin campo plan y sin ir a Wompi', async () => {
    const user = userEvent.setup();
    render(<RegistroEscuela />);

    await llenarYEnviarFormulario(user);

    await waitFor(() => expect(registrarNuevaEscuelaMock).toHaveBeenCalled());
    const datosRegistrados = registrarNuevaEscuelaMock.mock.calls[0][0];
    expect(datosRegistrados).not.toHaveProperty('plan');
    expect(construirUrlCheckoutWompiMock).not.toHaveBeenCalled();
  });

  it('muestra la pantalla de éxito directamente tras aprovisionar el usuario -- el trial de 7 días activa sin pago', async () => {
    const user = userEvent.setup();
    render(<RegistroEscuela />);

    await llenarYEnviarFormulario(user);

    expect(await screen.findByText(/¡Dojang Activado!/i)).toBeInTheDocument();
    expect(screen.getAllByText('director@test.com').length).toBeGreaterThan(0);
    expect(provisionarUsuarioOnboardingMock).toHaveBeenCalled();
  });
});
