// components/ModalSolicitarInscripcion.tsx
// Modal para que un usuario público solicite la inscripción a un evento.

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import type { Evento } from '../tipos';
import { crearSolicitudInscripcion } from '../servicios/api';
import { IconoCerrar, IconoEnviar } from './Iconos';
import FormInputError from './FormInputError';

interface Props {
    abierto: boolean;
    onCerrar: () => void;
    evento: Evento;
}

const schema = yup.object({
    numIdentificacion: yup.string().trim().required('El número de identificación es obligatorio.'),
}).required();

type FormData = yup.InferType<typeof schema>;

const ModalSolicitarInscripcion: React.FC<Props> = ({ abierto, onCerrar, evento }) => {
    const [errorApi, setErrorApi] = useState<string | null>(null);
    const [exito, setExito] = useState(false);
    const [visible, setVisible] = useState(false);

    const { register, handleSubmit, formState: { errors, isSubmitting, isValid }, reset } = useForm<FormData>({
        // FIX: Removed the explicit generic type argument from yupResolver to fix type compatibility issues with recent versions of react-hook-form and @hookform/resolvers.
        resolver: yupResolver(schema),
        mode: 'onChange',
        defaultValues: {
            numIdentificacion: ''
        }
    });

    useEffect(() => {
        if (abierto) {
          const timer = setTimeout(() => setVisible(true), 10);
          return () => clearTimeout(timer);
        } else {
          setTimeout(() => {
            setExito(false);
            setErrorApi(null);
            reset();
          }, 200);
        }
      }, [abierto, reset]);
    
      const handleClose = () => {
        setVisible(false);
        setTimeout(() => onCerrar(), 200);
      };

    const onSubmit = async (data: FormData) => {
        setErrorApi(null);
        try {
            await crearSolicitudInscripcion(evento.id, data.numIdentificacion);
            setExito(true);
        } catch (err) {
            setErrorApi(err instanceof Error ? err.message : "Error desconocido");
        }
    };

    if (!abierto) return null;

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black transition-opacity duration-200 ease-out ${visible ? 'bg-opacity-60' : 'bg-opacity-0'}`} aria-modal="true" role="dialog" onClick={handleClose}>
            <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md m-4 transform transition-all duration-200 ease-out ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`} onClick={e => e.stopPropagation()}>
                <header className="flex items-center justify-between p-4 border-b dark:border-gray-700">
                    <h2 className="text-lg font-bold text-tkd-dark dark:text-white">Solicitar Inscripción</h2>
                    <button onClick={handleClose} className="p-1 rounded-full text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-transform hover:scale-110 active:scale-100"><IconoCerrar className="w-6 h-6" /></button>
                </header>
                <div className="p-6">
                    {exito ? (
                        <div className="text-center">
                            <h3 className="text-xl font-bold text-green-600">¡Solicitud Enviada!</h3>
                            <p className="mt-2 text-gray-700 dark:text-gray-300">Tu solicitud para inscribirte en "{evento.nombre}" ha sido enviada. Recibirás una notificación cuando sea aprobada por un administrador.</p>
                            <button onClick={handleClose} className="mt-4 w-full bg-tkd-blue text-white py-2 px-4 rounded-md hover:bg-blue-800 transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95">Cerrar</button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit(onSubmit)}>
                            <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">Introduce el número de identificación del estudiante para solicitar la inscripción en "{evento.nombre}".</p>
                            <div>
                                <label htmlFor="numIdentificacion" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Número de Identificación</label>
                                <input
                                    type="text"
                                    id="numIdentificacion"
                                    {...register('numIdentificacion')}
                                    className={`mt-1 block w-full border rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-colors focus:ring-tkd-blue focus:border-tkd-blue ${errors.numIdentificacion ? 'border-red-500' : 'border-gray-300'}`}
                                />
                                <FormInputError mensaje={errors.numIdentificacion?.message} />
                            </div>
                            {errorApi && <p className="text-red-500 text-sm mt-2">{errorApi}</p>}
                            <div className="mt-6 flex justify-end space-x-3">
                                <button type="button" onClick={handleClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95">Cancelar</button>
                                <button type="submit" disabled={isSubmitting || !isValid} className="bg-tkd-red text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:bg-gray-400 transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95 inline-flex items-center space-x-2">
                                    <IconoEnviar className="w-5 h-5"/>
                                    <span>{isSubmitting ? "Enviando..." : "Enviar Solicitud"}</span>
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ModalSolicitarInscripcion;