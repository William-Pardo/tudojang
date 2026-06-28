import { obtenerBanderasAsistente } from './flags';

describe('rollback flags del asistente', () => {
    afterEach(() => {
        delete (window as any).__ASSISTANT_FLAGS__;
    });

    it('mantiene catálogo y escalamiento habilitados, pero IA apagada por defecto', () => {
        expect(obtenerBanderasAsistente()).toEqual({
            catalogEnabled: true,
            aiEnabled: false,
            escalationEnabled: true,
        });
    });

    it('permite apagar IA y escalamiento sin apagar el catálogo', () => {
        (window as any).__ASSISTANT_FLAGS__ = {
            aiEnabled: false,
            escalationEnabled: false,
        };

        expect(obtenerBanderasAsistente()).toEqual({
            catalogEnabled: true,
            aiEnabled: false,
            escalationEnabled: false,
        });
    });
});
