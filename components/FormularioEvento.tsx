// componentes/FormularioEvento.tsx
// Formulario modal para crear y editar eventos.

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import type { Evento } from '../tipos';
import { IconoCerrar, IconoImagen, IconoGuardar, IconoInformacion } from './Iconos';
import FormInputError from './FormInputError';
import { useAutosave } from '../hooks/useAutosave';
import AutosavePrompt from './AutosavePrompt';

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  onGuardar: (evento: Omit<Evento, 'id'> | Evento) => Promise<void>;
  eventoActual: Evento | null;
  cargando: boolean;
}

const schema = yup.object({
    nombre: yup.string().trim().required('El nombre del evento es obligatorio.'),
    lugar: yup.string().trim().required('El lugar es obligatorio.'),
    descripcion: yup.string().trim().optional().default(''),
    fechaInicioInscripcion: yup.string().required('La fecha de inicio de inscripción es obligatoria.'),
    fechaFinInscripcion: yup.string()
        .required('La fecha de fin de inscripción es obligatoria.')
        .test('fecha-fin-valida', 'Debe ser posterior a la fecha de inicio.', function(value) {
            const { fechaInicioInscripcion } = this.parent;
            return !fechaInicioInscripcion || !value || new Date(value) >= new Date(fechaInicioInscripcion);
        }),
    fechaEvento: yup.string()
        .required('La fecha del evento es obligatoria.')
        .test('fecha-evento-valida', 'Debe ser posterior a la fecha de fin de inscripción.', function(value) {
            const { fechaFinInscripcion } = this.parent;
            return !fechaFinInscripcion || !value || new Date(value) >= new Date(fechaFinInscripcion);
        }),
    valor: yup.number()
        .typeError('El valor debe ser un número.')
        .min(0, 'El valor no puede ser negativo.')
        .required('El valor de inscripción es obligatorio.'),
    requisitos: yup.string().optional().default(''),
    imagenUrl: yup.string().optional().default(''),
}).required();

type FormData = yup.InferType<typeof schema>;

