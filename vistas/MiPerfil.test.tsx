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
import { resolveLinkedStudent, resolveStudentsForConsultor } from '../servicios/academico/tutorStudentResolver';
import { obtenerEstudiantesDelTutor } from '../servicios/pagosEstudiantesApi';
import { obtenerMetricasAsistencia } from '../servicios/academico/metricasAsistenciaService';
import type { MetricasAsistencia } from '../models/academico/metricasAsistencia';
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
    resolveStudentsForConsultor: jest.fn(),
}));

// ReportarPagoTutor (renderizado dentro de MiPerfil para el rol Tutor) resuelve sus propios
// estudiantes vía este servicio -- mismo resolveLinkedStudent por debajo, pero se mockea acá
// directo para no acoplar este test a ese detalle de implementación.
jest.mock('../servicios/pagosEstudiantesApi', () => ({
    obtenerEstudiantesDelTutor: jest.fn(),
    reportarPagoEstudiante: jest.fn(),
}));

// "Mis Horas Realizadas" (bug real 2026-09-04): lee el acumulado real de
// tenants/{t}/metricasAsistencia/{estudianteId} vía este servicio.
jest.mock('../servicios/academico/metricasAsistenciaService', () => ({
    obtenerMetricasAsistencia: jest.fn(),
}));

const useAuthMock = useAuth as jest.Mock;
const useConfiguracionMock = useConfiguracion as jest.Mock;
const useSedesMock = useSedes as jest.Mock;
const useNotificacionMock = useNotificacion as jest.Mock;
const useTenantMock = useTenant as jest.Mock;
const resolveLinkedStudentMock = resolveLinkedStudent as jest.Mock<() => Promise<Estudiante[]>>;
const resolveStudentsForConsultorMock = resolveStudentsForConsultor as jest.Mock<() => Promise<Estudiante[]>>;
const obtenerEstudiantesDelTutorMock = obtenerEstudiantesDelTutor as jest.Mock<() => Promise<Estudiante[]>>;
const obtenerMetricasAsistenciaMock = obtenerMetricasAsistencia as jest.Mock<() => Promise<MetricasAsistencia | null>>;

const usuarioTutorMock = {
    id: 'tutor-1',
    email: 'tutor@test.com',
    nombreUsuario: 'Tutor Test',
    numeroIdentificacion: '999',
    whatsapp: '3000000000',
    rol: RolUsuario.Tutor,
    tenantId: 'test-tenant',
};

const usuarioEstudianteMock = {
    id: 'est-uid-1',
    email: 'estudiante@test.com',
    nombreUsuario: 'Estudiante Test',
    numeroIdentificacion: '888',
    whatsapp: '3000000001',
    rol: RolUsuario.Estudiante,
    tenantId: 'test-tenant',
};

