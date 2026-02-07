import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { motion } from 'framer-motion';
import { getAuth, updatePassword } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../src/config';
import { useAuth } from '../context/AuthContext';
import { IconoCandado, IconoOjoAbierto, IconoOjoCerrado, IconoExitoAnimado } from '../components/Iconos';
import FormInputError from '../components/FormInputError';
import { useNotificacion } from '../context/NotificacionContext';

const schema = yup.object({
    password: yup.string().min(8, 'Mínimo 8 caracteres.').required('Nueva contraseña requerida.'),
    confirmPassword: yup.string()
        .oneOf([yup.ref('password')], 'Las contraseñas no coinciden.')
        .required('Confirma tu contraseña.'),
}).required();

const CambiarPasswordObligatorio: React.FC = () => {
    const { usuario, logout } = useAuth();
    const { mostrarNotificacion } = useNotificacion();
    const [mostrarPass, setMostrarPass] = useState(false);
    const [cargando, setCargando] = useState(false);
    const [exito, setExito] = useState(false);

    const { register, handleSubmit, formState: { errors } } = useForm({
        resolver: yupResolver(schema)
    });

    const onSubmit = async (data: any) => {
        if (!usuario) return;
        setCargando(true);
        try {
            const auth = getAuth();
            const user = auth.currentUser;

            if (!user) throw new Error("No hay sesión activa.");

            // 1. Actualizar en Firebase Auth
            await updatePassword(user, data.password);

            // 2. Actualizar en Firestore flag
            await updateDoc(doc(db, 'usuarios', usuario.id), {
                requiereCambioPassword: false
            });

            setExito(true);
            mostrarNotificacion("Contraseña actualizada con éxito.", "exito");

            // Recargar para que AuthContext tome el nuevo estado o simplemente esperar
            setTimeout(() => {
                window.location.reload();
            }, 2000);

        } catch (error: any) {
            console.error("Error al cambiar contraseña:", error);
            mostrarNotificacion(error.message || "Error al actualizar contraseña.", "error");
        } finally {
            setCargando(false);
        }
    };

    if (exito) {
        return (
            <div className="fixed inset-0 bg-tkd-blue z-[100] flex items-center justify-center p-6">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                    className="max-w-md w-full bg-white rounded-[3rem] p-12 text-center space-y-6 shadow-2xl"
                >
                    <IconoExitoAnimado className="w-20 h-20 mx-auto text-tkd-blue" />
                    <h2 className="text-3xl font-black uppercase text-tkd-blue tracking-tighter">¡LISTO!</h2>
                    <p className="text-gray-500 font-medium">Tu contraseña ha sido actualizada. Ingresando a tu panel...</p>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-tkd-blue z-[100] flex items-center justify-center p-6 overflow-y-auto">
            <motion.div
                initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
                className="max-w-md w-full bg-white rounded-[3rem] p-10 sm:p-12 space-y-8 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)]"
            >
                <div className="text-center space-y-2">
                    <div className="w-16 h-16 bg-red-50 text-tkd-red rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <IconoCandado className="w-8 h-8" />
                    </div>
                    <h2 className="text-3xl font-black uppercase text-tkd-dark tracking-tighter leading-none">Protege tu cuenta</h2>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Es obligatorio cambiar tu contraseña temporal</p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-gray-400 ml-4 tracking-widest">Nueva Contraseña</label>
                        <div className="relative">
                            <input
                                {...register('password')}
                                type={mostrarPass ? 'text' : 'password'}
                                className="w-full bg-gray-50 border-2 border-transparent focus:border-tkd-blue rounded-2xl p-5 font-bold outline-none transition-all"
                                placeholder="Mínimo 8 caracteres"
                            />
                            <button
                                type="button"
                                onClick={() => setMostrarPass(!mostrarPass)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 hover:text-tkd-blue"
                            >
                                {mostrarPass ? <IconoOjoCerrado className="w-5 h-5" /> : <IconoOjoAbierto className="w-5 h-5" />}
                            </button>
                        </div>
                        <FormInputError mensaje={errors.password?.message as string} />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-gray-400 ml-4 tracking-widest">Confirmar Contraseña</label>
                        <input
                            {...register('confirmPassword')}
                            type={mostrarPass ? 'text' : 'password'}
                            className="w-full bg-gray-50 border-2 border-transparent focus:border-tkd-blue rounded-2xl p-5 font-bold outline-none transition-all"
                            placeholder="Repite tu contraseña"
                        />
                        <FormInputError mensaje={errors.confirmPassword?.message as string} />
                    </div>

                    <button
                        type="submit"
                        disabled={cargando}
                        className="w-full bg-tkd-red text-white py-6 rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-red-700 transition-all hover:scale-[1.02] active:scale-95 disabled:bg-gray-200"
                    >
                        {cargando ? 'Actualizando...' : 'Actualizar y Entrar 🥋'}
                    </button>

                    <button
                        type="button"
                        onClick={logout}
                        className="w-full text-[10px] font-black uppercase text-gray-300 hover:text-tkd-red tracking-widest transition-colors"
                    >
                        Salir y cerrar sesión
                    </button>
                </form>
            </motion.div>
        </div>
    );
};

export default CambiarPasswordObligatorio;
