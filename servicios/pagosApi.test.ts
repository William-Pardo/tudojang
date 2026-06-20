import { procesarPagoEfectivo, anularUltimoPagoEfectivo, anularPagoEfectivo } from './pagosApi';
import { db, isFirebaseConfigured } from '../firebase/config';
import { getDoc, getDocs, doc, writeBatch, collection, query, where } from 'firebase/firestore';

// Mocks
jest.mock('firebase/firestore', () => ({
    collection: jest.fn(),
    doc: jest.fn(),
    getDoc: jest.fn(),
    getDocs: jest.fn(),
    addDoc: jest.fn(),
    updateDoc: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
    writeBatch: jest.fn()
}));

jest.mock('../firebase/config', () => ({
    db: {},
    isFirebaseConfigured: true
}));

describe('pagosApi - Sistema Financiero (con Triangulación)', () => {
    let mockBatch: any;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockBatch = {
            set: jest.fn(),
            update: jest.fn(),
            commit: jest.fn().mockResolvedValue(true)
        };
        (writeBatch as jest.Mock).mockReturnValue(mockBatch);
    });

    describe('procesarPagoEfectivo (Triangulación de Saldos)', () => {
        const mockEstudianteRef = { id: 'est-1' };
        
        it('Caso 1: Pago exacto de la deuda (Saldo resultante = 0)', async () => {
            (doc as jest.Mock).mockReturnValue(mockEstudianteRef);
            (getDoc as jest.Mock).mockResolvedValue({
                exists: () => true,
                id: 'est-1',
                data: () => ({ saldoDeudor: 1000, tenantId: 't-1' })
            });

            const res = await procesarPagoEfectivo('est-1', [], 1000, 'Pago Total');
            
            expect(res.exito).toBe(true);
            expect(res.nuevoSaldo).toBe(0);
            expect(mockBatch.update).toHaveBeenCalledWith(mockEstudianteRef, expect.objectContaining({
                saldoDeudor: 0,
                estadoPago: 'Al Día'
            }));
        });

        it('Caso 2: Pago parcial de la deuda (Saldo resultante > 0)', async () => {
            (doc as jest.Mock).mockReturnValue(mockEstudianteRef);
            (getDoc as jest.Mock).mockResolvedValue({
                exists: () => true,
                id: 'est-1',
                data: () => ({ saldoDeudor: 1000, tenantId: 't-1' })
            });

            const res = await procesarPagoEfectivo('est-1', [], 500, 'Pago Parcial');
            
            expect(res.exito).toBe(true);
            expect(res.nuevoSaldo).toBe(500);
            expect(mockBatch.update).toHaveBeenCalledWith(mockEstudianteRef, expect.objectContaining({
                saldoDeudor: 500,
                estadoPago: 'Pendiente'
            }));
        });

        it('Caso 3: Pago mayor a la deuda (El sistema asume tope en 0 para evitar negativos sueltos)', async () => {
            (doc as jest.Mock).mockReturnValue(mockEstudianteRef);
            (getDoc as jest.Mock).mockResolvedValue({
                exists: () => true,
                id: 'est-1',
                data: () => ({ saldoDeudor: 1000, tenantId: 't-1' })
            });

            const res = await procesarPagoEfectivo('est-1', [], 1500, 'Pago Excesivo');
            
            expect(res.exito).toBe(true);
            expect(res.nuevoSaldo).toBe(0);
            expect(mockBatch.update).toHaveBeenCalledWith(mockEstudianteRef, expect.objectContaining({
                saldoDeudor: 0,
                estadoPago: 'Al Día'
            }));
        });

        it('Debe revertir si hay fallo en base de datos (Unhappy path - Excepción)', async () => {
            (getDoc as jest.Mock).mockRejectedValue(new Error("Fallo de red simulado"));

            const res = await procesarPagoEfectivo('est-1', [], 1000, 'Pago Fallido');
            
            expect(res.exito).toBe(false);
            expect(res.mensaje).toBe("Fallo de red simulado");
            expect(mockBatch.commit).not.toHaveBeenCalled();
        });
    });

    describe('anularPagoEfectivo (Transaction Log y Reversión)', () => {
        const mockTransaccionRef = { id: 'trx-1' };
        const mockEstudianteRef = { id: 'est-1' };

        it('Debe anular correctamente una transacción, devolviendo el saldo y re-activando la deuda (Unhappy path -> Happy path)', async () => {
            (doc as jest.Mock)
                .mockReturnValueOnce(mockTransaccionRef) // Primera llamada: transaccion
                .mockReturnValueOnce(mockEstudianteRef)  // Segunda: estudiante
                .mockReturnValueOnce({ id: 'tienda-1' });// Tercera: item de tienda
                
            (getDoc as jest.Mock)
                .mockResolvedValueOnce({ // Transacción
                    exists: () => true,
                    id: 'trx-1',
                    data: () => ({
                        estado: 'Completado',
                        estudianteId: 'est-1',
                        montoTotal: 500,
                        tenantId: 't-1',
                        itemsPagados: [{ id: 'tienda-1', tipo: 'Tienda', monto: 500 }]
                    })
                })
                .mockResolvedValueOnce({ // Estudiante
                    exists: () => true,
                    id: 'est-1',
                    data: () => ({ saldoDeudor: 0 })
                });

            const res = await anularPagoEfectivo('trx-1', 'admin-1');

            expect(res.exito).toBe(true);
            // Verifica que el saldo volvió a ser 500
            expect(mockBatch.update).toHaveBeenCalledWith(mockEstudianteRef, expect.objectContaining({
                saldoDeudor: 500,
                estadoPago: 'Pendiente'
            }));
            // Verifica que la compra en tienda vuelva a pagado: false
            expect(mockBatch.update).toHaveBeenCalledWith({ id: 'tienda-1' }, { pagado: false });
            // Verifica que la transacción quedó anulada
            expect(mockBatch.update).toHaveBeenCalledWith(mockTransaccionRef, { estado: 'Anulado' });
            // Verifica commit
            expect(mockBatch.commit).toHaveBeenCalled();
        });

        it('Debe lanzar excepción si la transacción ya está anulada', async () => {
            (doc as jest.Mock).mockReturnValue(mockTransaccionRef);
            (getDoc as jest.Mock).mockResolvedValueOnce({
                exists: () => true,
                id: 'trx-1',
                data: () => ({ estado: 'Anulado' })
            });

            const res = await anularPagoEfectivo('trx-1');

            expect(res.exito).toBe(false);
            expect(res.mensaje).toBe("La transacción ya se encuentra anulada");
            expect(mockBatch.commit).not.toHaveBeenCalled();
        });
    });
});
