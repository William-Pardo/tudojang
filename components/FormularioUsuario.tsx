
// components/FormularioUsuario.tsx
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import type { Usuario } from '../tipos';
import { RolUsuario } from '../tipos';
import { IconoCerrar, IconoCandado, IconoUsuario, IconoGuardar, IconoEmail, IconoInformacion, IconoCasa, IconoOjoAbierto, IconoOjoCerrado, IconoWhatsApp } from './Iconos';
import FormInputError from './FormInputError';
import { useSedes } from '../context/DataContext';

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  onGuardar: (datos: any, id?: string) => void;
  usuarioActual: Usuario | null;
  cargando: boolean;
}

const crearEsquemaValidacion = (esEdicion: boolean) => {
    return yup.object({
        nombreUsuario: yup.string().trim().required('El nombre es obligatorio.'),
        numeroIdentificacion: yup.string().trim().required('El documento de identidad es obligatorio para contratos.'),
        whatsapp: yup.string().trim().matches(/^\d{10}$/, 'Debe ser un número de 10 dígitos.').required('El número de WhatsApp es obligatorio para alertas.'),
        email: yup.string().email('Debe ser un correo válido.').required('El correo electrónico es obligatorio.'),
        rol: yup.string().oneOf(Object.values(RolUsuario)).required('El rol es obligatorio.'),
        sedeId: yup.string().when('rol', {
            is: (val: string) => val === RolUsuario.Tutor || val === RolUsuario.Asistente,
            then: (s) => s.required('Este perfil debe tener una sede asignada para filtrar sus funciones.'),
            otherwise: (s) => s.optional(),
        }),
        contrasena: yup.string().when([], {
            is: () => !esEdicion,
            then: (schema) => schema.min(6, 'Mínimo 6 caracteres.').required('La contraseña es obligatoria para nuevos perfiles.'),
            otherwise: (schema) => schema.transform(v => v === "" ? undefined : v).min(6, 'Mínimo 6 caracteres.').optional(),
        }),
    }).required();
};

const DESCRIPCIONES_ROLES = {
    [RolUsuario.Admin]: "Acceso total: Finanzas, Configuración y Personal.",
    [RolUsuario.Editor]: "Secretaría: Gestión de alumnos, tienda, eventos y cobros.",
    [RolUsuario.Asistente]: "Apoyo en Sede: Registro de asistencias y consulta de alumnos.",
    [RolUsuario.Tutor]: "Sabonim (Profesor): Acceso a su perfil, asistencias y pagos."
};

