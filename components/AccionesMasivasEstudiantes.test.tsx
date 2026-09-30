import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AccionesMasivasEstudiantes from './AccionesMasivasEstudiantes';
import { EstadoPago, GradoTKD, GrupoEdad, type Estudiante } from '../tipos';

jest.mock('../servicios/estudiantesApi', () => ({}));

const crearEstudiante = (id: string, nombres: string): Estudiante => ({
    id, tenantId: 'tenant-1', nombres, apellidos: 'Test', numeroIdentificacion: `DOC-${id}`,
    telefono: '3000000000', correo: `${id}@test.com`, fechaNacimiento: '2010-01-01',
    grado: GradoTKD.Blanco, grupo: GrupoEdad.Cadetes, horasAcumuladasGrado: 0, sedeId: 'sede-1',
    fechaIngreso: '2024-01-01', estadoPago: EstadoPago.AlDia, saldoDeudor: 0, historialPagos: [],
    consentimientoInformado: false, contratoServiciosFirmado: false, consentimientoImagenFirmado: false,
    consentimientoFotosVideos: false, carnetGenerado: false, estadoMatricula: 'activo',
});

const ana = crearEstudiante('1', 'Ana');
const bruno = crearEstudiante('2', 'Bruno');
const carla = crearEstudiante('3', 'Carla');
const grupos = [{ id: 'grp-a', nombre: 'Avanzados' }, { id: 'grp-b', nombre: 'Infantil' }];

