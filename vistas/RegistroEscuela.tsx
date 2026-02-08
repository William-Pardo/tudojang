
// vistas/RegistroEscuela.tsx - VERSIÓN SIMPLIFICADA SIN SLUGS
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { motion } from 'framer-motion';
import { registrarNuevaEscuela } from '../servicios/configuracionApi';
import { IconoLogoOficial, IconoEnviar, IconoExitoAnimado, IconoCopiar } from '../components/Iconos';
import { useNotificacion } from '../context/NotificacionContext';
import FormInputError from '../components/FormInputError';
import { useAuth } from '../context/AuthContext';

const schema = yup.object({
    nombreClub: yup.string().min(3, 'Mínimo 3 letras.').required('El nombre de la academia es obligatorio.'),
    nombreDirector: yup.string().min(6, 'Ingresa nombre y apellido.').required('El nombre del director es obligatorio.'),
    telefonoDirector: yup.string().min(10, 'Formato inválido.').required('El teléfono es obligatorio.'),
    email: yup.string().email('Email inválido.').required('El email es obligatorio.'),
}).required();

const RegistroEscuela: React.FC = () => {
    const [finalizado, setFinalizado] = useState(false);
    const [cargando, setCargando] = useState(false);
    const { mostrarNotificacion } = useNotificacion();
    const [contrasenaCopiada, setContrasenaCopiada] = useState(false);
    const [datosRegistro, setDatosRegistro] = useState<any>(null);
    const { login } = useAuth();

    const { register, handleSubmit, formState: { errors } } = useForm({
        resolver: yupResolver(schema),
        mode: 'onChange'
    });

    const onSubmit = async (data: any) => {
        setCargando(true);
        try {
            console.log('📝 Iniciando registro simplificado...');

            // Generar contraseña aleatoria segura
            const generarPassword = () => {
                const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*';
                let password = '';
                for (let i = 0; i < 12; i++) {
                    password += chars.charAt(Math.floor(Math.random() * chars.length));
                }
                return password;
            };

            const passwordGenerada = generarPassword();

            // Generar tenantId automático basado en timestamp
            const timestamp = Date.now();
            const tenantId = `tnt-${timestamp}`;

            // Preparar datos para registro
            const datosEscuela = {
                nombreClub: data.nombreClub,
                representanteLegal: data.nombreDirector,
                emailClub: data.email,
                pagoNequi: data.telefonoDirector,
                tenantId: tenantId,
                slug: tenantId,
                plan: 'starter',
                limiteEstudiantes: 50,
                limiteUsuarios: 2,
                limiteSedes: 1,
                estadoSuscripcion: 'activo' as const,
                valorMensualidad: 140000,
            };

            console.log('🚀 Registrando escuela:', datosEscuela);

            // Registrar escuela (esto también crea el usuario en Auth)
            await registrarNuevaEscuela(datosEscuela, passwordGenerada);

            console.log('✅ Registro completado exitosamente');

            // Guardar datos para mostrar
            setDatosRegistro({
                email: data.email,
                password: passwordGenerada,
                nombreClub: data.nombreClub
            });

            setFinalizado(true);
            mostrarNotificacion('¡Escuela registrada con éxito!', 'success');

        } catch (error: any) {
            console.error('❌ Error en registro:', error);
            mostrarNotificacion(error.message || 'Error al registrar la escuela', 'error');
        } finally {
            setCargando(false);
        }
    };

    const copiarPassword = () => {
        if (datosRegistro?.password) {
            navigator.clipboard.writeText(datosRegistro.password);
            setContrasenaCopiada(true);
            mostrarNotificacion('Contraseña copiada al portapapeles', 'success');
        }
    };

    const irAlDashboard = async () => {
        if (!datosRegistro) return;

        try {
            // Hacer login automático
            await login(datosRegistro.email, datosRegistro.password);
            // El AuthContext redirigirá automáticamente al dashboard
        } catch (error: any) {
            console.error('Error en login automático:', error);
            mostrarNotificacion('Error al iniciar sesión. Por favor, inicia sesión manualmente.', 'error');
        }
    };

    if (finalizado && datosRegistro) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-tkd-dark via-gray-900 to-tkd-dark flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white dark:bg-gray-800 rounded-[3rem] shadow-2xl w-full max-w-2xl p-12 text-center space-y-8"
                >
                    <IconoExitoAnimado className="mx-auto text-green-500" />

                    <div className="space-y-4">
                        <h1 className="text-4xl font-black uppercase text-gray-900 dark:text-white tracking-tight">
                            ¡Bienvenido a Tudojang!
                        </h1>
                        <p className="text-lg text-gray-600 dark:text-gray-300 font-bold">
                            Tu academia <span className="text-tkd-blue">{datosRegistro.nombreClub}</span> ha sido creada exitosamente
                        </p>
                    </div>

                    <div className="bg-gradient-to-br from-tkd-blue/10 to-tkd-red/10 p-8 rounded-3xl border-2 border-tkd-blue/20 space-y-6">
                        <div className="space-y-2">
                            <p className="text-xs font-black uppercase text-gray-500 tracking-widest">
                                Tus Credenciales de Acceso
                            </p>
                            <div className="space-y-3">
                                <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl">
                                    <p className="text-[10px] font-black uppercase text-gray-400 mb-1">Email</p>
                                    <p className="text-lg font-black text-gray-900 dark:text-white">{datosRegistro.email}</p>
                                </div>
                                <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl">
                                    <p className="text-[10px] font-black uppercase text-gray-400 mb-1">Contraseña Temporal</p>
                                    <p className="text-2xl font-black text-tkd-blue font-mono tracking-wider">
                                        {datosRegistro.password}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={copiarPassword}
                            className={`w-full py-4 rounded-2xl font-black uppercase text-sm transition-all flex items-center justify-center gap-3 ${contrasenaCopiada
                                    ? 'bg-green-500 text-white'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                                }`}
                        >
                            <IconoCopiar className="w-5 h-5" />
                            {contrasenaCopiada ? '¡Copiada!' : 'Copiar Contraseña'}
                        </button>
                    </div>

                    <div className="space-y-4">
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-bold">
                            💡 Guarda esta contraseña. Podrás cambiarla después en Configuración.
                        </p>

                        <button
                            onClick={irAlDashboard}
                            disabled={!contrasenaCopiada}
                            className={`w-full py-6 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl transition-all ${contrasenaCopiada
                                    ? 'bg-tkd-blue text-white hover:bg-blue-800 hover:scale-[1.02] active:scale-95 cursor-pointer'
                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed grayscale'
                                }`}
                        >
                            {contrasenaCopiada ? 'Entrar a mi Academia 🚀' : 'Copia la contraseña para continuar'}
                        </button>
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-tkd-dark via-gray-900 to-tkd-dark flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-gray-800 rounded-[3rem] shadow-2xl w-full max-w-2xl p-12"
            >
                <div className="text-center mb-10">
                    <IconoLogoOficial className="w-20 h-20 mx-auto mb-6 text-tkd-blue" />
                    <h1 className="text-4xl font-black uppercase text-gray-900 dark:text-white tracking-tight mb-3">
                        Crea tu Academia
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest">
                        Gestión profesional de Taekwondo
                    </p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    {/* Nombre de la Academia */}
                    <div>
                        <label className="text-xs font-black uppercase text-gray-500 dark:text-gray-400 block mb-2 ml-2 tracking-widest">
                            Nombre de tu Academia
                        </label>
                        <input
                            {...register('nombreClub')}
                            type="text"
                            placeholder="Ej: Taekwondo Ga Jog"
                            className="w-full bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-2xl p-4 text-base font-bold text-gray-900 dark:text-white uppercase outline-none focus:border-tkd-blue transition-all"
                        />
                        {errors.nombreClub && <FormInputError mensaje={errors.nombreClub.message || ''} />}
                    </div>

                    {/* Nombre del Director */}
                    <div>
                        <label className="text-xs font-black uppercase text-gray-500 dark:text-gray-400 block mb-2 ml-2 tracking-widest">
                            Nombre del Director
                        </label>
                        <input
                            {...register('nombreDirector')}
                            type="text"
                            placeholder="Nombre completo"
                            className="w-full bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-2xl p-4 text-base font-bold text-gray-900 dark:text-white outline-none focus:border-tkd-blue transition-all"
                        />
                        {errors.nombreDirector && <FormInputError mensaje={errors.nombreDirector.message || ''} />}
                    </div>

                    {/* Email */}
                    <div>
                        <label className="text-xs font-black uppercase text-gray-500 dark:text-gray-400 block mb-2 ml-2 tracking-widest">
                            Email de Acceso
                        </label>
                        <input
                            {...register('email')}
                            type="email"
                            placeholder="director@tuacademia.com"
                            className="w-full bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-2xl p-4 text-base font-bold text-gray-900 dark:text-white outline-none focus:border-tkd-blue transition-all"
                        />
                        {errors.email && <FormInputError mensaje={errors.email.message || ''} />}
                    </div>

                    {/* Teléfono */}
                    <div>
                        <label className="text-xs font-black uppercase text-gray-500 dark:text-gray-400 block mb-2 ml-2 tracking-widest">
                            Teléfono / WhatsApp
                        </label>
                        <input
                            {...register('telefonoDirector')}
                            type="tel"
                            placeholder="3001234567"
                            className="w-full bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-2xl p-4 text-base font-bold text-gray-900 dark:text-white outline-none focus:border-tkd-blue transition-all"
                        />
                        {errors.telefonoDirector && <FormInputError mensaje={errors.telefonoDirector.message || ''} />}
                    </div>

                    {/* Botón de Registro */}
                    <button
                        type="submit"
                        disabled={cargando}
                        className="w-full bg-tkd-blue text-white py-6 rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 hover:bg-blue-800 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {cargando ? (
                            <>
                                <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                                Creando Academia...
                            </>
                        ) : (
                            <>
                                <IconoEnviar className="w-6 h-6" />
                                Crear Mi Academia
                            </>
                        )}
                    </button>

                    {/* Link al Login */}
                    <div className="text-center pt-4">
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-bold">
                            ¿Ya tienes una cuenta?{' '}
                            <Link to="/login" className="text-tkd-blue hover:text-blue-800 font-black uppercase">
                                Inicia Sesión
                            </Link>
                        </p>
                    </div>
                </form>
            </motion.div>
        </div>
    );
};

export default RegistroEscuela;
