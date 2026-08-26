// vistas/MiPerfil.test.tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import * as ReactRouterDOM from 'react-router-dom';
import { describe, it, jest, beforeEach, expect } from '@jest/globals';
import VistaMiPerfil from './MiPerfil';
import { useAuth } from '../context/AuthContext';
import { useConfiguracion, useSedes } from '../context/DataContext';
import { useNotificacion } from '../context/NotificacionContext';
import { useTenant } from '../components/BrandingProvider';
import { resolveLinkedStudent } from '../servicios/academico/tutorStudentResolver';
import { obtenerEstudiantesDelTutor } from '../servicios/pagosEstudiantesApi';
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

jest.mock('../components/BrandingProvider', () => ({
    useTenant: jest.fn(),
}));

jest.mock('../servicios/academico/tutorStudentResolver', () => ({
    resolveLinkedStudent: jest.fn(),
}));

// ReportarPagoTutor (renderizado dentro de MiPerfil para el rol Tutor) resuelve sus propios
// estudiantes vía este servicio -- mismo resolveLinkedStudent por debajo, pero se mockea acá
// directo para no acoplar este test a ese detalle de implementación.
jest.mock('../servicios/pagosEstudiantesApi', () => ({
    obtenerEstudiantesDelTutor: jest.fn(),
    reportarPagoEstudiante: jest.fn(),
}));

const useAuthMock = useAuth as jest.Mock;
const useConfiguracionMock = useConfiguracion as jest.Mock;
const useSedesMock = useSedes as jest.Mock;
const useNotificacionMock = useNotificacion as jest.Mock;
const useTenantMock = useTenant as jest.Mock;
const resolveLinkedStudentMock = resolveLinkedStudent as jest.Mock<() => Promise<Estudiante[]>>;
const obtenerEstudiantesDelTutorMock = obtenerEstudiantesDelTutor as jest.Mock<() => Promise<Estudiante[]>>;

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

    // Estado de Pago y Reporte de Comprobante ahora lo resuelve ReportarPagoTutor (mismo
    // componente que la pestaña autenticada del Tutor) en vez del bloque estático que tenía
    // MiPerfil antes -- por eso estos tests mockean useTenant/obtenerEstudiantesDelTutor,
    // que son las fuentes de datos reales de ese componente.
    it('muestra Medios de Pago Directo cuando hay un medio de pago configurado', async () => {
        useConfiguracionMock.mockReturnValue({ configClub: {} });
        useTenantMock.mockReturnValue({ tenant: { pagoNequi: '300 111 2222' } });
        resolveLinkedStudentMock.mockResolvedValue([]);
        obtenerEstudiantesDelTutorMock.mockResolvedValue([crearEstudianteVinculado({ saldoDeudor: 50000 })]);

        renderComponent();

        expect(await screen.findByText('Medios de Pago Directo')).toBeInTheDocument();
        expect(screen.getByText('300 111 2222')).toBeInTheDocument();
    });

    it('permite reportar un pago aunque el saldo adeudado sea 0 (adelantar el mes siguiente)', async () => {
        useConfiguracionMock.mockReturnValue({ configClub: {} });
        useTenantMock.mockReturnValue({ tenant: { pagoNequi: '300 111 2222' } });
        resolveLinkedStudentMock.mockResolvedValue([]);
        obtenerEstudiantesDelTutorMock.mockResolvedValue([crearEstudianteVinculado({ saldoDeudor: 0 })]);

        renderComponent();

        expect(await screen.findByText('REPORTAR PAGO AHORA')).toBeInTheDocument();
        expect(screen.getByText('Medios de Pago Directo')).toBeInTheDocument();
    });

    it('no muestra Medios de Pago Directo cuando no hay ningún medio de pago configurado', async () => {
        useConfiguracionMock.mockReturnValue({ configClub: {} });
        useTenantMock.mockReturnValue({ tenant: { pagoNequi: '', pagoDaviplata: '', pagoBreB: '', pagoBanco: '' } });
        resolveLinkedStudentMock.mockResolvedValue([]);
        obtenerEstudiantesDelTutorMock.mockResolvedValue([crearEstudianteVinculado({ saldoDeudor: 50000 })]);

        renderComponent();

        await waitFor(() => {
            expect(screen.getByText('REPORTAR PAGO AHORA')).toBeInTheDocument();
        });
        expect(screen.queryByText('Medios de Pago Directo')).not.toBeInTheDocument();
    });
});
