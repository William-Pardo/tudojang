
// components/FormularioMovimiento.tsx
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { TipoMovimiento, CategoriaFinanciera, type MovimientoFinanciero, type Sede } from '../tipos';
import { IconoCerrar, IconoGuardar } from './Iconos';
import FormInputError from './FormInputError';

interface Props {
    abierto: boolean;
    onCerrar: () => void;
    onGuardar: (movimiento: Omit<MovimientoFinanciero, 'id'> | MovimientoFinanciero) => Promise<void>;
    sedes: Sede[];
    cargando: boolean;
    movimientoActual?: MovimientoFinanciero | null;
}

const VALOR_NUEVA_CATEGORIA = "__NUEVA__";

const schema = yup.object({
    tipo: yup.string().oneOf(Object.values(TipoMovimiento)).required(),
    categoria: yup.string().required('La categoría es obligatoria.'),
    categoriaNueva: yup.string().when('categoria', {
        is: VALOR_NUEVA_CATEGORIA,
        then: (s) => s.required('Debes escribir el nombre de la nueva categoría.'),
        otherwise: (s) => s.optional(),
    }),
    monto: yup.number().typeError('El monto debe ser un número').positive('El monto debe ser mayor a 0').required('El monto es obligatorio.'),
    descripcion: yup.string().trim().required('La descripción es obligatoria.'),
    fecha: yup.string().required('La fecha es obligatoria.'),
    sedeId: yup.string().required('La sede es obligatoria.'),
}).required();

const FormularioMovimiento: React.FC<Props> = ({ abierto, onCerrar, onGuardar, sedes, cargando, movimientoActual }) => {
    const { register, handleSubmit, formState: { errors }, reset, watch, setValue } = useForm<any>({
        resolver: yupResolver(schema),
        defaultValues: {
            tipo: TipoMovimiento.Ingreso,
            categoria: CategoriaFinanciera.Otros,
            categoriaNueva: '',
            monto: 0,
            descripcion: '',
            fecha: new Date().toISOString().split('T')[0],
            sedeId: sedes[0]?.id || ''
        }
    });

    const categoriaSeleccionada = watch('categoria');

    useEffect(() => {
        if (abierto) {
            if (movimientoActual) {
                // Verificar si la categoría actual está en el Enum estándar
                const esEstandar = Object.values(CategoriaFinanciera).includes(movimientoActual.categoria as CategoriaFinanciera);
                reset({
                    tipo: movimientoActual.tipo,
                    categoria: esEstandar ? movimientoActual.categoria : VALOR_NUEVA_CATEGORIA,
                    categoriaNueva: esEstandar ? '' : movimientoActual.categoria,
                    monto: movimientoActual.monto,
                    descripcion: movimientoActual.descripcion,
                    fecha: movimientoActual.fecha,
                    sedeId: movimientoActual.sedeId
                });
            } else {
                reset({
                    tipo: TipoMovimiento.Ingreso,
                    categoria: CategoriaFinanciera.Otros,
                    categoriaNueva: '',
                    monto: 0,
                    descripcion: '',
                    fecha: new Date().toISOString().split('T')[0],
                    sedeId: sedes[0]?.id || ''
                });
            }
        }
    }, [abierto, reset, movimientoActual, sedes]);

    const onSubmit = (data: any) => {
        const { categoriaNueva, ...resto } = data;
        const movimientoFinal = {
            ...resto,
            categoria: data.categoria === VALOR_NUEVA_CATEGORIA ? categoriaNueva : data.categoria
        };
        onGuardar(movimientoActual ? { ...movimientoActual, ...movimientoFinal } : movimientoFinal);
    };

    if (!abierto) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md overflow-hidden">
                <header className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold dark:text-white">
                        {movimientoActual ? 'Editar Movimiento' : 'Nuevo Movimiento'}
                    </h2>
                    <button onClick={onCerrar} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <IconoCerrar className="w-6 h-6" />
                    </button>
                </header>
                <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-black uppercase text-gray-500 dark:text-gray-400 mb-1">Tipo</label>
                            <select {...register('tipo')} className="block w-full border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-colors focus:ring-tkd-blue focus:border-tkd-blue">
                                {Object.values(TipoMovimiento).map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase text-gray-500 dark:text-gray-400 mb-1">Categoría</label>
                            <select {...register('categoria')} className="block w-full border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-colors focus:ring-tkd-blue focus:border-tkd-blue">
                                {Object.values(CategoriaFinanciera).map(c => <option key={c} value={c}>{c}</option>)}
                                <option value={VALOR_NUEVA_CATEGORIA} className="font-bold text-tkd-red">+ Nueva Categoría...</option>
                            </select>
                        </div>
                    </div>

                    {categoriaSeleccionada === VALOR_NUEVA_CATEGORIA && (
                        <div className="animate-slide-in-right">
                            <label className="block text-xs font-black uppercase text-tkd-red mb-1">Nombre de la Categoría Personalizada</label>
                            <input
                                type="text"
                                {...register('categoriaNueva')}
                                placeholder="Eje: Publicidad, Mantenimiento..."
                                className="block w-full border-red-300 rounded-md dark:bg-gray-700 dark:border-red-900/30 dark:text-white transition-colors focus:ring-tkd-red focus:border-tkd-red"
                            />
                            <FormInputError mensaje={errors.categoriaNueva?.message as string} />
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-black uppercase text-gray-500 dark:text-gray-400 mb-1">Sede</label>
                        <select {...register('sedeId')} className="block w-full border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-colors focus:ring-tkd-blue focus:border-tkd-blue">
                            {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-black uppercase text-gray-500 dark:text-gray-400 mb-1">Monto (COP)</label>
                        <input type="number" {...register('monto')} className="block w-full border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-colors focus:ring-tkd-blue focus:border-tkd-blue" />
                        <FormInputError mensaje={errors.monto?.message as string} />
                    </div>
                    <div>
                        <label className="block text-xs font-black uppercase text-gray-500 dark:text-gray-400 mb-1">Descripción / Concepto</label>
                        <input type="text" {...register('descripcion')} className="block w-full border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-colors focus:ring-tkd-blue focus:border-tkd-blue" />
                        <FormInputError mensaje={errors.descripcion?.message as string} />
                    </div>
                    <div>
                        <label className="block text-xs font-black uppercase text-gray-500 dark:text-gray-400 mb-1">Fecha de Registro</label>
                        <input type="date" {...register('fecha')} className="block w-full border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-colors focus:ring-tkd-blue focus:border-tkd-blue" />
                    </div>
                    <footer className="pt-4 flex justify-end space-x-3">
                        <button type="button" onClick={onCerrar} className="px-4 py-2 text-gray-500 hover:text-tkd-dark dark:hover:text-white transition-colors">Cancelar</button>
                        <button type="submit" disabled={cargando} className="bg-tkd-red text-white px-6 py-2 rounded-md flex items-center space-x-2 shadow-md hover:bg-red-700 transition-all hover:scale-105 active:scale-95 disabled:bg-gray-400">
                            <IconoGuardar className="w-5 h-5" />
                            <span>{cargando ? 'Guardando...' : (movimientoActual ? 'Actualizar' : 'Registrar')}</span>
                        </button>
                    </footer>
                </form>
            </div>
        </div>
    );
};
export default FormularioMovimiento;
