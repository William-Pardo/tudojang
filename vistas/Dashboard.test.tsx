// vistas/Dashboard.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
// FIX: Changed to namespace import to fix module resolution issues.
import * as ReactRouterDOM from 'react-router-dom';
// FIX: Added 'expect' to the import from '@jest/globals' to resolve type inference issues with jest-dom matchers.
import { describe, it, jest, expect } from '@jest/globals';
import VistaDashboard from './Dashboard';
import { useDashboard } from '../hooks/useDashboard';
import { EstadoPago, GrupoEdad, EstadoSolicitudCompra } from '../tipos';

// Mockear el hook y sus dependencias
jest.mock('../hooks/useDashboard');
jest.mock('../context/NotificacionContext', () => ({
    useNotificacion: () => ({
        mostrarNotificacion: jest.fn(),
    }),
}));
jest.mock('../servicios/geminiService');

const useDashboardMock = useDashboard as jest.Mock;

describe('VistaDashboard', () => {
  
  const mockEstudiantes = [
    { id: '1', nombres: 'Estudiante 1', apellidos: 'Test', estadoPago: EstadoPago.AlDia, saldoDeudor: 0, fechaIngreso: '2023-01-01', grupo: GrupoEdad.Cadetes },
    { id: '2', nombres: 'Estudiante 2', apellidos: 'Test', estadoPago: EstadoPago.Pendiente, saldoDeudor: 100, fechaIngreso: '2023-02-01', grupo: GrupoEdad.Precadetes },
  ];
  const mockEventos = [
      { id: 'evt1', nombre: 'Torneo 1', fechaEvento: '2099-12-01', lugar: 'Coliseo' },
  ];

  it('muestra el loader mientras los datos están cargando', () => {
    useDashboardMock.mockReturnValue({
      cargando: true,
      error: null,
      solicitudesCompra: [],
      filtros: {},
      filtrosActivos: false,
      datosFiltrados: { estudiantesFiltrados: [], eventosParaMostrar: [] },
    });
    render(<VistaDashboard />);
    expect(screen.getByText('Cargando dashboard...')).toBeInTheDocument();
  });

  it('muestra un mensaje de error si la carga falla', () => {
    useDashboardMock.mockReturnValue({
      cargando: false,
      error: 'Error de red simulado',
      recargarTodo: jest.fn(),
      solicitudesCompra: [],
      filtros: {},
      filtrosActivos: false,
      datosFiltrados: { estudiantesFiltrados: [], eventosParaMostrar: [] },
    });
    render(<VistaDashboard />);
    expect(screen.getByText('¡Ups! Algo salió mal')).toBeInTheDocument();
    expect(screen.getByText('Error de red simulado')).toBeInTheDocument();
  });

  it('renderiza el dashboard con datos mockeados', () => {
    useDashboardMock.mockReturnValue({
      cargando: false,
      error: null,
      solicitudesCompra: [],
      filtros: { fechaInicio: '', fechaFin: '', grupo: 'todos' },
      filtrosActivos: false,
      datosFiltrados: { estudiantesFiltrados: mockEstudiantes, eventosParaMostrar: mockEventos },
      cargandoAccion: {},
      recargarTodo: jest.fn(),
      manejarGestionCompra: jest.fn(),
      handleFiltroChange: jest.fn(),
      limpiarFiltros: jest.fn(),
    });

    render(
      <ReactRouterDOM.MemoryRouter>
        <VistaDashboard />
      </ReactRouterDOM.MemoryRouter>
    );

    // Titulo
    expect(screen.getByRole('heading', { name: /Dashboard/i })).toBeInTheDocument();

    // KPIs (ResumenKPIs)
    expect(screen.getByText('Total de Estudiantes')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // 2 estudiantes
    expect(screen.getByText('Pagos Pendientes')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument(); // 1 pendiente

    // Eventos (ProximosEventos)
    expect(screen.getByText('Próximos Eventos')).toBeInTheDocument();
    expect(screen.getByText('Torneo 1')).toBeInTheDocument();

    // Pagos (ResumenPagos)
    expect(screen.getByText('Distribución de Estudiantes')).toBeInTheDocument();

    // Accesos Directos
    expect(screen.getByText('Accesos Directos')).toBeInTheDocument();
    expect(screen.getByText('Gestionar Estudiantes')).toBeInTheDocument();
  });
  
  it('muestra las solicitudes de compra pendientes si existen', () => {
    const mockSolicitudes = [{
      id: 'sc-1',
      estudiante: { id: '1', nombres: 'Solicitante', apellidos: 'Test', estadoPago: EstadoPago.AlDia, saldoDeudor: 0, fechaIngreso: '2023-01-01', grupo: GrupoEdad.Cadetes, tutor: {nombres: 'Tutor', apellidos: 'Test'} },
      implemento: { id: 'imp-1', nombre: 'Pechera' },
      variacion: { id: 'v-1', descripcion: 'Talla M', precio: 150000 },
      fechaSolicitud: '2024-01-01',
      estado: EstadoSolicitudCompra.Pendiente,
    }];
    
     useDashboardMock.mockReturnValue({
      cargando: false,
      error: null,
      solicitudesCompra: mockSolicitudes,
      filtros: { fechaInicio: '', fechaFin: '', grupo: 'todos' },
      filtrosActivos: false,
      datosFiltrados: { estudiantesFiltrados: mockEstudiantes, eventosParaMostrar: mockEventos },
      cargandoAccion: {},
      manejarGestionCompra: jest.fn(),
    });
    
    render(
      <ReactRouterDOM.MemoryRouter>
        <VistaDashboard />
      </ReactRouterDOM.MemoryRouter>
    );
    
    expect(screen.getByText(/Solicitudes de Compra Pendientes/)).toBeInTheDocument();
    expect(screen.getByText(/Solicitante Test quiere comprar Pechera/)).toBeInTheDocument();
  });
});