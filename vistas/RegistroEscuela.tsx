
// vistas/RegistroEscuela.tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { buscarTenantPorSlug, registrarNuevaEscuela } from '../servicios/configuracionApi';
import { IconoLogoOficial, IconoCasa, IconoEnviar, IconoExitoAnimado, IconoInformacion } from '../components/Iconos';
import { useNotificacion } from '../context/NotificacionContext';
import { DATOS_RECAUDO_MASTER, PLANES_SAAS } from '../constantes';
import FormInputError from '../components/FormInputError';
import { guardarCookie, obtenerCookie } from '../utils/cookieUtils';

const schema = yup.object({
    nombreClub: yup.string().required('El nombre de la academia es obligatorio.'),
    email: yup.string().email('Email inválido.').required('El email es obligatorio.'),
    slug: yup.string()
        .matches(/^[a-z0-9-]+$/, 'Solo letras minúsculas, números y guiones.')
        .min(3, 'Mínimo 3 caracteres.')
        .required('El nombre de la URL es obligatorio.'),
}).required();

const RegistroEscuela: React.FC = () => {
    const [paso, setPaso] = useState<'formulario' | 'exito'>('formulario');
    const [cargando, setCargando] = useState(false);
    const { mostrarNotificacion } = useNotificacion();
    const [planSeleccionado, setPlanSeleccionado] = useState(obtenerCookie('plan_pendiente') || 'starter');
    const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm({
        resolver: yupResolver(schema),
        defaultValues: obtenerCookie('registro_pendiente') || {}
    });

    const slugDeseado = watch('slug');

    const onSubmit = async (data: any) => {
        setCargando(true);
        try {
            const existe = await buscarTenantPorSlug(data.slug);
            if (existe) {
                mostrarNotificacion("Este nombre de URL ya está ocupado. Elige otro.", "error");
                setCargando(false);
                return;
            }

            await registrarNuevaEscuela({
                nombreClub: data.nombreClub,
                slug: data.slug,
                emailClub: data.email,
                plan: planSeleccionado
            });

            guardarCookie('registro_finalizado', { ...data, plan: planSeleccionado });
            setPaso('exito');
        } catch (error) {
            mostrarNotificacion("Error al procesar el registro.", "error");
        } finally {
            setCargando(false);
        }
    };

    if (paso === 'exito') {
        return (
            <div className="min-h-screen bg-white dark:bg-tkd-dark flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-[3rem] p-12 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.1)] text-center space-y-8 border border-gray-100 dark:border-gray-800 animate-fade-in">
                    <IconoExitoAnimado className="mx-auto text-green-500" />
                    <div className="space-y-2">
                        <h2 className="text-3xl font-black uppercase text-tkd-dark dark:text-white tracking-tighter">¡Reserva Exitosa!</h2>
                        <p className="text-sm text-gray-500 leading-relaxed uppercase font-bold tracking-tight px-4">
                            Hemos reservado la URL <br /> <span className="text-tkd-blue">"{slugDeseado}.tudojang.com"</span> <br /> para tu academia.
                        </p>
                    </div>
                    <div className="p-8 bg-blue-50/50 dark:bg-blue-900/10 rounded-[2.5rem] border border-blue-100 dark:border-blue-800 text-left">
                        <p className="text-[10px] font-black uppercase text-tkd-blue mb-4 tracking-[0.2em]">Acceso Inmediato Habilitado:</p>
                        <ul className="text-[11px] font-black text-gray-700 dark:text-gray-300 space-y-3 uppercase">
                            <li className="flex gap-3"><span className="text-tkd-blue">01.</span> Tu entorno ya está listo para operar.</li>
                            <li className="flex gap-3"><span className="text-tkd-blue">02.</span> Tienes 7 días de prueba completa.</li>
                            <li className="flex gap-3"><span className="text-tkd-blue">03.</span> Límite de trial: 15 estudiantes.</li>
                        </ul>
                    </div>
                    <Link
                        to="/login"
                        className="block w-full bg-tkd-blue text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-blue-800 transition-all hover:scale-[1.02] active:scale-95 text-center"
                    >
                        Entrar a mi Academia
                    </Link>
                    <a
                        href={`https://wa.me/57${DATOS_RECAUDO_MASTER.whatsappSoporte}?text=Hola! Acabo de registrar mi academia ${slugDeseado}. Deseo asesoría técnica.`}
                        target="_blank"
                        className="block w-full text-gray-400 py-2 font-black uppercase text-[9px] tracking-widest hover:text-tkd-blue transition-all text-center"
                    >
                        O hablar con un consultor
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white dark:bg-tkd-dark flex items-center justify-center p-6 transition-colors duration-500">
            <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-2 gap-20 items-center animate-fade-in">
                <div className="space-y-10">
                    <div className="w-20 h-20 bg-tkd-blue/5 rounded-3xl flex items-center justify-center border border-tkd-blue/10">
                        <IconoLogoOficial className="w-12 h-12" />
                    </div>
                    <div className="space-y-4">
                        <h1 className="text-5xl md:text-6xl font-black text-tkd-dark dark:text-white uppercase tracking-tighter leading-none">
                            Crea tu <br /> <span className="text-tkd-blue">Dojang Digital</span>
                        </h1>
                        <p className="text-gray-400 text-lg font-bold uppercase leading-tight tracking-tight max-w-sm">
                            La plataforma definitiva para escalar la gestión de tu escuela de Taekwondo.
                        </p>
                    </div>
                    <div className="flex items-center gap-5 p-6 bg-gray-50 dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm max-w-sm">
                        <div className="bg-tkd-red/10 p-3 rounded-2xl">
                            <IconoCasa className="w-8 h-8 text-tkd-red" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Identidad en la Red:</p>
                            <p className="text-sm font-black text-tkd-blue uppercase tracking-tight">{slugDeseado ? `${slugDeseado}.tudojang.com` : 'nombre.tudojang.com'}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-900 p-10 md:p-12 rounded-[3.5rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.08)] border border-gray-50 dark:border-gray-800 space-y-8">
                    <div className="text-center lg:text-left">
                        <h2 className="text-2xl font-black uppercase text-tkd-dark dark:text-white tracking-tight">Formulario de Alta</h2>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-1">Registra los datos maestros de tu dojang</p>
                    </div>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        <div>
                            <label className="text-[10px] font-black uppercase text-gray-400 block mb-2 ml-2 tracking-widest">Nombre de la Institución</label>
                            <input {...register('nombreClub')} className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl p-5 text-sm font-black dark:text-white focus:ring-2 focus:ring-tkd-blue shadow-inner transition-all" placeholder="EJ: CLUB DRAGONES DEL SUR" />
                            <FormInputError mensaje={errors.nombreClub?.message as string} />
                        </div>

                        <div>
                            <label className="text-[10px] font-black uppercase text-gray-400 block mb-2 ml-2 tracking-widest">Correo del Director</label>
                            <input {...register('email')} type="email" className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl p-5 text-sm font-black dark:text-white focus:ring-2 focus:ring-tkd-blue shadow-inner transition-all" placeholder="DIRECTOR@DOJANG.COM" />
                            <FormInputError mensaje={errors.email?.message as string} />
                        </div>

                        <div>
                            <label className="text-[10px] font-black uppercase text-tkd-blue block mb-2 ml-2 tracking-widest">Nombre Corto (Para tu URL)</label>
                            <div className="relative group">
                                <input {...register('slug')} className="w-full bg-blue-50/50 dark:bg-blue-900/20 border-2 border-transparent focus:border-tkd-blue rounded-2xl p-5 text-sm font-black text-tkd-blue outline-none lowercase transition-all" placeholder="mi-escuela" />
                                <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-blue-300 uppercase tracking-widest">.tudojang.com</span>
                            </div>
                            <FormInputError mensaje={errors.slug?.message as string} />
                            <p className="text-[9px] text-gray-400 font-bold mt-3 uppercase px-2 leading-relaxed opacity-60">Este nombre será tu acceso directo y marca digital única en el sistema.</p>
                        </div>

                        <button
                            type="submit"
                            disabled={cargando}
                            className="w-full bg-tkd-dark text-white py-6 rounded-[2rem] font-black uppercase tracking-[0.2em] text-xs shadow-2xl hover:bg-tkd-blue transition-all flex items-center justify-center gap-4 disabled:bg-gray-200 disabled:text-gray-400 hover:scale-[1.02] active:scale-95"
                        >
                            {cargando ? <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div> : <IconoEnviar className="w-5 h-5" />}
                            Reservar mi Entorno
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default RegistroEscuela;
