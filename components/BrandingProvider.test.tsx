import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BrandingProvider, { useTenant } from './BrandingProvider';
import { useAuth } from '../context/AuthContext';

jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../servicios/configuracionApi', () => ({
    buscarTenantPorSlug: jest.fn(),
    obtenerConfiguracionClub: jest.fn(),
}));
jest.mock('../vistas/PasarelaPagos', () => () => <div>Pantalla de Pago</div>);

const { buscarTenantPorSlug, obtenerConfiguracionClub } = jest.requireMock('../servicios/configuracionApi');
const useAuthMock = useAuth as jest.Mock;

const Sonda: React.FC = () => {
    const { tenant, estaCargado } = useTenant();
    if (!estaCargado) return <div>Cargando…</div>;
    return <div data-testid="sonda">{tenant?.nombreClub || 'SIN TENANT'} / {tenant?.tenantId}</div>;
};

const renderConRuta = (ruta: string) => render(
    <MemoryRouter initialEntries={[ruta]}>
        <BrandingProvider>
            <Sonda />
        </BrandingProvider>
    </MemoryRouter>
);

beforeEach(() => {
    jest.clearAllMocks();
    useAuthMock.mockReturnValue({ usuario: null });
});

test('sin ?club y sin sesion, usa el tenant generico por defecto (comportamiento previo intacto)', async () => {
    renderConRuta('/censo/mision-1');

    await waitFor(() => expect(screen.getByTestId('sonda')).toBeInTheDocument());
    expect(screen.getByTestId('sonda').textContent).toContain('Tudojang SaaS');
    expect(buscarTenantPorSlug).not.toHaveBeenCalled();
});

test('con ?club=slug resuelve el tenant real via buscarTenantPorSlug, no el generico', async () => {
    buscarTenantPorSlug.mockResolvedValue({
        tenantId: 'tnt-gajog', nombreClub: 'Gajog TKD', slug: 'gajog', estadoSuscripcion: 'demo',
    });

    renderConRuta('/censo/directo?club=gajog');

    await waitFor(() => expect(screen.getByTestId('sonda')).toBeInTheDocument());
    expect(screen.getByTestId('sonda').textContent).toContain('Gajog TKD');
    expect(screen.getByTestId('sonda').textContent).toContain('tnt-gajog');
    expect(buscarTenantPorSlug).toHaveBeenCalledWith('gajog');
});

test('con ?club=slug NO bloquea con la pantalla de suscripcion vencida, aunque el tenant este suspendido', async () => {
    buscarTenantPorSlug.mockResolvedValue({
        tenantId: 'tnt-vencido', nombreClub: 'Club Vencido', slug: 'vencido', estadoSuscripcion: 'suspendido',
        fechaVencimiento: '2020-01-01',
    });

    renderConRuta('/censo/directo?club=vencido');

    await waitFor(() => expect(screen.getByTestId('sonda')).toBeInTheDocument());
    expect(screen.queryByText('Pantalla de Pago')).not.toBeInTheDocument();
});

test('si el club del query param no existe, muestra error en vez de caer al tenant generico', async () => {
    buscarTenantPorSlug.mockResolvedValue(null);

    renderConRuta('/censo/directo?club=no-existe');

    await waitFor(() => expect(screen.getByText(/Escuela No Encontrada/i)).toBeInTheDocument());
    expect(screen.getByText(/no-existe.*no registrada/i)).toBeInTheDocument();
});

test('una sesion autenticada tiene prioridad sobre ?club= en la URL', async () => {
    useAuthMock.mockReturnValue({ usuario: { tenantId: 'tnt-sesion' } });
    obtenerConfiguracionClub.mockResolvedValue({
        tenantId: 'tnt-sesion', nombreClub: 'Mi Propio Club', estadoSuscripcion: 'activo', fechaVencimiento: '2099-01-01',
    });

    renderConRuta('/censo/directo?club=otro-club-distinto');

    await waitFor(() => expect(screen.getByTestId('sonda')).toBeInTheDocument());
    expect(screen.getByTestId('sonda').textContent).toContain('Mi Propio Club');
    expect(buscarTenantPorSlug).not.toHaveBeenCalled();
});
