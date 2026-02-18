
// components/FormularioSede.tsx
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import type { Sede } from '../tipos';
import { IconoCerrar, IconoGuardar, IconoInformacion } from './Iconos';
import FormInputError from './FormInputError';

interface Props {
    abierto: boolean;
    onCerrar: () => void;
    onGuardar: (sede: Omit<Sede, 'id'> | Sede) => Promise<void>;
    sedeActual: Partial<Sede> | null;
    cargando: boolean;
}

const schema = yup.object({
    nombre: yup.string().trim().required('El nombre es obligatorio.'),
    direccion: yup.string().trim().required('La dirección es obligatoria.'),
    ciudad: yup.string().trim().required('La ciudad es obligatoria.'),
    telefono: yup.string().trim().required('El teléfono es obligatorio.'),
    valorMensualidad: yup.number().typeError('Debe ser un número').min(0, 'No puede ser negativo').optional().default(0),
}).required();

const FormularioSede: React.FC<Props> = ({ abierto, onCerrar, onGuardar, sedeActual, cargando }) => {
    const { register, handleSubmit, formState: { errors }, reset } = useForm<Omit<Sede, 'id'>>({
        resolver: yupResolver(schema) as any,
        defaultValues: (sedeActual as any) || { nombre: '', direccion: '', ciudad: '', telefono: '', valorMensualidad: 0 }
    });

    useEffect(() => {
        if (abierto) reset(sedeActual || { nombre: '', direccion: '', ciudad: '', telefono: '', valorMensualidad: 0 });
    }, [abierto, sedeActual, reset]);

    const onSubmit = (data: Omit<Sede, 'id'>) => {
        onGuardar(sedeActual ? { ...sedeActual, ...data } : data);
    };

    if (!abierto) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4 animate-fade-in backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md overflow-hidden transform transition-all">
                <header className="p-4 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
                    <h2 className="text-xl font-bold dark:text-white uppercase tracking-tight">{sedeActual ? 'Editar Sede' : 'Nueva Sede'}</h2>
                    <button onClick={onCerrar} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"><IconoCerrar className="w-6 h-6" /></button>
                </header>
                <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
                    <div>
                        <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">Nombre de la Sede</label>
                        <input type="text" {...register('nombre')} className="w-full bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded-xl p-3 text-sm dark:text-white focus:ring-tkd-blue" />
                        <FormInputError mensaje={errors.nombre?.message} />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">Dirección Física</label>
                        <input type="text" {...register('direccion')} className="w-full bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded-xl p-3 text-sm dark:text-white focus:ring-tkd-blue" />
                        <FormInputError mensaje={errors.direccion?.message} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">Ciudad</label>
                            <input type="text" {...register('ciudad')} className="w-full bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded-xl p-3 text-sm dark:text-white focus:ring-tkd-blue" />
                            <FormInputError mensaje={errors.ciudad?.message} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">Teléfono</label>
                            <input type="text" {...register('telefono')} className="w-full bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded-xl p-3 text-sm dark:text-white focus:ring-tkd-blue" />
                            <FormInputError mensaje={errors.telefono?.message} />
                        </div>
                    </div>

                    <div className="pt-4 border-t dark:border-gray-700">
                        <label className="block text-[10px] font-black uppercase text-tkd-blue mb-1 ml-1">Valor Mensualidad Específico (COP)</label>
                        <input type="number" {...register('valorMensualidad')} className="w-full bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 rounded-xl p-3 text-sm font-bold dark:text-white focus:ring-tkd-blue" />
                        <div className="flex items-center gap-2 mt-2 px-1">
                            <IconoInformacion className="w-3.5 h-3.5 text-gray-400" />
                            <p className="text-[9px] text-gray-400 font-bold uppercase">Dejar en $0 para usar el valor base del club.</p>
                        </div>
                    </div>

                    <footer className="pt-6 flex justify-end space-x-3">
                        <button type="button" onClick={onCerrar} className="px-5 py-2 text-xs font-black uppercase text-gray-400 hover:text-gray-600 transition-colors">Cancelar</button>
                        <button type="submit" disabled={cargando} className="bg-tkd-blue text-white px-8 py-3 rounded-xl font-black uppercase text-xs tracking-widest shadow-lg flex items-center gap-2 active:scale-95 transition-all">
                            <IconoGuardar className="w-4 h-4" />
                            <span>{cargando ? '...' : 'Guardar Sede'}</span>
                        </button>
                    </footer>
                </form>
            </div>
        </div>
    );
};
export default FormularioSede;
