// vistas/ReportarPagoPublico.test.tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, jest, beforeEach, expect } from '@jest/globals';
import ReportarPagoPublico from './ReportarPagoPublico';
import { useTenant } from '../components/BrandingProvider';
import { resolverEstudiantePublico, reportarPagoPublico } from '../servicios/pagosEstudiantesApi';

// Mock del contexto de Branding (mismo patrón que Login.test.tsx / FormularioEstudiante.test.tsx)
jest.mock('../components/BrandingProvider', () => ({
    useTenant: jest.fn(),
}));

// Bug real (2026-09-02): el flujo público resolvía el estudiante con
// obtenerEstudiantePorNumIdentificacion (query directo del cliente), que SIEMPRE fallaba con
// permission-denied sin sesión -- ver servicios/pagosEstudiantesApi.ts. Ahora pasa por las
// Cloud Functions públicas resolverEstudiantePublico/reportarPagoPublico (Admin SDK).
jest.mock('../servicios/pagosEstudiantesApi', () => ({
    resolverEstudiantePublico: jest.fn(),
    reportarPagoPublico: jest.fn(),
}));

const useTenantMock = useTenant as jest.Mock;
const resolverEstudiantePublicoMock = resolverEstudiantePublico as jest.Mock<
    () => Promise<{ id: string; nombres: string; apellidos: string; saldoDeudor: number } | null>
>;
const reportarPagoPublicoMock = reportarPagoPublico as jest.Mock<(...args: unknown[]) => Promise<string>>;

const estudianteMock = {
    id: 'est-1',
    nombres: 'Ana',
    apellidos: 'García',
    saldoDeudor: 50000,
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
        resolverEstudiantePublicoMock.mockResolvedValue(estudianteMock);

        render(
            <MemoryRouter initialEntries={['/reportar-pago?id=est-1']}>
                <ReportarPagoPublico />
            </MemoryRouter>
        );

        expect(await screen.findByText('Medios de Pago Directo')).toBeInTheDocument();
        expect(resolverEstudiantePublicoMock).toHaveBeenCalledWith('est-1', 'test-tenant');
        expect(screen.getByText('Nequi')).toBeInTheDocument();
        expect(screen.getByText('300 111 2222')).toBeInTheDocument();
        expect(screen.getByText('Daviplata')).toBeInTheDocument();
        expect(screen.getByText('300 333 4444')).toBeInTheDocument();
        expect(screen.getByText('Bre-B')).toBeInTheDocument();
        expect(screen.getByText('club@brebank.co')).toBeInTheDocument();
        expect(screen.getByText('Banco / Transferencia')).toBeInTheDocument();
        expect(screen.getByText('Bancolombia Ahorros #987-654321-01')).toBeInTheDocument();
    });

    // SDD notificaciones-pagos (design.md, File Changes -> vistas/ReportarPagoPublico.tsx:111):
    // este flujo público (link sin login) NO tiene buzón in-app -- a diferencia de
    // ReportarPagoTutor.tsx, la copia neutra acá NO debe invitar a revisar un /buzon que el
    // link público jamás puede mostrar (no hay sesión).
    it('tras reportar el pago, la pantalla de éxito NO promete WhatsApp ni enlaza a un buzón (portal público sin sesión)', async () => {
        useTenantMock.mockReturnValue({
            tenant: { tenantId: 'test-tenant', nombreClub: 'Test Club', colorPrimario: '#111111' },
            estaCargado: true,
        });
        resolverEstudiantePublicoMock.mockResolvedValue(estudianteMock);
        reportarPagoPublicoMock.mockResolvedValue('reporte-1');

        const user = userEvent.setup();
        render(
            <MemoryRouter initialEntries={['/reportar-pago?id=est-1']}>
                <ReportarPagoPublico />
            </MemoryRouter>
        );

        await screen.findByText('Ana García');
        const input = document.querySelector('input[type="file"]') as HTMLInputElement;
        const file = new File(['contenido'], 'comprobante.png', { type: 'image/png' });
        await user.upload(input, file);
        await waitFor(() => expect(screen.getByRole('button', { name: /REPORTAR PAGO AHORA/i })).toBeEnabled());
        await user.click(screen.getByRole('button', { name: /REPORTAR PAGO AHORA/i }));

        expect(await screen.findByText('¡Reporte Enviado!')).toBeInTheDocument();
        expect(screen.queryByText(/WhatsApp/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/buz[oó]n/i)).not.toBeInTheDocument();
        expect(reportarPagoPublicoMock).toHaveBeenCalledWith('est-1', 'test-tenant', 50000, expect.stringContaining('data:'));
    });
});
