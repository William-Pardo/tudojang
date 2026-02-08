
// vistas/Login.tsx
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../components/BrandingProvider';
import { IconoCandado, IconoOjoAbierto, IconoOjoCerrado, IconoEmail, IconoLogin, IconoInformacion } from '../components/Iconos';
import LogoDinamico from '../components/LogoDinamico';
import FormInputError from '../components/FormInputError';
import ModalRecuperarContrasena from '../components/ModalRecuperarContrasena';

const schema = yup.object({
  email: yup.string().email('Debe ser un correo válido.').required('El correo electrónico es obligatorio.'),
  contrasena: yup.string().required('La contraseña es obligatoria.'),
}).required();

const Login: React.FC = () => {
  const { login, error: errorLogin, isSubmitting } = useAuth();
  const { tenant } = useTenant();

  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const [modalRecuperarAbierto, setModalRecuperarAbierto] = useState(false);

  const { register, handleSubmit, formState: { errors }, setValue } = useForm<any>({
    resolver: yupResolver(schema),
    defaultValues: { email: '', contrasena: '' }
  });

  const manejarSubmit = async (data: any) => {
    try { await login(data.email, data.contrasena); } catch (e) { }
  };

  const autofillDev = () => {
    setValue('email', 'admin@test.com');
    setValue('contrasena', 'admin123');
  };

  return (
    <>
      <div className="flex items-center justify-center min-h-screen bg-tkd-gray dark:bg-gray-950 p-4 transition-colors duration-500 overflow-y-auto font-poppins">
        <div className="w-full max-w-md p-10 space-y-10 bg-white dark:bg-gray-900 rounded-[3rem] shadow-2xl border border-gray-100 dark:border-white/5 relative my-auto animate-fade-in">

          {/* HEADER: PREMIUM BRANDING */}
          <div className="text-center">
            <div className="bg-tkd-gray dark:bg-gray-800 w-24 h-24 rounded-[2rem] flex items-center justify-center mx-auto shadow-inner border border-gray-100 dark:border-gray-700 mb-8 p-4">
              <LogoDinamico className="w-full h-full object-contain" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-tkd-dark dark:text-white uppercase tracking-tighter leading-tight">
                {tenant?.nombreClub || 'Aliant Tudojang'}
              </h2>
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em]">Sistema de Gestión Administrativa</p>
            </div>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit(manejarSubmit)}>
            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1 tracking-widest">Identificación (Email)</label>
              <div className="relative">
                <IconoEmail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-tkd-blue" />
                <input type="email" {...register('email')} className={`w-full py-4 pl-12 pr-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border-none transition-all outline-none font-black text-xs uppercase shadow-inner ${errors.email ? 'ring-2 ring-red-500' : 'focus:ring-2 focus:ring-tkd-blue dark:text-white'}`} placeholder="ADMIN@ACADEMIA.COM" />
              </div>
              <FormInputError mensaje={errors.email?.message as any} />
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1 tracking-widest">Código de Acceso</label>
              <div className="relative">
                <IconoCandado className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-tkd-blue" />
                <input type={mostrarContrasena ? 'text' : 'password'} {...register('contrasena')} className={`w-full py-4 pl-12 pr-12 bg-gray-50 dark:bg-gray-800 rounded-2xl border-none transition-all outline-none font-black text-xs uppercase shadow-inner ${errors.contrasena ? 'ring-2 ring-red-500' : 'focus:ring-2 focus:ring-tkd-blue dark:text-white'}`} placeholder="••••••••" />
                <button type="button" onClick={() => setMostrarContrasena(!mostrarContrasena)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-tkd-blue">
                  {mostrarContrasena ? <IconoOjoCerrado className="w-5 h-5" /> : <IconoOjoAbierto className="w-5 h-5" />}
                </button>
              </div>
              <FormInputError mensaje={errors.contrasena?.message as any} />
            </div>

            <div className="text-right">
              <button type="button" onClick={() => setModalRecuperarAbierto(true)} className="text-[10px] font-black text-tkd-blue uppercase tracking-widest hover:underline">Recuperar Acceso Técnico</button>
            </div>

            {errorLogin && <div className="p-4 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-500 rounded-2xl text-[10px] font-black text-center border border-red-100 dark:border-red-900/20 uppercase animate-shake">{errorLogin}</div>}

            <button type="submit" disabled={isSubmitting} className="w-full py-5 bg-tkd-red text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-[0_15px_30px_-10px_rgba(205,46,58,0.5)] hover:bg-red-800 active:scale-95 transition-all disabled:bg-gray-300 flex items-center justify-center gap-3">
              <IconoLogin className="w-5 h-5" />
              <span>{isSubmitting ? 'Verificando...' : 'Acceder al Sistema'}</span>
            </button>
          </form>

        </div>
      </div>
      <ModalRecuperarContrasena abierto={modalRecuperarAbierto} onCerrar={() => setModalRecuperarAbierto(false)} />
    </>
  );
};

export default Login;