describe('AccionesMasivasEstudiantes', () => {
    const onAplicar = jest.fn();
    const onLimpiarSeleccion = jest.fn();
    const onNotificar = jest.fn();

    const renderizar = (seleccionados: Estudiante[] = [ana, bruno, carla]) => render(
        <AccionesMasivasEstudiantes
            seleccionados={seleccionados}
            gruposEntrenamiento={grupos}
            onAplicar={onAplicar}
            onLimpiarSeleccion={onLimpiarSeleccion}
            onNotificar={onNotificar}
        />
    );

    beforeEach(() => jest.clearAllMocks());

    it('no muestra la barra si no hay seleccionados', () => {
        const { container } = renderizar([]);
        expect(container).toBeEmptyDOMElement();
    });

    it('asignar grado: confirma con la cantidad y los nombres, aplica solo grado y limpia la selección al terminar bien', async () => {
        const user = userEvent.setup();
        onAplicar.mockResolvedValue({ exitosos: ['1', '2', '3'], fallidos: [] });
        renderizar();

        expect(screen.getByText('3 alumnos seleccionados')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Asignar grado' }));
        await user.selectOptions(screen.getByLabelText('Nuevo grado'), GradoTKD.Verde);
        await user.click(screen.getByRole('button', { name: 'Continuar' }));

        expect(screen.getByText(`Vas a cambiar el grado de 3 alumnos a ${GradoTKD.Verde}`)).toBeInTheDocument();
        const lista = screen.getByRole('list', { name: 'Alumnos a actualizar' });
        expect(within(lista).getAllByRole('listitem').map(li => li.textContent)).toEqual(['Ana Test', 'Bruno Test', 'Carla Test']);
        expect(onAplicar).not.toHaveBeenCalled();

        await user.click(screen.getByRole('button', { name: 'Confirmar' }));

        await waitFor(() => expect(onAplicar).toHaveBeenCalledWith(['1', '2', '3'], { campo: 'grado', valor: GradoTKD.Verde }));
        await waitFor(() => expect(onLimpiarSeleccion).toHaveBeenCalledTimes(1));
        expect(onNotificar).toHaveBeenCalledWith('3 alumnos actualizados.', 'success');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('asignar grupo de entrenamiento permite elegir "Sin grupo" (valor null)', async () => {
        const user = userEvent.setup();
        onAplicar.mockResolvedValue({ exitosos: ['1', '2', '3'], fallidos: [] });
        renderizar();

        await user.click(screen.getByRole('button', { name: 'Asignar grupo de entrenamiento' }));
        const select = screen.getByLabelText('Nuevo grupo de entrenamiento');
        expect(within(select).getAllByRole('option').map(o => o.textContent)).toEqual(['Sin grupo', 'Avanzados', 'Infantil']);
        await user.click(screen.getByRole('button', { name: 'Continuar' }));
        expect(screen.getByText('Vas a cambiar el grupo de entrenamiento de 3 alumnos a Sin grupo')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Confirmar' }));

        await waitFor(() => expect(onAplicar).toHaveBeenCalledWith(['1', '2', '3'], { campo: 'grupoEntrenamientoId', valor: null }));
    });

    it('fallo parcial: muestra "X actualizados, Y fallaron" con los nombres y reintenta SOLO los fallidos', async () => {
        const user = userEvent.setup();
        onAplicar
            .mockResolvedValueOnce({ exitosos: ['1'], fallidos: [{ id: '2', error: 'red' }, { id: '3', error: 'permiso' }] })
            .mockResolvedValueOnce({ exitosos: ['3'], fallidos: [{ id: '2', error: 'red' }] })
            .mockResolvedValueOnce({ exitosos: ['2'], fallidos: [] });
        renderizar();

        await user.click(screen.getByRole('button', { name: 'Asignar grupo de entrenamiento' }));
        await user.selectOptions(screen.getByLabelText('Nuevo grupo de entrenamiento'), 'grp-a');
        await user.click(screen.getByRole('button', { name: 'Continuar' }));
        expect(screen.getByText('Vas a cambiar el grupo de entrenamiento de 3 alumnos a Avanzados')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Confirmar' }));

        expect(await screen.findByText('1 actualizados, 2 fallaron')).toBeInTheDocument();
        const fallidos = screen.getByRole('list', { name: 'Alumnos que fallaron' });
        expect(within(fallidos).getAllByRole('listitem').map(li => li.textContent)).toEqual(['Bruno Test', 'Carla Test']);
        expect(onLimpiarSeleccion).not.toHaveBeenCalled();

        await user.click(screen.getByRole('button', { name: 'Reintentar fallidos' }));
        await waitFor(() => expect(onAplicar).toHaveBeenNthCalledWith(2, ['2', '3'], { campo: 'grupoEntrenamientoId', valor: 'grp-a' }));
        expect(await screen.findByText('2 actualizados, 1 fallaron')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Reintentar fallidos' }));
        await waitFor(() => expect(onAplicar).toHaveBeenNthCalledWith(3, ['2'], { campo: 'grupoEntrenamientoId', valor: 'grp-a' }));
        await waitFor(() => expect(onLimpiarSeleccion).toHaveBeenCalledTimes(1));
        expect(onNotificar).toHaveBeenCalledWith('3 alumnos actualizados.', 'success');
    });

    it('cerrar el resultado con fallidos limpia la selección sin reintentar', async () => {
        const user = userEvent.setup();
        onAplicar.mockResolvedValueOnce({ exitosos: [], fallidos: [{ id: '1', error: 'x' }] });
        renderizar([ana]);

        await user.click(screen.getByRole('button', { name: 'Asignar grado' }));
        await user.click(screen.getByRole('button', { name: 'Continuar' }));
        expect(screen.getByText(`Vas a cambiar el grado de 1 alumno a ${GradoTKD.Blanco}`)).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Confirmar' }));
        expect(await screen.findByText('0 actualizados, 1 fallaron')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Cerrar' }));
        expect(onAplicar).toHaveBeenCalledTimes(1);
        expect(onLimpiarSeleccion).toHaveBeenCalledTimes(1);
    });

    it('cancelar antes de confirmar no escribe nada', async () => {
        const user = userEvent.setup();
        renderizar();
        await user.click(screen.getByRole('button', { name: 'Asignar grado' }));
        await user.click(screen.getByRole('button', { name: 'Cancelar' }));
        expect(onAplicar).not.toHaveBeenCalled();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
