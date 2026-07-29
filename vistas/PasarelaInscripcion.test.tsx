// vistas/PasarelaInscripcion.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, jest, beforeEach, expect } from '@jest/globals';
import PasarelaInscripcion from './PasarelaInscripcion';
import { useTenant } from '../components/BrandingProvider';

// Mock del contexto de Branding (mismo patrón que Login.test.tsx / FormularioEstudiante.test.tsx)
jest.mock('../components/BrandingProvider', () => ({
    useTenant: jest.fn(),
}));

// registrarAspirantePublico solo se invoca al enviar el formulario técnico (Fase 2), que
// esta suite no ejercita -- se mockea igualmente para evitar que el módulo real (que llama
// a Firebase) se cargue durante el import.
jest.mock('../servicios/censoApi', () => ({
    registrarAspirantePublico: jest.fn(),
}));

const useTenantMock = useTenant as jest.Mock;

describe('PasarelaInscripcion', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renderiza los 4 medios de pago directo (Nequi, Daviplata, Bre-B, Banco) cuando el tenant los tiene configurados', () => {
        useTenantMock.mockReturnValue({
            tenant: {
                tenantId: 'test-tenant',
                nombreClub: 'Test Club',
                colorPrimario: '#111111',
                colorAcento: '#CD2E3A',
                valorInscripcion: 20000,
                valorMensualidad: 50000,
                valorMatricula: 10000,
                activarMatriculaAnual: false,
                pagoNequi: '300 111 2222',
                pagoDaviplata: '300 333 4444',
                pagoBreB: 'club@brebank.co',
                pagoBanco: 'Bancolombia Ahorros #987-654321-01',
            },
            estaCargado: true,
        });

        render(<PasarelaInscripcion />);

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
