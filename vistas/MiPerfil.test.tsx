// vistas/MiPerfil.test.tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import * as ReactRouterDOM from 'react-router-dom';
import { describe, it, jest, beforeEach, expect } from '@jest/globals';
import VistaMiPerfil from './MiPerfil';
import { useAuth } from '../context/AuthContext';
import { useConfiguracion, useSedes } from '../context/DataContext';
import { useNotificacion } from '../context/NotificacionContext';
import { resolveLinkedStudent } from '../servicios/academico/tutorStudentResolver';
import { EstadoPago, GradoTKD, GrupoEdad, RolUsuario, type Estudiante } from '../tipos';

jest.mock('../context/AuthContext', () => ({
    useAuth: jest.fn(),
}));

jest.mock('../context/DataContext', () => ({
    useConfiguracion: jest.fn(),
    useSedes: jest.fn(),
}));

jest.mock('../context/NotificacionContext', () => ({
    useNotificacion: jest.fn(),
}));

jest.mock('../servicios/academico/tutorStudentResolver', () => ({
    resolveLinkedStudent: jest.fn(),
}));

const useAuthMock = useAuth as jest.Mock;
const useConfiguracionMock = useConfiguracion as jest.Mock;
const useSedesMock = useSedes as jest.Mock;
const useNotificacionMock = useNotificacion as jest.Mock;
const resolveLinkedStudentMock = resolveLinkedStudent as jest.Mock<() => Promise<Estudiante[]>>;

const usuarioTutorMock = {
    id: 'tutor-1',
    email: 'tutor@test.com',
    nombreUsuario: 'Tutor Test',
    numeroIdentificacion: '999',
    whatsapp: '3000000000',
    rol: RolUsuario.Tutor,
    tenantId: 'test-tenant',
};

const crearEstudianteVinculado = (overrides: Partial<Estudiante> = {}): Estudiante => ({
    id: 'est-1',
    tenantId: 'test-tenant',
    nombres: 'Ana',
    apellidos: 'García',
    numeroIdentificacion: '12345',
    fechaNacimiento: '2010-01-01',
    grado: GradoTKD.Blanco,
    grupo: GrupoEdad.Precadetes,
    horasAcumuladasGrado: 0,
    sedeId: '1',
    estadoPago: EstadoPago.Pendiente,
    fechaIngreso: '2022-01-01',
    saldoDeudor: 50000,
    historialPagos: [],
    consentimientoInformado: false,
    contratoServiciosFirmado: false,
    consentimientoImagenFirmado: false,
    consentimientoFotosVideos: false,
    telefono: '3001234567',
    correo: 'ana@test.com',
    carnetGenerado: false,
    estadoMatricula: 'activo', // requerido en Estudiante (SDD pricing-cupo-real, Bloque 1)
    ...overrides,
});

describe('VistaMiPerfil', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useAuthMock.mockReturnValue({ usuario: usuarioTutorMock });
        useSedesMock.mockReturnValue({ sedesVisibles: [] });
        useNotificacionMock.mockReturnValue({ mostrarNotificacion: jest.fn() });
    });

    const renderComponent = () =>
        render(
            <ReactRouterDOM.MemoryRouter>
                <VistaMiPerfil />
            </ReactRouterDOM.MemoryRouter>
        );

    it('muestra Medios de Pago Disponibles cuando hay saldo adeudado y hay un medio de pago configurado', async () => {
        useConfiguracionMock.mockReturnValue({
            configClub: { pagoNequi: '300 111 2222' },
        });
        resolveLinkedStudentMock.mockResolvedValue([crearEstudianteVinculado({ saldoDeudor: 50000 })]);

        renderComponent();

        expect(await screen.findByText('Medios de Pago Disponibles')).toBeInTheDocument();
        expect(screen.getByText('300 111 2222')).toBeInTheDocument();
    });

    it('no muestra Medios de Pago Disponibles cuando el saldo adeudado es 0', async () => {
        useConfiguracionMock.mockReturnValue({
            configClub: { pagoNequi: '300 111 2222' },
        });
        resolveLinkedStudentMock.mockResolvedValue([crearEstudianteVinculado({ saldoDeudor: 0 })]);

        renderComponent();

        await waitFor(() => {
            expect(screen.getByText('Saldo Adeudado')).toBeInTheDocument();
        });
        expect(screen.queryByText('Medios de Pago Disponibles')).not.toBeInTheDocument();
    });

    it('no muestra Medios de Pago Disponibles cuando no hay ningún medio de pago configurado', async () => {
        useConfiguracionMock.mockReturnValue({
            configClub: { pagoNequi: '', pagoDaviplata: '', pagoBreB: '', pagoBanco: '' },
        });
        resolveLinkedStudentMock.mockResolvedValue([crearEstudianteVinculado({ saldoDeudor: 50000 })]);

        renderComponent();

        await waitFor(() => {
            expect(screen.getByText('Saldo Adeudado')).toBeInTheDocument();
        });
        expect(screen.queryByText('Medios de Pago Disponibles')).not.toBeInTheDocument();
    });
});
