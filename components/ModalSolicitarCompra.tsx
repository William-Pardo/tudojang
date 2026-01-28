
// components/ModalSolicitarCompra.tsx
// Modal para que el cliente (tutor) solicite la compra de un implemento.

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import type { Implemento, VariacionImplemento, Estudiante } from '../tipos';
import { TipoNotificacion } from '../tipos';
import { crearSolicitudCompra, enviarNotificacion } from '../servicios/api';
// Added comment above fix: Imported useConfiguracion to provide required configClub to generating personalized messages.
import { useConfiguracion } from '../context/DataContext';
import { generarMensajePersonalizado } from '../servicios/geminiService';
import { ADMIN_WHATSAPP } from '../constantes';
import { IconoCerrar, IconoEnviar } from './Iconos';
import { formatearPrecio } from '../utils/formatters';
import FormInputError from './FormInputError';

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  implemento: Implemento;
  variacion: VariacionImplemento;
}

const schema = yup.object({
    numIdentificacion: yup.string().trim().required('El número de identificación es obligatorio.'),
}).required();

type FormData = yup.InferType<typeof schema>;

const ModalSolicitarCompra: React.FC<Props> = ({ abierto, onCerrar, implemento, variacion }) => {
  const [errorApi, setErrorApi] = useState<string | null>(null);
  const [exito, setExito] = useState(false);
  const [visible, setVisible] = useState(false);
  // Added comment above fix: Destructured configClub from useConfiguracion.
  const { configClub } = useConfiguracion();

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
      const solicitud = await crearSolicitudCompra(data.numIdentificacion, implemento, variacion);
      setExito(true);

      try {
        const concepto = `${implemento.nombre} (${variacion.descripcion})`;
        // Added comment above fix: Passed configClub as 3rd argument to generating personalized messages.
        const mensajeAdmin = await generarMensajePersonalizado(
          TipoNotificacion.SolicitudCompraAdmin,
          solicitud.estudiante as any as Estudiante,
          configClub,
          { concepto }
        );
        // No esperar la notificación para dar respuesta al usuario
        enviarNotificacion('WhatsApp', ADMIN_WHATSAPP, mensajeAdmin);
      } catch (notificacionError) {
          console.error("Error al enviar notificación de compra al administrador:", notificacionError);
      }

    } catch (err) {
      setErrorApi(err instanceof Error ? err.message : "Error desconocido");
    }
  };

  if (!abierto) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black transition-opacity duration-200 ease-out ${visible ? 'bg-opacity-60' : 'bg-opacity-0'}`} aria-modal="true" role="dialog" onClick={handleClose}>
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md m-4 transform transition-all duration-200 ease-out ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`} onClick={e => e.stopPropagation()}>
        <header className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-tkd-dark dark:text-white">Solicitar Compra</h2>
          <button onClick={handleClose} className="p-1 rounded-full text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-transform hover:scale-110 active:scale-100">
            <IconoCerrar className="w-6 h-6" />
          </button>
        </header>
        <div className="p-6">
          {exito ? (
            <div className="text-center">
              <h3 className="text-xl font-bold text-green-600">¡Solicitud Enviada!</h3>
              <p className="mt-2 text-gray-700 dark:text-gray-300">
                Tu solicitud para comprar "{implemento.nombre} ({variacion.descripcion})" ha sido enviada.
                Recibirás una notificación por WhatsApp cuando sea aprobada por un administrador.
              </p>
              <button onClick={handleClose} className="mt-4 w-full bg-tkd-blue text-white py-2 px-4 rounded-md hover:bg-blue-800 transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95 shadow-md hover:shadow-lg">Cerrar</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600">
                  <p className="font-semibold text-tkd-dark dark:text-white">{implemento.nombre}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{variacion.descripcion}</p>
                  <p className="text-lg font-bold text-tkd-blue mt-1">{formatearPrecio(variacion.precio)}</p>
              </div>
              <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                Introduce el número de identificación del estudiante para asignararle esta compra.
              </p>
              <div>
                <label htmlFor="numIdentificacion" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Número de Identificación del Estudiante</label>
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
                <button type="button" onClick={handleClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95 shadow-sm">Cancelar</button>
                <button type="submit" disabled={isSubmitting || !isValid} className="bg-tkd-red text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:bg-gray-400 transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95 inline-flex items-center space-x-2 shadow-md hover:shadow-lg">
                  <IconoEnviar className="w-5 h-5" />
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

export default ModalSolicitarCompra;