const FormularioUsuario: React.FC<Props> = ({ abierto, onCerrar, onGuardar, usuarioActual, cargando }) => {
  const [visible, setVisible] = useState(false);
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const { sedes } = useSedes();
  const esEdicion = !!usuarioActual;
  const schema = crearEsquemaValidacion(esEdicion);
  
  const { register, handleSubmit, formState: { errors, isValid }, reset, watch } = useForm<any>({
    resolver: yupResolver(schema),
    mode: 'onChange',
  });

  const rolSeleccionado = watch('rol') as RolUsuario;

  useEffect(() => {
    if (abierto) {
      const timer = setTimeout(() => setVisible(true), 10);
      return () => clearTimeout(timer);
    }
  }, [abierto]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => {
        reset();
        setMostrarContrasena(false);
        onCerrar();
    }, 200);
  };

  useEffect(() => {
    if (abierto) {
      if (usuarioActual) {
        reset({ 
            nombreUsuario: usuarioActual.nombreUsuario, 
            numeroIdentificacion: usuarioActual.numeroIdentificacion || '',
            whatsapp: usuarioActual.whatsapp || '',
            email: usuarioActual.email, 
            rol: usuarioActual.rol,
            sedeId: usuarioActual.sedeId || '',
            contrasena: '' 
        });
      } else {
        reset({ 
            nombreUsuario: '', 
            numeroIdentificacion: '',
            whatsapp: '',
            email: '', 
            rol: RolUsuario.Asistente, 
            sedeId: '', 
            contrasena: '' 
        });
      }
    }
  }, [abierto, usuarioActual, reset]);

  const onSubmit = (data: any) => {
    onGuardar(data, usuarioActual?.id);
  };

  if (!abierto) return null;

  const inputClasses = `block w-full pl-10 py-3 border rounded-xl shadow-sm transition-all outline-none font-bold text-base
    bg-white text-gray-900 border-gray-300 
    dark:bg-gray-800 dark:text-white dark:border-gray-600
    focus:ring-2 focus:ring-tkd-blue focus:border-tkd-blue`;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black transition-opacity duration-200 ease-out ${visible ? 'bg-opacity-70' : 'bg-opacity-0'}`} aria-modal="true" role="dialog" onClick={handleClose}>
      <div className={`bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-md mx-4 max-h-[95vh] flex flex-col transform transition-all duration-200 ease-out ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`} onClick={e => e.stopPropagation()}>
        <header className="flex items-center justify-between p-6 border-b dark:border-gray-800">
          <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
            {usuarioActual ? 'Editar Perfil' : 'Nuevo Miembro de Equipo'}
          </h2>
          <button onClick={handleClose} className="p-2 rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">
            <IconoCerrar className="w-6 h-6" />
          </button>
        </header>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 overflow-y-auto space-y-5">
          {/* NOMBRE COMPLETO */}
          <div>
            <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1 tracking-widest">Nombre Completo</label>
             <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <IconoUsuario className="w-5 h-5 text-tkd-blue" />
                </div>
                <input
                    type="text"
                    {...register('nombreUsuario')}
                    className={`${inputClasses} pr-4 ${errors.nombreUsuario ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                    placeholder="Ej: Sabonim Carlos Ruiz"
                />
            </div>
            <FormInputError mensaje={errors.nombreUsuario?.message} />
          </div>

          {/* DOCUMENTO Y WHATSAPP EN GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1 tracking-widest">Doc. Identidad</label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <IconoUsuario className="w-5 h-5 text-tkd-blue opacity-50" />
                    </div>
                    <input
                        type="text"
                        {...register('numeroIdentificacion')}
                        className={`${inputClasses} pr-4 ${errors.numeroIdentificacion ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                        placeholder="1.000.xxx.xxx"
                    />
                </div>
                <FormInputError mensaje={errors.numeroIdentificacion?.message} />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1 tracking-widest">WhatsApp</label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <IconoWhatsApp className="w-5 h-5 text-green-500" />
                    </div>
                    <input
                        type="tel"
                        {...register('whatsapp')}
                        className={`${inputClasses} pr-4 ${errors.whatsapp ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                        placeholder="3001234567"
                    />
                </div>
                <FormInputError mensaje={errors.whatsapp?.message} />
              </div>
          </div>

          {/* ROL / FUNCIÓN */}
          <div>
            <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1 tracking-widest">Rol / Función</label>
            <div className="relative">
                <select 
                    {...register('rol')} 
                    className="block w-full py-3 px-4 border rounded-xl shadow-sm transition-all outline-none font-black text-base bg-white text-gray-900 border-gray-300 dark:bg-gray-800 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-tkd-blue appearance-none cursor-pointer"
                >
                    <option value={RolUsuario.Admin}>Administrador General</option>
                    <option value={RolUsuario.Editor}>Editor / Secretaría</option>
                    <option value={RolUsuario.Asistente}>Asistente de Sede</option>
                    <option value={RolUsuario.Tutor}>Sabonim (Profesor)</option>
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </div>
            </div>
            {rolSeleccionado && (
                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-start gap-3 border border-blue-200 dark:border-blue-800">
                    <IconoInformacion className="w-5 h-5 text-tkd-blue flex-shrink-0" />
                    <p className="text-[11px] font-bold text-blue-800 dark:text-blue-300 leading-tight uppercase">{DESCRIPCIONES_ROLES[rolSeleccionado]}</p>
                </div>
            )}
          </div>

          {/* SEDE ASIGNADA */}
          {(rolSeleccionado === RolUsuario.Tutor || rolSeleccionado === RolUsuario.Asistente) && (
              <div className="animate-slide-in-right p-4 bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-900/30">
                <label className="block text-[10px] font-black uppercase text-tkd-red mb-2 ml-1 tracking-widest">Sede de Trabajo</label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <IconoCasa className="w-5 h-5 text-tkd-red" />
                    </div>
                    <select 
                        {...register('sedeId')} 
                        className={`block w-full pl-10 pr-10 py-3 border rounded-xl shadow-sm transition-all outline-none font-black text-base appearance-none cursor-pointer
                            bg-white text-gray-900 border-tkd-red/30 
                            dark:bg-gray-800 dark:text-white dark:border-tkd-red/50
                            focus:ring-2 focus:ring-tkd-red ${errors.sedeId ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                    >
                        <option value="">Seleccione Sede...</option>
                        {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-tkd-red/50">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                    </div>
                </div>
                <FormInputError mensaje={errors.sedeId?.message} />
              </div>
          )}

          {/* CORREO DE ACCESO */}
          <div>
            <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1 tracking-widest">Correo Electrónico (Login)</label>
             <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <IconoEmail className="w-5 h-5 text-tkd-blue" />
                </div>
                <input
                    type="email"
                    {...register('email')}
                    disabled={esEdicion}
                    className={`${inputClasses} pr-4 ${esEdicion ? 'opacity-60 bg-gray-100 dark:bg-gray-800 cursor-not-allowed' : ''}`}
                    placeholder="ejemplo@email.com"
                />
            </div>
            <FormInputError mensaje={errors.email?.message} />
          </div>

          {/* CONTRASEÑA */}
          <div>
            <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1 tracking-widest">Contraseña de Acceso</label>
             <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <IconoCandado className="w-5 h-5 text-tkd-blue" />
                </div>
                <input
                    type={mostrarContrasena ? 'text' : 'password'}
                    {...register('contrasena')}
                    placeholder={usuarioActual ? 'Dejar vacío para no cambiar' : 'Mínimo 6 caracteres'}
                    className={`${inputClasses} pr-12 ${errors.contrasena ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    <button
                        type="button"
                        onClick={() => setMostrarContrasena(!mostrarContrasena)}
                        className="p-2 rounded-lg text-gray-400 hover:text-tkd-blue hover:bg-gray-100 dark:hover:bg-gray-800 transition-all focus:outline-none"
                    >
                        {mostrarContrasena ? <IconoOjoAbierto className="w-5 h-5" /> : <IconoOjoCerrado className="w-5 h-5" />}
                    </button>
                </div>
            </div>
            <FormInputError mensaje={errors.contrasena?.message} />
          </div>
        </form>

        <footer className="p-6 border-t dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/20 rounded-b-3xl">
          <button type="button" onClick={handleClose} className="px-5 py-2 text-[11px] font-black uppercase text-gray-400 hover:text-gray-900 dark:text-gray-500 dark:hover:text-white transition-colors">Cancelar</button>
          <button
            type="button"
            onClick={handleSubmit(onSubmit)}
            disabled={!isValid || cargando}
            className="px-8 py-3 bg-tkd-blue text-white rounded-xl font-black uppercase text-[11px] tracking-widest shadow-lg hover:bg-blue-800 transition-all active:scale-95 disabled:bg-gray-400 flex items-center gap-3"
          >
            <IconoGuardar className="w-4 h-4" />
            <span>{cargando ? 'Procesando...' : 'Guardar Cambios'}</span>
          </button>
        </footer>
      </div>
    </div>
  );
};

export default FormularioUsuario;
