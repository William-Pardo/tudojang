
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
    try { await login(data.email, data.contrasena); } catch (e) {}
  };

  const autofillDev = () => {
      setValue('email', 'admin@test.com');
      setValue('contrasena', 'admin123');
  };

  return (
    <>
      <div className="flex items-center justify-center min-h-screen bg-tkd-blue p-4 transition-colors duration-500 overflow-y-auto">
        <div className="w-full max-w-md p-6 sm:p-8 landscape:p-6 space-y-6 sm:space-y-8 landscape:space-y-4 bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-white/10 relative my-auto">
          
          {/* HEADER: En landscape se pone de lado para ahorrar espacio vertical */}
          <div className="text-center landscape:flex landscape:items-center landscape:text-left landscape:gap-5">
              <div className="bg-tkd-gray dark:bg-gray-800 w-20 h-20 sm:w-24 sm:h-24 landscape:w-16 landscape:h-16 rounded-2xl flex items-center justify-center mx-auto landscape:mx-0 shadow-inner border border-gray-100 dark:border-gray-700 flex-shrink-0">
                <LogoDinamico className="w-12 h-12 sm:w-16 sm:h-16 landscape:w-10 landscape:h-10" />
              </div>
              <div className="mt-4 sm:mt-6 landscape:mt-0">
                <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight leading-tight">
                    {tenant?.nombreClub || 'Bienvenido'}
                </h2>
                <p className="mt-1 sm:mt-2 text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-widest">Gestión Administrativa</p>
              </div>
          </div>
          
          <form className="space-y-4 sm:space-y-5 landscape:space-y-3" onSubmit={handleSubmit(manejarSubmit)}>
            <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1 tracking-widest">Correo Electrónico</label>
                <div className="relative">
                    <IconoEmail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-tkd-blue" />
                    <input type="email" {...register('email')} className={`w-full py-2.5 sm:py-3 pl-10 pr-4 rounded-xl border-2 transition-all outline-none font-bold text-sm sm:text-base ${errors.email ? 'border-red-500' : 'border-gray-100 focus:border-tkd-blue dark:bg-gray-800 dark:border-gray-700 dark:text-white'}`} placeholder="ejemplo@academia.com" />
                </div>
                <FormInputError mensaje={errors.email?.message} />
            </div>

            <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1 tracking-widest">Contraseña</label>
                <div className="relative">
                    <IconoCandado className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-tkd-blue" />
                    <input type={mostrarContrasena ? 'text' : 'password'} {...register('contrasena')} className={`w-full py-2.5 sm:py-3 pl-10 pr-10 rounded-xl border-2 transition-all outline-none font-bold text-sm sm:text-base ${errors.contrasena ? 'border-red-500' : 'border-gray-100 focus:border-tkd-blue dark:bg-gray-800 dark:border-gray-700 dark:text-white'}`} placeholder="••••••••" />
                    <button type="button" onClick={() => setMostrarContrasena(!mostrarContrasena)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-tkd-blue">
                        {mostrarContrasena ? <IconoOjoCerrado className="w-4 h-4 sm:w-5 sm:h-5"/> : <IconoOjoAbierto className="w-4 h-4 sm:w-5 sm:h-5" />}
                    </button>
                </div>
                <FormInputError mensaje={errors.contrasena?.message} />
            </div>

            <div className="text-right">
              <button type="button" onClick={() => setModalRecuperarAbierto(true)} className="text-[10px] sm:text-xs font-black text-tkd-blue uppercase hover:underline">¿Olvidaste tu acceso?</button>
            </div>
            
            {errorLogin && <div className="p-2 sm:p-3 bg-red-50 text-red-600 rounded-xl text-[10px] sm:text-xs font-bold text-center border border-red-100 uppercase animate-shake">{errorLogin}</div>}

            <button type="submit" disabled={isSubmitting} className="w-full py-3.5 sm:py-4 bg-tkd-red text-white rounded-xl font-black uppercase text-[10px] sm:text-xs tracking-widest shadow-xl hover:bg-red-700 active:scale-95 transition-all disabled:bg-gray-300 flex items-center justify-center gap-2">
                <IconoLogin className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>{isSubmitting ? 'Verificando...' : 'Iniciar Sesión'}</span>
            </button>
          </form>

          {/* ATAJO DESARROLLO */}
          <div className="pt-4 mt-4 border-t dark:border-gray-800 text-center">
             <button onClick={autofillDev} className="inline-flex items-center gap-2 text-[8px] sm:text-[9px] font-black uppercase text-gray-400 hover:text-tkd-blue transition-colors">
                <IconoInformacion className="w-3 h-3" /> Usar credenciales de prueba
             </button>
          </div>
        </div>
      </div>
      <ModalRecuperarContrasena abierto={modalRecuperarAbierto} onCerrar={() => setModalRecuperarAbierto(false)} />
    </>
  );
};

export default Login;
