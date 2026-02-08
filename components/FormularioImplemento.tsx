
// components/FormularioImplemento.tsx
import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import type { Implemento, VariacionImplemento } from '../tipos';
import { CategoriaImplemento } from '../tipos';
// Added fix: added IconoInformacion to the imports from ./Iconos
import { IconoCerrar, IconoGuardar, IconoImagen, IconoEliminar, IconoAgregar, IconoLogoOficial, IconoInformacion } from './Iconos';
import FormInputError from './FormInputError';

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  onGuardar: (item: any) => Promise<void>;
  itemActual: Implemento | null;
  cargando: boolean;
}

const schema = yup.object({
  nombre: yup.string().trim().required('El nombre comercial es obligatorio.'),
  descripcion: yup.string().trim().required('Describe las especificaciones técnicas.'),
  categoria: yup.string().oneOf(Object.values(CategoriaImplemento)).required('Categoría requerida.'),
  imagenUrl: yup.string().optional(),
  variaciones: yup.array().of(
    yup.object({
      id: yup.string().required(),
      descripcion: yup.string().trim().required('Detalle (Talla/Color)'),
      precio: yup.number().typeError('Numérico').min(0, 'Valor base $0').required()
    })
  ).min(1, 'Define al menos una variante de precio.')
}).required();