const usuarioAdminMock = {
    id: 'admin-1',
    email: 'admin@test.com',
    nombreUsuario: 'Admin Test',
    numeroIdentificacion: '777',
    whatsapp: '3000000002',
    rol: RolUsuario.Admin,
    tenantId: 'test-tenant',
    contrato: { sueldoBase: 3500000, duracionMeses: 12, tipoVinculacion: 'Mes', fechaInicio: '2024-01-01', lugarEjecucion: 'principal', firmado: true },
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
        resolveStudentsForConsultorMock.mockResolvedValue([]);
        obtenerMetricasAsistenciaMock.mockResolvedValue(null);
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

    // Bug real (2026-08-31, reportado tenant Cocodrilos): "Mis Talones de Pago" es nómina de
    // STAFF (usuario.contrato.sueldoBase) -- el gate previo (`!esTutorOperativo`, solo excluía
    // Tutor) dejaba pasar a Estudiante, que veía montos de sueldo hardcodeados sin sentido para
    // su rol. Ningún consultor (Tutor NI Estudiante) debe ver esta sección.
    describe('Mis Talones de Pago -- visibilidad por rol', () => {
        it('Estudiante NO ve la sección de Talones de Pago (nómina de staff)', async () => {
            useAuthMock.mockReturnValue({ usuario: usuarioEstudianteMock });
            useConfiguracionMock.mockReturnValue({ configClub: {} });
            useTenantMock.mockReturnValue({ tenant: {} });
            resolveLinkedStudentMock.mockResolvedValue([]);
            obtenerEstudiantesDelTutorMock.mockResolvedValue([]);

            renderComponent();

            await waitFor(() => expect(screen.queryByText('Cargando')).not.toBeInTheDocument());
            expect(screen.queryByText('Mis Talones de Pago')).not.toBeInTheDocument();
            // Tampoco debe caer en el flujo de reporte de pago del Tutor (resuelve por
            // tutor.correo, no le corresponde a un Estudiante).
            expect(screen.queryByText('Estado de Pago y Reporte de Comprobante')).not.toBeInTheDocument();
        });

        it('Estudiante NO ve montos de sueldo de staff en ningún lado de la vista', async () => {
            useAuthMock.mockReturnValue({ usuario: usuarioEstudianteMock });
            useConfiguracionMock.mockReturnValue({ configClub: {} });
            useTenantMock.mockReturnValue({ tenant: {} });
            resolveLinkedStudentMock.mockResolvedValue([]);
            obtenerEstudiantesDelTutorMock.mockResolvedValue([]);

            renderComponent();

            await waitFor(() => expect(screen.queryByText('Cargando')).not.toBeInTheDocument());
            expect(screen.queryByText('$1.200.000')).not.toBeInTheDocument();
        });

        it('Admin (staff) SÍ ve la sección de Talones de Pago', async () => {
            useAuthMock.mockReturnValue({ usuario: usuarioAdminMock });
            useConfiguracionMock.mockReturnValue({ configClub: {} });
            useTenantMock.mockReturnValue({ tenant: {} });

            renderComponent();

            expect(await screen.findByText('Mis Talones de Pago')).toBeInTheDocument();
        });
    });

    // Bug real (2026-09-04, reportado por el usuario): "Mis Horas Realizadas" mostraba 2
    // filas hardcodeadas de mayo 2024, visible a Tutor||Asistente. Ahora es Tutor||Estudiante
    // (esConsultor) con el acumulado real de metricasAsistencia.
    describe('Mis Horas Realizadas -- visibilidad por rol y dato real', () => {
        it('Tutor ve el resumen real (horas totales + clases asistidas) del estudiante vinculado', async () => {
            useConfiguracionMock.mockReturnValue({ configClub: {} });
            useTenantMock.mockReturnValue({ tenant: {} });
            const hijo = crearEstudianteVinculado();
            resolveStudentsForConsultorMock.mockResolvedValue([hijo]);
            obtenerEstudiantesDelTutorMock.mockResolvedValue([hijo]);
            obtenerMetricasAsistenciaMock.mockResolvedValue({
                estudianteId: 'est-1', tenantId: 'test-tenant',
                minutosTotales: 245, clasesAsistidas: 4, actualizadoEn: '2026-08-15T00:00:00.000Z',
            });

            renderComponent();

            expect(await screen.findByText('Horas Realizadas del Estudiante')).toBeInTheDocument();
            expect(await screen.findByText('4.1h')).toBeInTheDocument(); // 245/60 = 4.08 -> 4.1
            expect(screen.getByText('4')).toBeInTheDocument(); // clasesAsistidas
            expect(resolveStudentsForConsultorMock).toHaveBeenCalledWith('test-tenant', 'tutor@test.com', true);
            expect(obtenerMetricasAsistenciaMock).toHaveBeenCalledWith('test-tenant', 'est-1');
        });

        it('Estudiante ve "Mis Horas Realizadas" con su propio resumen real', async () => {
            useAuthMock.mockReturnValue({ usuario: usuarioEstudianteMock });
            useConfiguracionMock.mockReturnValue({ configClub: {} });
            useTenantMock.mockReturnValue({ tenant: {} });
            const propio = crearEstudianteVinculado({ id: 'est-uid-1' });
            resolveStudentsForConsultorMock.mockResolvedValue([propio]);
            obtenerMetricasAsistenciaMock.mockResolvedValue({
                estudianteId: 'est-uid-1', tenantId: 'test-tenant',
                minutosTotales: 60, clasesAsistidas: 1, actualizadoEn: '2026-08-01T00:00:00.000Z',
            });

            renderComponent();

            expect(await screen.findByText('Mis Horas Realizadas')).toBeInTheDocument();
            expect(await screen.findByText('1.0h')).toBeInTheDocument();
            expect(resolveStudentsForConsultorMock).toHaveBeenCalledWith('test-tenant', 'estudiante@test.com', false);
        });

        it('Admin/staff NO ve "Mis Horas Realizadas" (no es un consultor)', async () => {
            useAuthMock.mockReturnValue({ usuario: usuarioAdminMock });
            useConfiguracionMock.mockReturnValue({ configClub: {} });
            useTenantMock.mockReturnValue({ tenant: {} });

            renderComponent();

            await screen.findByText('Mis Talones de Pago');
            expect(screen.queryByText('Mis Horas Realizadas')).not.toBeInTheDocument();
            expect(screen.queryByText('Horas Realizadas del Estudiante')).not.toBeInTheDocument();
        });

        it('sin clases con check-out completo aún, muestra el estado vacío en vez de datos falsos', async () => {
            useConfiguracionMock.mockReturnValue({ configClub: {} });
            useTenantMock.mockReturnValue({ tenant: {} });
            const hijo = crearEstudianteVinculado();
            resolveStudentsForConsultorMock.mockResolvedValue([hijo]);
            obtenerEstudiantesDelTutorMock.mockResolvedValue([hijo]);
            obtenerMetricasAsistenciaMock.mockResolvedValue(null);

            renderComponent();

            expect(await screen.findByText('Horas Realizadas del Estudiante')).toBeInTheDocument();
            expect(await screen.findByText('Todavía no hay clases con entrada y salida registradas.')).toBeInTheDocument();
        });
    });
});
