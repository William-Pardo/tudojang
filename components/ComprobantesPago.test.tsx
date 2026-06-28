import React from 'react';
import { act, render, renderHook, screen } from '@testing-library/react';
import html2canvas from 'html2canvas';
import type { DatosComprobante } from './ComprobantesPago';

jest.mock('html2canvas', () => jest.fn());

const datos: DatosComprobante = {
  reciboId: 'REC-1', fechaHora: '2026-06-20T10:30:00Z', nombreEstudiante: 'Ana Pérez',
  nombreTutor: 'Tutor Pérez', telefonoTutor: '3001234567',
  itemsPagados: [{ descripcion: 'Mensualidad', tipo: 'Mensualidad', monto: 100 }],
  montoTotal: 100, metodoPago: 'Efectivo', concepto: 'Pago junio',
};
const config: any = { nombreClub: 'Club Test', colorPrimario: '#111111', colorSecundario: '#222222', logoUrl: '/logo.png' };
const actual = jest.requireActual('./ComprobantesPago') as typeof import('./ComprobantesPago');
const PlantillaComprobante = actual.default;
const useGeneradorComprobante = actual.useGeneradorComprobante;

describe('ComprobantesPago', () => {
  beforeEach(() => { jest.clearAllMocks(); jest.useFakeTimers(); });
  afterEach(() => jest.useRealTimers());

  it('renderiza el recibo completo y datos opcionales', () => {
    render(<PlantillaComprobante datos={datos} config={config} compRef={{ current: null }} />);
    expect(screen.getByText('REC-1')).toBeInTheDocument();
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.getByText('Tutor: Tutor Pérez')).toBeInTheDocument();
    expect(screen.getByText('3001234567')).toBeInTheDocument();
    expect(screen.getByText('Mensualidad')).toBeInTheDocument();
    expect(screen.getByText('Club Test')).toBeInTheDocument();
  });

  it('usa valores visuales por defecto y omite tutor/teléfono', () => {
    render(<PlantillaComprobante datos={{ ...datos, nombreTutor: undefined, telefonoTutor: undefined }} config={{}} compRef={{ current: null }} />);
    expect(screen.getByText('Mi Academia')).toBeInTheDocument();
    expect(screen.queryByText(/Tutor:/)).not.toBeInTheDocument();
    expect(screen.getByAltText('Logo')).toHaveAttribute('src', '/Logo_TuDojang.png');
  });

  it('genera una imagen y limpia el DOM', async () => {
    (html2canvas as jest.Mock).mockResolvedValue({ toDataURL: () => 'data:image/png;base64,ok' });
    const { result } = renderHook(() => useGeneradorComprobante());
    const promise = result.current.generarImagen(datos, config);
    await Promise.resolve();
    const host = document.querySelector('div[style*="-9999px"]')!;
    if (!host.firstChild) host.appendChild(document.createElement('div'));
    await act(async () => { await Promise.resolve(); await jest.runOnlyPendingTimersAsync(); });
    await expect(promise).resolves.toBe('data:image/png;base64,ok');
    expect(document.querySelector('div[style*="-9999px"]')).not.toBeInTheDocument();
  });

  it('controla errores de canvas y elemento ausente', async () => {
    (html2canvas as jest.Mock).mockRejectedValueOnce(new Error('canvas falló'));
    const { result } = renderHook(() => useGeneradorComprobante());
    let promise = result.current.generarImagen(datos, config);
    await Promise.resolve();
    let host = document.querySelector('div[style*="-9999px"]')!;
    if (!host.firstChild) host.appendChild(document.createElement('div'));
    await act(async () => { await Promise.resolve(); await jest.runOnlyPendingTimersAsync(); });
    await expect(promise).resolves.toBeNull();
    const append = jest.spyOn(Element.prototype, 'appendChild').mockImplementationOnce(node => node);
    promise = result.current.generarImagen(datos, config);
    await act(async () => { await Promise.resolve(); await jest.runOnlyPendingTimersAsync(); });
    await expect(promise).resolves.toBeNull();
    append.mockRestore();
  });

  it('descarga el comprobante cuando existe imagen y no descarga si falla', async () => {
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation();
    (html2canvas as jest.Mock).mockResolvedValueOnce({ toDataURL: () => 'data:image/png,ok' });
    const { result } = renderHook(() => useGeneradorComprobante());
    let promise = result.current.descargarComprobante(datos, config);
    await Promise.resolve();
    let host = document.querySelector('div[style*="-9999px"]')!;
    if (!host.firstChild) host.appendChild(document.createElement('div'));
    await act(async () => { await Promise.resolve(); await jest.runOnlyPendingTimersAsync(); });
    await promise;
    expect(click).toHaveBeenCalled();
    const append = jest.spyOn(Element.prototype, 'appendChild').mockImplementationOnce(node => node);
    promise = result.current.descargarComprobante(datos, config);
    await act(async () => { await Promise.resolve(); await jest.runOnlyPendingTimersAsync(); });
    await promise;
    append.mockRestore();
  });

  it('descarga y abre WhatsApp, incluso si no se genera imagen', async () => {
    const open = jest.spyOn(window, 'open').mockImplementation();
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation();
    (html2canvas as jest.Mock).mockResolvedValueOnce({ toDataURL: () => 'data:image/png,ok' });
    const { result } = renderHook(() => useGeneradorComprobante());
    let promise = result.current.compartirPorWhatsApp(datos, config, '+57 300-123');
    await Promise.resolve();
    let host = document.querySelector('div[style*="-9999px"]')!;
    if (!host.firstChild) host.appendChild(document.createElement('div'));
    await act(async () => { await Promise.resolve(); await jest.runOnlyPendingTimersAsync(); });
    await promise;
    await act(async () => jest.runOnlyPendingTimersAsync());
    expect(open).toHaveBeenCalledWith(expect.stringContaining('57300123'), '_blank');
    const append = jest.spyOn(Element.prototype, 'appendChild').mockImplementationOnce(node => node);
    promise = result.current.compartirPorWhatsApp({ ...datos, nombreEstudiante: '', nombreTutor: '' }, config, '1');
    await act(async () => { await Promise.resolve(); await jest.runOnlyPendingTimersAsync(); });
    await promise;
    await act(async () => jest.runOnlyPendingTimersAsync());
    append.mockRestore();
    expect(open).toHaveBeenCalledTimes(2);
  });
});
