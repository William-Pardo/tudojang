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
    .test('fecha-fin-valida', 'Debe ser posterior a la fecha de inicio.', function (value) {
      const { fechaInicioInscripcion } = this.parent;
      return !fechaInicioInscripcion || !value || new Date(value) >= new Date(fechaInicioInscripcion);
    }),
  fechaEvento: yup.string()
    .required('La fecha del evento es obligatoria.')
    .test('fecha-evento-valida', 'Debe ser posterior a la fecha de fin de inscripción.', function (value) {
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
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-[#0D121F]/80 backdrop-blur-sm transition-opacity duration-300 ease-out ${visible ? 'opacity-100' : 'opacity-0'}`} aria-modal="true" role="dialog" onClick={handleClose}>
      <div className={`bg-[#1A2232] rounded-[2.5rem] shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col transform transition-all duration-300 ease-out border border-white/5 ${visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-12 scale-95'}`} onClick={e => e.stopPropagation()}>
        <header className="flex items-center justify-between p-10 border-b border-white/5">
          <div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">
              {eventoActual ? 'Editar Evento' : 'Nuevo Evento'}
            </h2>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mt-1">Configuración técnica de la actividad</p>
          </div>
          <button onClick={handleClose} className="p-3 rounded-2xl text-gray-400 hover:bg-white/5 hover:text-white transition-all">
            <IconoCerrar className="w-6 h-6" />
          </button>
        </header>

        <form onSubmit={handleSubmit(onSubmit)} className="p-10 overflow-y-auto space-y-8 custom-scrollbar">
          {hasDraft && <AutosavePrompt onRestore={restoreDraft} onDiscard={clearDraft} />}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label htmlFor="nombre" className="text-[10px] font-black uppercase text-gray-500 tracking-widest ml-1">Nombre del Evento</label>
              <input type="text" {...register('nombre')} className={`block w-full bg-[#0D121F] border ${errors.nombre ? 'border-red-500' : 'border-white/10'} text-white rounded-2xl px-6 py-4 text-sm font-bold focus:border-tkd-blue outline-none transition-all`} placeholder="Ej: Torneo Nacional de Verano" />
              <FormInputError mensaje={errors.nombre?.message} />
            </div>

            <div className="space-y-2">
              <label htmlFor="lugar" className="text-[10px] font-black uppercase text-gray-500 tracking-widest ml-1">Ubicación / Lugar</label>
              <input type="text" {...register('lugar')} className={`block w-full bg-[#0D121F] border ${errors.lugar ? 'border-red-500' : 'border-white/10'} text-white rounded-2xl px-6 py-4 text-sm font-bold focus:border-tkd-blue outline-none transition-all`} placeholder="Ej: Coliseo El Salitre" />
              <FormInputError mensaje={errors.lugar?.message} />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="descripcion" className="text-[10px] font-black uppercase text-gray-500 tracking-widest ml-1">Descripción de la Actividad</label>
            <textarea {...register('descripcion')} rows={3} className="block w-full bg-[#0D121F] border border-white/10 text-white rounded-2xl px-6 py-4 text-sm font-medium focus:border-tkd-blue outline-none transition-all resize-none" placeholder="Detalles del cronograma, objetivos..." />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label htmlFor="fechaInicioInscripcion" className="text-[10px] font-black uppercase text-gray-500 tracking-widest ml-1">Apertura</label>
              <input type="date" {...register('fechaInicioInscripcion')} className="block w-full bg-[#0D121F] border border-white/10 text-white rounded-2xl px-6 py-4 text-sm font-bold focus:border-tkd-blue outline-none transition-all" />
              <FormInputError mensaje={errors.fechaInicioInscripcion?.message} />
            </div>
            <div className="space-y-2">
              <label htmlFor="fechaFinInscripcion" className="text-[10px] font-black uppercase text-gray-500 tracking-widest ml-1">Cierre</label>
              <input type="date" {...register('fechaFinInscripcion')} className="block w-full bg-[#0D121F] border border-white/10 text-white rounded-2xl px-6 py-4 text-sm font-bold focus:border-tkd-blue outline-none transition-all" />
              <FormInputError mensaje={errors.fechaFinInscripcion?.message} />
            </div>
            <div className="space-y-2">
              <label htmlFor="fechaEvento" className="text-[10px] font-black uppercase text-gray-500 tracking-widest ml-1">Fecha Evento</label>
              <input type="date" {...register('fechaEvento')} className="block w-full bg-[#0D121F] border border-white/10 text-white rounded-2xl px-6 py-4 text-sm font-bold focus:border-tkd-blue outline-none transition-all" />
              <FormInputError mensaje={errors.fechaEvento?.message} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label htmlFor="valor" className="text-[10px] font-black uppercase text-gray-500 tracking-widest ml-1">Inversión (COP)</label>
              <div className="relative">
                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</span>
                <input type="number" {...register('valor')} className="block w-full bg-[#0D121F] border border-white/10 text-white rounded-2xl pl-10 pr-6 py-4 text-sm font-bold focus:border-tkd-blue outline-none transition-all" />
              </div>
              <FormInputError mensaje={errors.valor?.message} />
            </div>

            <div className="space-y-2">
              <label htmlFor="requisitos" className="text-[10px] font-black uppercase text-gray-500 tracking-widest ml-1">Requisitos de Grado</label>
              <input type="text" {...register('requisitos')} className="block w-full bg-[#0D121F] border border-white/10 text-white rounded-2xl px-6 py-4 text-sm font-bold focus:border-tkd-blue outline-none transition-all" placeholder="Ej: Cinturones amarillos+" />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest ml-1">Imagen Promocional (9:16)</label>
              <AutosaveStatusIndicator />
            </div>

            <div className={`relative group border-2 border-dashed rounded-[2rem] transition-all p-12 text-center ${imagenPreview ? 'border-tkd-blue/30 bg-tkd-blue/5' : 'border-white/10 hover:border-white/20 hover:bg-white/5'}`}>
              <input id="imagen-upload" type="file" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleImageChange} accept="image/*" />
              {!imagenPreview ? (
                <div className="space-y-4">
                  <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto"><IconoImagen className="w-8 h-8 text-gray-400" /></div>
                  <div className="text-sm font-bold text-gray-400">Seleccionar Imagen o Arrastrar</div>
                  <div className="text-[9px] font-black text-gray-600 uppercase tracking-widest">JPG, PNG o WEBP (Máx 5MB)</div>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-8">
                  <div className="w-24 aspect-[9/16] rounded-xl overflow-hidden shadow-2xl border border-white/10">
                    <img src={imagenPreview} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-white">Imagen Cargada</p>
                    <p className="text-xs text-tkd-blue cursor-pointer hover:underline mt-1">Haga clic o arrastre para cambiar</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </form>

        <footer className="p-10 border-t border-white/5 bg-[#0D121F]/30 backdrop-blur-xl flex justify-end items-center gap-5">
          <button type="button" onClick={handleClose} className="px-8 py-4 bg-white/5 text-gray-400 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-white/10 hover:text-white transition-all shadow-xl">
            Cancelar
          </button>
          <button type="button" onClick={handleSubmit(onSubmit)} disabled={!isValid || cargando} className="px-10 py-4 bg-tkd-blue text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-[0_15px_30px_-10px_rgba(0,71,160,0.5)] hover:bg-blue-800 transition-all disabled:opacity-50 flex items-center gap-3">
            <IconoGuardar className="w-5 h-5" />
            <span>{cargando ? 'Guardando...' : 'Publicar Evento'}</span>
          </button>
        </footer>
      </div>
    </div>
  );
};

export default FormularioEvento;