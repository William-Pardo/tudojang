// vistas/ReportarPagoPublico.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, jest, beforeEach, expect } from '@jest/globals';
import ReportarPagoPublico from './ReportarPagoPublico';
import { useTenant } from '../components/BrandingProvider';
import { obtenerEstudiantePorNumIdentificacion } from '../servicios/estudiantesApi';
import { EstadoPago, GradoTKD, GrupoEdad, type Estudiante } from '../tipos';

// Mock del contexto de Branding (mismo patrón que Login.test.tsx / FormularioEstudiante.test.tsx)
jest.mock('../components/BrandingProvider', () => ({
    useTenant: jest.fn(),
}));

jest.mock('../servicios/estudiantesApi', () => ({
    obtenerEstudiantePorNumIdentificacion: jest.fn(),
}));

// reportarPagoEstudiante solo se invoca al enviar el reporte de pago (no ejercitado por esta
// suite) -- se mockea para evitar cargar el módulo real (que llama a Firebase Storage/Functions).
jest.mock('../servicios/pagosEstudiantesApi', () => ({
    reportarPagoEstudiante: jest.fn(),
}));

const useTenantMock = useTenant as jest.Mock;
const obtenerEstudiantePorNumIdentificacionMock = obtenerEstudiantePorNumIdentificacion as jest.Mock<() => Promise<Estudiante>>;

const estudianteMock: Estudiante = {
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
};

describe('ReportarPagoPublico', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renderiza los 4 medios de pago directo cuando el tenant los tiene configurados y el alumno se identificó', async () => {
        useTenantMock.mockReturnValue({
            tenant: {
                tenantId: 'test-tenant',
                nombreClub: 'Test Club',
                colorPrimario: '#111111',
                pagoNequi: '300 111 2222',
                pagoDaviplata: '300 333 4444',
                pagoBreB: 'club@brebank.co',
                pagoBanco: 'Bancolombia Ahorros #987-654321-01',
            },
            estaCargado: true,
        });
        obtenerEstudiantePorNumIdentificacionMock.mockResolvedValue(estudianteMock);

        render(
            <MemoryRouter initialEntries={['/reportar-pago?id=12345']}>
                <ReportarPagoPublico />
            </MemoryRouter>
        );

        expect(await screen.findByText('Medios de Pago Directo')).toBeInTheDocument();
        expect(screen.getByText('Nequi')).toBeInTheDocument();
        expect(screen.getByText('300 111 2222')).toBeInTheDocument();
        expect(screen.getByText('Daviplata')).toBeInTheDocument();
        expect(screen.getByText('300 333 4444')).toBeInTheDocument();
        expect(screen.getByText('Bre-B')).toBeInTheDocument();
        expect(screen.getByText('club@brebank.co')).toBeInTheDocument();
        expect(screen.getByText('Banco / Transferencia')).toBeInTheDocument();
        expect(screen.getByText('Bancolombia Ahorros #987-654321-01')).toBeInTheDocument();
    });
});