const FormularioEvento: React.FC<Props> = ({ abierto, onCerrar, onGuardar, eventoActual, cargando }) => {
  const [visible, setVisible] = useState(false);
  
  const defaultValues: FormData = {
    nombre: '',
    descripcion: '',
    lugar: '',
    fechaInicioInscripcion: '',
    fechaFinInscripcion: '',
    fechaEvento: '',
    valor: 0,
    requisitos: '',
    imagenUrl: ''
  };

  const { register, handleSubmit, formState: { errors, isValid }, reset, setValue, watch } = useForm<FormData>({
    // FIX: Removed the explicit generic type argument from yupResolver to fix type compatibility issues with recent versions of react-hook-form and @hookform/resolvers.
    resolver: yupResolver(schema),
    mode: 'onChange',
    defaultValues: eventoActual ? {
        nombre: eventoActual.nombre,
        lugar: eventoActual.lugar,
        descripcion: eventoActual.descripcion || '',
        fechaInicioInscripcion: eventoActual.fechaInicioInscripcion,
        fechaFinInscripcion: eventoActual.fechaFinInscripcion,
        fechaEvento: eventoActual.fechaEvento,
        valor: eventoActual.valor,
        requisitos: eventoActual.requisitos || '',
        imagenUrl: eventoActual.imagenUrl || '',
    } : defaultValues
  });
  
  const formKey = `draft-evento-${eventoActual?.id || 'nuevo'}`;
  const { status: autosaveStatus, hasDraft, restoreDraft, clearDraft } = useAutosave({
    formKey,
    watch,
    reset,
  });

  const imagenPreview = watch('imagenUrl');

  useEffect(() => {
    if (abierto) {
        if (!hasDraft) {
            reset(eventoActual ? {
                nombre: eventoActual.nombre,
                lugar: eventoActual.lugar,
                descripcion: eventoActual.descripcion || '',
                fechaInicioInscripcion: eventoActual.fechaInicioInscripcion,
                fechaFinInscripcion: eventoActual.fechaFinInscripcion,
                fechaEvento: eventoActual.fechaEvento,
                valor: eventoActual.valor,
                requisitos: eventoActual.requisitos || '',
                imagenUrl: eventoActual.imagenUrl || '',
            } : defaultValues);
        }
    }
  }, [abierto, eventoActual, reset, hasDraft, defaultValues]);

  useEffect(() => {
    if (abierto) {
      const timer = setTimeout(() => setVisible(true), 10);
      return () => clearTimeout(timer);
    }
  }, [abierto]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => onCerrar(), 200);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            setValue('imagenUrl', base64String, { shouldValidate: true });
        };
        reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (data: FormData) => {
    // FIX: Explicitly typed `datosParaGuardar` to ensure it matches the `onGuardar` prop signature, as TypeScript can struggle with inference from the `data` object after validation.
    const datosParaGuardar: Omit<Evento, 'id'> | Evento = eventoActual ? { ...eventoActual, ...data } : data as Omit<Evento, 'id'>;
    try {
      await onGuardar(datosParaGuardar);
      clearDraft(); // Limpiar el borrador solo si el guardado es exitoso
    } catch (error) {
      // El error ya se maneja en la vista padre, pero no limpiamos el borrador
      console.error("Fallo al guardar, el borrador se mantendrá.", error);
    }
  };

  const AutosaveStatusIndicator = () => {
    if (autosaveStatus === 'saving') return <span className="text-xs text-gray-500 dark:text-gray-400">Guardando borrador...</span>;
    if (autosaveStatus === 'saved') return <span className="text-xs text-green-600 dark:text-green-400">Borrador guardado ✓</span>;
    if (autosaveStatus === 'error') return <span className="text-xs text-red-500">Error al guardar borrador</span>;
    return null;
  };

  if (!abierto) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black transition-opacity duration-200 ease-out ${visible ? 'bg-opacity-60' : 'bg-opacity-0'}`} aria-modal="true" role="dialog" onClick={handleClose}>
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col transform transition-all duration-200 ease-out ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`} onClick={e => e.stopPropagation()}>
        <header className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-tkd-dark dark:text-white">
            {eventoActual ? 'Editar Evento' : 'Agregar Nuevo Evento'}
          </h2>
          <button onClick={handleClose} className="p-1 rounded-full text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-600 transition-transform hover:scale-110 active:scale-100">
            <IconoCerrar className="w-6 h-6" />
          </button>
        </header>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 overflow-y-auto space-y-4">
          {hasDraft && <AutosavePrompt onRestore={restoreDraft} onDiscard={clearDraft} />}
          <div>
            <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nombre del Evento</label>
            <input type="text" {...register('nombre')} className={`mt-1 block w-full border rounded-md shadow-sm sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-colors ${errors.nombre ? 'border-red-500' : 'border-gray-300'}`} />
            <FormInputError mensaje={errors.nombre?.message} />
          </div>
          <div>
            <label htmlFor="lugar" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Lugar</label>
            <input type="text" {...register('lugar')} className={`mt-1 block w-full border rounded-md shadow-sm sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-colors ${errors.lugar ? 'border-red-500' : 'border-gray-300'}`} />
            <FormInputError mensaje={errors.lugar?.message} />
          </div>
          <div>
            <label htmlFor="descripcion" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Descripción</label>
            <textarea {...register('descripcion')} rows={3} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-tkd-blue focus:border-tkd-blue sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-colors"></textarea>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <div>
              <label htmlFor="fechaInicioInscripcion" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Inicio Inscripción</label>
              <input type="date" {...register('fechaInicioInscripcion')} className={`mt-1 block w-full border rounded-md shadow-sm sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-colors ${errors.fechaInicioInscripcion ? 'border-red-500' : 'border-gray-300'}`} />
               <FormInputError mensaje={errors.fechaInicioInscripcion?.message} />
            </div>
            <div>
              <label htmlFor="fechaFinInscripcion" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Fin Inscripción</label>
              <input type="date" {...register('fechaFinInscripcion')} className={`mt-1 block w-full border rounded-md shadow-sm sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-colors ${errors.fechaFinInscripcion ? 'border-red-500' : 'border-gray-300'}`} />
               <FormInputError mensaje={errors.fechaFinInscripcion?.message} />
            </div>
            <div>
              <label htmlFor="fechaEvento" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Fecha del Evento</label>
              <input type="date" {...register('fechaEvento')} className={`mt-1 block w-full border rounded-md shadow-sm sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-colors ${errors.fechaEvento ? 'border-red-500' : 'border-gray-300'}`} />
               <FormInputError mensaje={errors.fechaEvento?.message} />
            </div>
          </div>
          <div>
            <label htmlFor="valor" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Valor de Inscripción (COP)</label>
            <input type="number" {...register('valor')} min="0" className={`mt-1 block w-full border rounded-md shadow-sm sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-colors ${errors.valor ? 'border-red-500' : 'border-gray-300'}`} />
            <FormInputError mensaje={errors.valor?.message} />
          </div>
           <div>
            <label htmlFor="requisitos" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Requisitos</label>
            <textarea {...register('requisitos')} rows={2} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-tkd-blue focus:border-tkd-blue sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-colors"></textarea>
          </div>
          <div>
            <div className="flex items-center space-x-1 mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Imagen del Evento</label>
                <div className="relative group">
                    <IconoInformacion className="w-4 h-4 text-gray-400 cursor-help" />
                    <span className="absolute bottom-full mb-2 w-72 p-2 bg-gray-800 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 -translate-x-1/2 left-1/2">
                        Recomendado: Formato vertical 9:16 (ej. 1080x1920px), ideal para compartir en historias de redes sociales.
                    </span>
                </div>
            </div>
            <div className="flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-md">
                <div className="space-y-1 text-center">
                    <IconoImagen className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="flex text-sm text-gray-600 dark:text-gray-400">
                        <label htmlFor="imagen-upload" className="relative cursor-pointer bg-white dark:bg-gray-800 rounded-md font-medium text-tkd-blue hover:text-blue-700 dark:hover:text-blue-400 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 dark:focus-within:ring-offset-gray-800 focus-within:ring-tkd-blue">
                            <span>Seleccionar archivo</span>
                            <input id="imagen-upload" name="imagen-upload" type="file" className="sr-only" onChange={handleImageChange} accept="image/png, image/jpeg, image/webp" />
                        </label>
                        <p className="pl-1">o arrastrar y soltar</p>
                    </div>
                </div>
            </div>
            {imagenPreview && (
                <div className="mt-4 flex justify-center">
                    <div className="w-40 aspect-[9/16] bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden border dark:border-gray-600 shadow-md">
                        <img src={imagenPreview} alt="Vista previa del evento" className="w-full h-full object-cover" />
                    </div>
                </div>
            )}
          </div>
        </form>

        <footer className="p-4 border-t flex justify-between items-center bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700">
          <div className="flex-grow">
            <AutosaveStatusIndicator />
          </div>
          <div className="flex space-x-3">
            <button type="button" onClick={handleClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95 shadow-sm">
              Cancelar
            </button>
            <button type="button" onClick={handleSubmit(onSubmit)} disabled={!isValid || cargando} className="px-4 py-2 bg-tkd-red text-white rounded-md hover:bg-red-700 transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95 disabled:bg-gray-400 disabled:cursor-not-allowed inline-flex items-center justify-center space-x-2 shadow-md hover:shadow-lg">
              <IconoGuardar className="w-5 h-5" />
              <span>{cargando ? 'Guardando...' : 'Guardar Evento'}</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default FormularioEvento;