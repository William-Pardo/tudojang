// vistas/Administracion.test.tsx
//
// Administracion.tsx no tenia ningun test previo. Esta cobertura se limita al escenario que
// realmente causo el bug reportado en vivo -- la sincronizacion reactiva del `?tab=` -- y
// mockea las 5 sub-vistas como stubs triviales para no arrastrar sus propias dependencias
// (useFinanzas, useAuth, etc.), que son irrelevantes para lo que se esta probando aca: el
// switcheo de pestañas de VistaAdministracion en si.
import React from 'react';
import { render, screen } from '@testing-library/react';
import VistaAdministracion from './Administracion';

let mockSearchParams = new URLSearchParams();
jest.mock('react-router-dom', () => ({ useSearchParams: () => [mockSearchParams] }));

jest.mock('./Dashboard', () => () => <div>Stub Dashboard</div>);
jest.mock('./Finanzas', () => () => <div>Stub Finanzas</div>);
jest.mock('./admin/AgendaView', () => () => <div>Stub Agenda</div>);
jest.mock('../components/Pagos/PanelValidacionPagos', () => () => <div>Stub Validar Pagos</div>);
jest.mock('../components/Pagos/HistorialValidaciones', () => () => <div>Stub Historial</div>);

jest.mock('../context/DataContext', () => ({
  useEstudiantes: () => ({ estudiantes: [], actualizarEstudiante: jest.fn() }),
  useConfiguracion: () => ({ configClub: { moraPorcentaje: 5 } }),
}));

jest.mock('../context/NotificacionContext', () => ({
  useNotificacion: () => ({ mostrarNotificacion: jest.fn() }),
}));

beforeEach(() => {
  mockSearchParams = new URLSearchParams();
});

describe('VistaAdministracion -- deep-link `?tab=` del acordeon mobile', () => {
  it('arranca en "Resumen" por defecto cuando no hay `?tab=`', () => {
    render(<VistaAdministracion />);
    expect(screen.getByText('Stub Dashboard')).toBeInTheDocument();
  });

  it('arranca directo en la pestaña indicada por `?tab=` al montar', () => {
    mockSearchParams = new URLSearchParams('tab=validar');
    render(<VistaAdministracion />);
    expect(screen.getByText('Stub Validar Pagos')).toBeInTheDocument();
  });

  // BUG REAL (reportado en vivo): "cualquier subitem elegido bajo Administracion llevaba
  // siempre a Resumen". Causa: el useState de activeTab solo leia `?tab=` al MONTAR --
  // Administracion es la pagina de entrada por defecto de varios roles, asi que ya estaba
  // montada de antes; tocar un subitem del acordeon mobile (misma ruta "/", distinto `?tab=`)
  // no la remontaba, asi que el efecto de sincronizacion es imprescindible.
  it('BUG REAL (reportado en vivo): cambia de tab cuando `?tab=` cambia con la vista ya montada, sin necesitar un remount', () => {
    const { rerender } = render(<VistaAdministracion />);
    expect(screen.getByText('Stub Dashboard')).toBeInTheDocument();

    mockSearchParams = new URLSearchParams('tab=tesoreria');
    rerender(<VistaAdministracion />);
    expect(screen.getByText('Stub Finanzas')).toBeInTheDocument();
    expect(screen.queryByText('Stub Dashboard')).not.toBeInTheDocument();

    mockSearchParams = new URLSearchParams('tab=historial');
    rerender(<VistaAdministracion />);
    expect(screen.getByText('Stub Historial')).toBeInTheDocument();
  });

  it('un `?tab=` invalido o desconocido cae al fallback "Resumen", nunca confia ciegamente en el query string', () => {
    mockSearchParams = new URLSearchParams('tab=algo-que-no-existe');
    render(<VistaAdministracion />);
    expect(screen.getByText('Stub Dashboard')).toBeInTheDocument();
  });
});
