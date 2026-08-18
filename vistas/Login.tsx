
// vistas/Login.tsx
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useAuth } from '../context/AuthContext';
import { IconoCandado, IconoOjoAbierto, IconoOjoCerrado, IconoEmail, IconoLogin } from '../components/Iconos';
import FormInputError from '../components/FormInputError';
import ModalRecuperarContrasena from '../components/ModalRecuperarContrasena';
import AuthCardShell from '../components/AuthCardShell';

const schema = yup.object({
  email: yup.string().email('Debe ser un correo válido.').required('El correo electrónico es obligatorio.'),
  contrasena: yup.string().required('La contraseña es obligatoria.'),
}).required();

const Login: React.FC = () => {
  const { login, error: errorLogin, isSubmitting } = useAuth();

  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const [modalRecuperarAbierto, setModalRecuperarAbierto] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<any>({
    resolver: yupResolver(schema),
    defaultValues: { email: '', contrasena: '' }
  });

  const manejarSubmit = async (data: any) => {
    try { await login(data.email, data.contrasena); } catch (e) { }
  };

  return (
    <>
      <AuthCardShell>
        <div className="text-center -mt-2">
          <div className="inline-block px-2 py-1 bg-green-100 dark:bg-green-900/30 rounded-full">
            <span className="text-[8px] font-black text-green-700 dark:text-green-400 uppercase tracking-wider">✓ Versión Actualizada 16-FEB-2026</span>
          </div>
        </div>

        <div>
          <form className="space-y-4 sm:space-y-5 landscape:space-y-3" onSubmit={handleSubmit(manejarSubmit)}>
            <div>
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1 tracking-widest">Correo Electrónico</label>
              <div className="relative">
                <IconoEmail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-tkd-blue" />
                <input type="email" {...register('email')} className={`w-full py-2.5 sm:py-3 pl-10 pr-4 rounded-xl border-2 transition-all outline-none font-bold text-sm sm:text-base ${errors.email ? 'border-red-500' : 'border-gray-100 focus:border-tkd-blue dark:bg-gray-800 dark:border-gray-700 dark:text-white'}`} placeholder="ejemplo@academia.com" />
              </div>
              <FormInputError mensaje={errors.email?.message as string} />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1 tracking-widest">Contraseña</label>
              <div className="relative">
                <IconoCandado className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-tkd-blue" />
                <input type={mostrarContrasena ? 'text' : 'password'} {...register('contrasena')} className={`w-full py-2.5 sm:py-3 pl-10 pr-10 rounded-xl border-2 transition-all outline-none font-bold text-sm sm:text-base ${errors.contrasena ? 'border-red-500' : 'border-gray-100 focus:border-tkd-blue dark:bg-gray-800 dark:border-gray-700 dark:text-white'}`} placeholder="••••••••" />
                <button type="button" onClick={() => setMostrarContrasena(!mostrarContrasena)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-tkd-blue">
                  {mostrarContrasena ? <IconoOjoCerrado className="w-4 h-4 sm:w-5 sm:h-5" /> : <IconoOjoAbierto className="w-4 h-4 sm:w-5 sm:h-5" />}
                </button>
              </div>
              <FormInputError mensaje={errors.contrasena?.message as string} />
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
        </div>
      </AuthCardShell>
      <ModalRecuperarContrasena abierto={modalRecuperarAbierto} onCerrar={() => setModalRecuperarAbierto(false)} />
    </>
  );
};

export default Login;
