import { registrarLeadPublico } from './leadsEventosApi';
import { collection, addDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';

// Mock the external dependencies
jest.mock('firebase/firestore', () => ({
    collection: jest.fn(),
    addDoc: jest.fn(),
}));

jest.mock('../firebase/config', () => ({
    db: {},
    isFirebaseConfigured: true,
}));

describe('leadsEventosApi', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('registrarLeadPublico', () => {
        const mockTenantId = 'tenant-123';
        const mockEventoId = 'evento-456';
        const mockLeadData = {
            nombre: '  Juan Perez  ',
            email: 'JUAN@Example.com ',
            whatsapp: ' 1234567890 ',
            clubOrigen: ' academia marcial  '
        };

        it('debe registrar un lead con los datos normalizados cuando firebase está configurado', async () => {
            const mockAddDoc = addDoc as jest.Mock;
            const mockCollection = collection as jest.Mock;
            
            mockCollection.mockReturnValue('mock-collection-ref');
            mockAddDoc.mockResolvedValue({ id: 'nuevo-lead-id' });

            await registrarLeadPublico(mockTenantId, mockEventoId, mockLeadData);

            expect(mockCollection).toHaveBeenCalledWith(db, 'leadsEventos');
            expect(mockAddDoc).toHaveBeenCalledWith('mock-collection-ref', {
                tenantId: mockTenantId,
                eventoId: mockEventoId,
                nombre: 'JUAN PEREZ',
                email: 'juan@example.com',
                whatsapp: '1234567890',
                clubOrigen: 'ACADEMIA MARCIAL',
                estado: 'Pendiente',
                fechaRegistro: expect.any(String)
            });
        });

        it('debe advertir en modo simulado si firebase no está configurado', async () => {
            // Overriding the mock for this specific test
            const originalConsoleWarn = console.warn;
            console.warn = jest.fn();
            
            // Temporary override of the mock using require
            jest.mocked(require('../firebase/config')).isFirebaseConfigured = false;

            await registrarLeadPublico(mockTenantId, mockEventoId, mockLeadData);

            expect(console.warn).toHaveBeenCalledWith(
                "MODO SIMULADO: Registrando lead público", 
                expect.objectContaining({
                    tenantId: mockTenantId,
                    eventoId: mockEventoId,
                    leadData: mockLeadData
                })
            );
            expect(addDoc).not.toHaveBeenCalled();

            // Restore for other tests
            console.warn = originalConsoleWarn;
            jest.mocked(require('../firebase/config')).isFirebaseConfigured = true;
        });

        it('debe propagar la excepción si ocurre un error en Firestore', async () => {
            const mockAddDoc = addDoc as jest.Mock;
            const mockCollection = collection as jest.Mock;
            
            mockCollection.mockReturnValue('mock-collection-ref');
            
            // Forzamos un error en la promesa de Firestore
            const errorMessage = 'Error simulado de base de datos o permisos';
            mockAddDoc.mockRejectedValue(new Error(errorMessage));

            // Aseguramos que la función lance el error para que el componente (EventoPublico) pueda capturarlo
            await expect(
                registrarLeadPublico(mockTenantId, mockEventoId, mockLeadData)
            ).rejects.toThrow(errorMessage);

            // Verificamos que al menos se intentó llamar a la colección
            expect(mockCollection).toHaveBeenCalledWith(db, 'leadsEventos');
        });
    });
});
