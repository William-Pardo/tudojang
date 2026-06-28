import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GeneradorQR from './GeneradorQR';
import { exportarCarnetAPdf } from '../utils/pdfGenerator';
const notificar = jest.fn();
jest.mock('qrcode.react', () => ({ QRCodeSVG: (p: any) => <div data-testid="qr">{p.value}-{p.fgColor}</div> }));
jest.mock('../context/DataContext', () => ({ useSedes: () => ({ sedesVisibles: [{ id: 's1', nombre: 'Norte' }] }), useConfiguracion: () => ({ configClub: { nombreClub: 'Club', colorPrimario: '#111', colorSecundario: '#222' } }) }));
jest.mock('../context/NotificacionContext', () => ({ useNotificacion: () => ({ mostrarNotificacion: notificar }) }));
jest.mock('../utils/pdfGenerator', () => ({ exportarCarnetAPdf: jest.fn() }));
jest.mock('./LogoDinamico', () => () => <div>Logo</div>);
jest.mock('../utils/beltStyles', () => ({ getBeltStyle: () => ({ background: 'white', color: 'black' }) }));
const e: any = { id: 'e1', nombres: 'Ana', apellidos: 'Pérez', numeroIdentificacion: '123', sedeId: 's1', grado: 'Blanco', fechaIngreso: '2026' };
describe('GeneradorQR', () => {
 beforeEach(() => jest.clearAllMocks());
 it('renderiza QR dinámico y fallback de sede', () => { const { rerender }=render(<GeneradorQR estudiante={e}/>); expect(screen.getByTestId('qr')).toHaveTextContent('e1-#111'); expect(screen.getByText('Norte')).toBeInTheDocument(); rerender(<GeneradorQR estudiante={{...e,sedeId:'x'}}/>); expect(screen.getByText('Sede Principal')).toBeInTheDocument(); });
 it('exporta y controla error', async()=>{ const u=userEvent.setup(); (exportarCarnetAPdf as jest.Mock).mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error()); const {unmount}=render(<GeneradorQR estudiante={e}/>); await u.click(screen.getByRole('button')); await waitFor(()=>expect(notificar).toHaveBeenCalledWith('Carnet generado con éxito','success')); unmount(); render(<GeneradorQR estudiante={e}/>); await u.click(screen.getByRole('button')); await waitFor(()=>expect(notificar).toHaveBeenCalledWith('Error al generar el carnet','error')); });
});