const FormularioImplemento: React.FC<Props> = ({ abierto, onCerrar, onGuardar, itemActual, cargando }) => {
  const [preview, setPreview] = useState<string | null>(itemActual?.imagenUrl || null);

  const { register, control, handleSubmit, formState: { errors }, reset, setValue } = useForm<any>({
    resolver: yupResolver(schema),
    defaultValues: itemActual || { 
      nombre: '', descripcion: '', categoria: CategoriaImplemento.Uniformes, imagenUrl: '', 
      variaciones: [{ id: `v-${Date.now()}`, descripcion: 'TALLA ÚNICA', precio: 0 }] 
    }
  });

  const { fields, append, remove } = useFieldArray({ control, name: "variaciones" });

  useEffect(() => {
    if (abierto) {
      reset(itemActual || { 
        nombre: '', descripcion: '', categoria: CategoriaImplemento.Uniformes, imagenUrl: '', 
        variaciones: [{ id: `v-${Date.now()}`, descripcion: 'TALLA ÚNICA', precio: 0 }] 
      });
      setPreview(itemActual?.imagenUrl || null);
    }
  }, [abierto, itemActual, reset]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setPreview(base64);
        setValue('imagenUrl', base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (data: any) => {
    await onGuardar(itemActual ? { ...itemActual, ...data } : data);
    onCerrar();
  };

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-tkd-dark/95 p-4 animate-fade-in backdrop-blur-xl">
      <div className="bg-white dark:bg-gray-900 rounded-[3rem] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-white/10">
        <header className="p-8 border-b dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
          <div>
            <h2 className="text-2xl font-black uppercase text-gray-900 dark:text-white tracking-tighter">Editor de Equipamiento</h2>
            <p className="text-[10px] font-black text-tkd-blue uppercase tracking-widest mt-1">Gestión Maestra de Inventario</p>
          </div>
          <button onClick={onCerrar} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all"><IconoCerrar className="w-8 h-8 text-gray-400" /></button>
        </header>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-10 space-y-10 no-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 mb-2 block tracking-widest">Nombre Comercial</label>
                <input {...register('nombre')} className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl p-5 text-sm font-black text-gray-900 dark:text-white uppercase outline-none focus:ring-2 focus:ring-tkd-blue shadow-inner" placeholder="EJ: DOBOK COMPETICIÓN" />
                <FormInputError mensaje={errors.nombre?.message} />
              </div>
              
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 mb-2 block tracking-widest">Categoría Técnica</label>
                <select {...register('categoria')} className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl p-5 text-sm font-black text-gray-900 dark:text-white uppercase outline-none focus:ring-2 focus:ring-tkd-blue shadow-inner appearance-none cursor-pointer">
                  {Object.values(CategoriaImplemento).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 mb-2 block tracking-widest">Descripción del Implemento</label>
                <textarea {...register('descripcion')} rows={4} className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl p-5 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase outline-none focus:ring-2 focus:ring-tkd-blue shadow-inner resize-none" placeholder="ESPECIFICACIONES DE TELA, PESO Y USO..." />
                <FormInputError mensaje={errors.descripcion?.message} />
              </div>
            </div>

            <div className="space-y-6">
              <label className="text-[10px] font-black uppercase text-gray-400 mb-2 block tracking-widest">Imagen del Producto</label>
              <div className="aspect-square bg-gray-50 dark:bg-gray-800 rounded-[2.5rem] border-2 border-dashed border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center overflow-hidden relative group transition-all hover:border-tkd-blue">
                {preview ? (
                  <img src={preview} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center space-y-4">
                    <IconoImagen className="w-12 h-12 text-gray-300 mx-auto" />
                    <p className="text-[9px] font-black text-gray-400 uppercase">Sin Imagen</p>
                  </div>
                )}
                <label className="absolute inset-0 bg-tkd-blue/80 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white font-black uppercase text-[10px] tracking-widest cursor-pointer transition-all backdrop-blur-sm">
                  Cambiar Fotografía
                  <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                </label>
              </div>
            </div>
          </div>

          <div className="pt-10 border-t dark:border-gray-800 space-y-6">
            <div className="flex justify-between items-center px-2">
              <div>
                <label className="text-[11px] font-black uppercase text-tkd-blue tracking-[0.2em]">Variaciones Técnicas</label>
                <p className="text-[9px] text-gray-400 font-bold uppercase mt-1">Configura tallas, colores y precios específicos</p>
              </div>
              <button 
                type="button" 
                onClick={() => append({ id: `v-${Date.now()}`, descripcion: '', precio: 0 })}
                className="bg-tkd-blue/10 text-tkd-blue px-6 py-2.5 rounded-xl font-black uppercase text-[9px] tracking-widest hover:bg-tkd-blue hover:text-white transition-all shadow-sm"
              >
                + Nueva Opción
              </button>
            </div>
            
            <div className="space-y-4">
              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-4 items-center animate-slide-in-right">
                  <div className="flex-grow grid grid-cols-2 gap-6 bg-gray-50 dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-inner">
                    <input {...register(`variaciones.${index}.descripcion`)} placeholder="EJ: TALLA XL / ROJO" className="bg-transparent border-none p-0 text-xs font-black dark:text-white uppercase outline-none" />
                    <div className="flex items-center gap-2 border-l pl-4 dark:border-gray-700">
                        <span className="text-tkd-blue font-black text-xs">$</span>
                        <input type="number" {...register(`variaciones.${index}.precio`)} placeholder="PRECIO" className="bg-transparent border-none p-0 text-xs font-black text-gray-900 dark:text-white outline-none w-full" />
                    </div>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => remove(index)} 
                    className="p-4 text-tkd-red hover:bg-red-50 dark:hover:bg-red-900/20 rounded-2xl transition-all group"
                  >
                    <IconoEliminar className="w-5 h-5 group-hover:scale-110" />
                  </button>
                </div>
              ))}
            </div>
            <FormInputError mensaje={errors.variaciones && 'Revisar parámetros de variaciones.'} />
          </div>
        </form>

        <footer className="p-8 border-t dark:border-gray-800 flex flex-col sm:flex-row justify-between items-center gap-6 bg-gray-50 dark:bg-gray-950/50">
          <div className="flex items-center gap-3">
              <IconoInformacion className="w-5 h-5 text-gray-400" />
              <p className="text-[9px] text-gray-500 font-bold uppercase max-w-xs">Los cambios se reflejarán instantáneamente en el catálogo público para padres.</p>
          </div>
          <div className="flex gap-4 w-full sm:w-auto">
              <button onClick={onCerrar} className="flex-1 sm:flex-none px-8 py-4 text-[10px] font-black uppercase text-gray-400 hover:text-tkd-red transition-all">Cancelar</button>
              <button 
                onClick={handleSubmit(onSubmit)} 
                disabled={cargando}
                className="flex-1 sm:flex-none bg-tkd-red text-white px-12 py-4 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl hover:bg-red-700 active:scale-95 transition-all flex items-center justify-center gap-3"
              >
                {cargando ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <IconoGuardar className="w-5 h-5" />}
                {itemActual ? 'Actualizar Registro' : 'Registrar en Catálogo'}
              </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default FormularioImplemento;
