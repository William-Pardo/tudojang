import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GestionGruposEntrenamiento from './GestionGruposEntrenamiento';

const grupos = [{ id: 'grp-a', nombre: 'Infantil' }, { id: 'grp-b', nombre: 'Avanzados' }];
const estudiantes = [{ grupoEntrenamientoId: 'grp-b' }, { grupoEntrenamientoId: 'grp-b' }, {}];

describe('GestionGruposEntrenamiento', () => {
    const onGuardar = jest.fn();
    const onNotificar = jest.fn();

    const renderizar = (lista = grupos) => render(
        <GestionGruposEntrenamiento grupos={lista} estudiantes={estudiantes} onGuardar={onGuardar} onNotificar={onNotificar} />
    );

    beforeEach(() => {
        jest.clearAllMocks();
        onGuardar.mockResolvedValue(undefined);
    });

    it('lista los grupos con su conteo de alumnos', () => {
        renderizar();
        expect(screen.getByText('Infantil')).toBeInTheDocument();
        expect(screen.getByText('0 alumnos')).toBeInTheDocument();
        expect(screen.getByText('2 alumnos')).toBeInTheDocument();
    });

    it('crea un grupo nuevo y persiste el catálogo completo', async () => {
        const user = userEvent.setup();
        renderizar();

        await user.type(screen.getByPlaceholderText(/Nombre del grupo/), 'Junior y Mayores');
        await user.click(screen.getByRole('button', { name: /Crear grupo/ }));

        await waitFor(() => expect(onGuardar).toHaveBeenCalledTimes(1));
        const guardado = onGuardar.mock.calls[0][0];
        expect(guardado.slice(0, 2)).toEqual(grupos);
        expect(guardado[2]).toEqual({ id: expect.stringMatching(/^grp-/), nombre: 'Junior y Mayores' });
        expect(onNotificar).toHaveBeenCalledWith('Grupo creado.', 'success');
        expect(screen.getByPlaceholderText(/Nombre del grupo/)).toHaveValue('');
    });

    it('no persiste un nombre duplicado y avisa', async () => {
        const user = userEvent.setup();
        renderizar();

        await user.type(screen.getByPlaceholderText(/Nombre del grupo/), 'avanzados');
        await user.click(screen.getByRole('button', { name: /Crear grupo/ }));

        expect(onGuardar).not.toHaveBeenCalled();
        expect(onNotificar).toHaveBeenCalledWith('Ya existe un grupo llamado "avanzados".', 'warning');
    });

    it('renombra conservando el id', async () => {
        const user = userEvent.setup();
        renderizar();

        await user.click(screen.getByRole('button', { name: 'Renombrar Avanzados' }));
        const input = screen.getByLabelText('Nuevo nombre para Avanzados');
        await user.clear(input);
        await user.type(input, 'Avanzados Élite');
        await user.click(screen.getByRole('button', { name: 'Guardar' }));

        await waitFor(() => expect(onGuardar).toHaveBeenCalledWith([
            { id: 'grp-a', nombre: 'Infantil' },
            { id: 'grp-b', nombre: 'Avanzados Élite' },
        ]));
    });

    it('al eliminar un grupo con alumnos avisa el conteo y solo lo quita del catálogo', async () => {
        const user = userEvent.setup();
        renderizar();

        await user.click(screen.getByRole('button', { name: 'Eliminar Avanzados' }));
        expect(screen.getByText(/tiene 2 alumnos asignados/)).toBeInTheDocument();
        expect(screen.getByText(/quedarán como "Sin grupo"/)).toBeInTheDocument();
        expect(onGuardar).not.toHaveBeenCalled();

        await user.click(screen.getByRole('button', { name: 'Eliminar' }));

        await waitFor(() => expect(onGuardar).toHaveBeenCalledWith([{ id: 'grp-a', nombre: 'Infantil' }]));
    });

    it('al eliminar un grupo vacío no menciona alumnos', async () => {
        const user = userEvent.setup();
        renderizar();
        await user.click(screen.getByRole('button', { name: 'Eliminar Infantil' }));
        expect(screen.getByText('¿Eliminar el grupo "Infantil"?')).toBeInTheDocument();
    });

    it('si el guardado falla muestra el error y conserva lo escrito', async () => {
        const user = userEvent.setup();
        onGuardar.mockRejectedValueOnce(new Error('[tenants] permission-denied'));
        renderizar([]);

        await user.type(screen.getByPlaceholderText(/Nombre del grupo/), 'Infantil');
        await user.click(screen.getByRole('button', { name: /Crear grupo/ }));

        await waitFor(() => expect(onNotificar).toHaveBeenCalledWith('No se pudo guardar el grupo: [tenants] permission-denied.', 'error'));
        expect(screen.getByPlaceholderText(/Nombre del grupo/)).toHaveValue('Infantil');
    });
});
