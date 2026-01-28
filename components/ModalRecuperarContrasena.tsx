// components/ModalRecuperarContrasena.tsx
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useAuth } from '../context/AuthContext';
import { IconoCerrar, IconoEmail, IconoEnviar, IconoExitoAnimado } from './Iconos';
import FormInputError from './FormInputError';

interface Props {
  abierto: boolean;
  onCerrar: () => void;
}

const schema = yup.object({
    email: yup.string().email('Debe ser un correo válido.').required('El correo electrónico es obligatorio.'),
}).required();

type FormData = yup.InferType<typeof schema>;

const ModalRecuperarContrasena: React.FC<Props> = ({ abierto, onCerrar }) => {
    const [visible, setVisible] = useState(false);
    const [exito, setExito] = useState(false);
    const [errorApi, setErrorApi] = useState<string | null>(null);
    const { enviarEnlaceRecuperacion } = useAuth();

    const { register, handleSubmit, formState: { errors, isSubmitting, isValid }, reset } = useForm<FormData>({
        // FIX: Removed the explicit generic type argument from yupResolver to fix type compatibility issues with recent versions of react-hook-form and @hookform/resolvers.
        resolver: yupResolver(schema),
        mode: 'onChange',
    });

    useEffect(() => {
        if (abierto) {
            const timer = setTimeout(() => setVisible(true), 10);
            return () => clearTimeout(timer);
        } else {
            // Reset state on close animation end
            setTimeout(() => {
                reset({ email: '' });
                setExito(false);
                setErrorApi(null);
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
            await enviarEnlaceRecuperacion(data.email);
            setExito(true);
        } catch (err) {
            setErrorApi(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
        }
    };

    if (!abierto) return null;

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black transition-opacity duration-200 ease-out ${visible ? 'bg-opacity-60' : 'bg-opacity-0'}`} aria-modal="true" role="dialog" onClick={handleClose}>
            <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 transform transition-all duration-200 ease-out ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`} onClick={e => e.stopPropagation()}>
                <header className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-bold text-tkd-dark dark:text-white">Recuperar Contraseña</h2>
                    <button onClick={handleClose} className="p-1 rounded-full text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-600 transition-transform hover:scale-110 active:scale-100">
                        <IconoCerrar className="w-6 h-6" />
                    </button>
                </header>
                
                <div className="p-6">
                    {exito ? (
                        <div className="text-center">
                            <IconoExitoAnimado className="mx-auto text-green-500" />
                            <h3 className="text-xl font-bold text-green-600 mt-4">¡Correo Enviado!</h3>
                            <p className="mt-2 text-gray-700 dark:text-gray-300">
                                Si tu correo está registrado con nosotros, recibirás un enlace para restablecer tu contraseña en breve.
                            </p>
                            <button onClick={handleClose} className="mt-6 w-full bg-tkd-blue text-white py-2 px-4 rounded-md hover:bg-blue-800 transition-all duration-200 ease-in-out shadow-md">
                                Entendido
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Ingresa tu correo electrónico y te enviaremos un enlace para que puedas restablecer tu contraseña.
                            </p>
                             <div>
                                <label htmlFor="recovery-email" className="sr-only">Correo Electrónico</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                        <IconoEmail className="w-5 h-5 text-gray-400" />
                                    </div>
                                    <input
                                        id="recovery-email"
                                        type="email"
                                        className={`w-full py-3 pl-10 pr-4 text-gray-900 placeholder-gray-500 bg-white border rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white transition-colors ${errors.email ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-tkd-blue focus:border-tkd-blue'}`}
                                        placeholder="tu.correo@ejemplo.com"
                                        {...register('email')}
                                    />
                                </div>
                                <FormInputError mensaje={errors.email?.message} />
                            </div>
                            {errorApi && <p className="text-sm text-center text-tkd-red">{errorApi}</p>}
                            <div className="pt-2">
                                <button
                                type="submit"
                                disabled={isSubmitting || !isValid}
                                className="relative flex justify-center w-full px-4 py-3 text-sm font-semibold text-white border border-transparent rounded-md group bg-tkd-red hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-tkd-red transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95 shadow-md hover:shadow-lg space-x-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
                                >
                                <IconoEnviar className="w-5 h-5" />
                                <span>{isSubmitting ? 'Enviando...' : 'Enviar Enlace de Recuperación'}</span>
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ModalRecuperarContrasena;