
// vistas/RegistroEscuela.tsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { motion, AnimatePresence } from 'framer-motion';
import { buscarTenantPorSlug, registrarNuevaEscuela } from '../servicios/configuracionApi';
import { IconoLogoOficial, IconoCasa, IconoEnviar, IconoExitoAnimado, IconoInformacion, IconoAprobar } from '../components/Iconos';
import { useNotificacion } from '../context/NotificacionContext';
import { DATOS_RECAUDO_MASTER } from '../constantes';
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

type FormPaso = 'nombre' | 'contacto' | 'identidad';

const RegistroEscuela: React.FC = () => {
    const [pasoActual, setPasoActual] = useState<FormPaso>('nombre');
    const [finalizado, setFinalizado] = useState(false);
    const [cargando, setCargando] = useState(false);
    const { mostrarNotificacion } = useNotificacion();
    const [planSeleccionado] = useState(obtenerCookie('plan_pendiente') || 'starter');

    // Estados para validación de slug en tiempo real
    const [slugDisponible, setSlugDisponible] = useState<boolean | null>(null);
    const [validandoSlug, setValidandoSlug] = useState(false);

    const { register, handleSubmit, formState: { errors }, watch, trigger } = useForm({
        resolver: yupResolver(schema),
        mode: 'onChange',
        defaultValues: obtenerCookie('registro_pendiente') || {}
    });

    const slugDeseado = watch('slug');
    const nombreAcademia = watch('nombreClub');

    // Validación de slug con debounce
    useEffect(() => {
        if (!slugDeseado || slugDeseado.length < 3) {
            setSlugDisponible(null);
            return;
        }

        const timer = setTimeout(async () => {
            setValidandoSlug(true);
            try {
                const existe = await buscarTenantPorSlug(slugDeseado);
                setSlugDisponible(!existe);
            } catch (error) {
                console.error("Error validando slug:", error);
            } finally {
                setValidandoSlug(false);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [slugDeseado]);

    const irASiguiente = async (siguiente: FormPaso) => {
        let campoAValidar: any = '';
        if (pasoActual === 'nombre') campoAValidar = 'nombreClub';
        if (pasoActual === 'contacto') campoAValidar = 'email';

        const esValido = await trigger(campoAValidar);
        if (esValido) setPasoActual(siguiente);
    };

    const onSubmit = async (data: any) => {
        if (!slugDisponible) return;
        setCargando(true);
        try {
            await registrarNuevaEscuela({
                nombreClub: data.nombreClub,
                slug: data.slug,
                emailClub: data.email,
                plan: planSeleccionado
            });

            guardarCookie('registro_finalizado', { ...data, plan: planSeleccionado });
            setFinalizado(true);
        } catch (error) {
            mostrarNotificacion("Error al procesar el registro.", "error");
        } finally {
            setCargando(false);
        }
    };

    if (finalizado) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center p-6 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]">
                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    className="max-w-md w-full bg-white rounded-[3rem] p-12 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.15)] text-center space-y-8 border border-gray-100"
                >
                    <IconoExitoAnimado className="mx-auto text-tkd-blue w-20 h-20" />
                    <div className="space-y-4">
                        <h2 className="text-4xl font-black uppercase tracking-tighter text-tkd-dark">¡Portal Activo!</h2>
                        <p className="text-sm text-gray-500 font-bold uppercase tracking-tight">
                            Hemos desplegado tu entorno en: <br />
                            <span className="text-tkd-blue text-lg">"{slugDeseado}.tudojang.com"</span>
                        </p>
                    </div>

                    <div className="p-8 bg-tkd-blue/5 rounded-[2.5rem] border border-tkd-blue/10 text-left space-y-4">
                        <div className="flex items-center gap-3">
                            <IconoInformacion className="w-5 h-5 text-tkd-blue" />
                            <p className="text-[10px] font-black uppercase text-tkd-blue tracking-widest">Credenciales de Trial:</p>
                        </div>
                        <ul className="text-[11px] font-bold text-gray-600 space-y-2 uppercase tracking-tight leading-relaxed">
                            <li><span className="text-tkd-blue">•</span> Acceso total por 7 días.</li>
                            <li><span className="text-tkd-blue">•</span> Límite de 15 alumnos iniciales.</li>
                            <li><span className="text-tkd-blue">•</span> Soporte técnico prioritario activado.</li>
                        </ul>
                    </div>

                    <Link
                        to="/login"
                        className="block w-full bg-tkd-blue text-white py-6 rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-blue-800 transition-all hover:scale-[1.02] active:scale-95 text-center text-sm"
                    >
                        Entrar a mi Academia
                    </Link>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white text-tkd-dark font-sans selection:bg-tkd-blue selection:text-white overflow-x-hidden pt-10 pb-20 px-6 sm:px-12">
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center min-h-[80vh]">

                {/* LADO IZQUIERDO: TEXTO Y PREVIEW */}
                <div className="space-y-12">
                    <div className="flex items-center gap-4 mb-16">
                        <IconoLogoOficial className="w-16 h-16" />
                        <div className="h-10 w-px bg-gray-200" />
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em]">Registro de Nueva Academia</span>
                    </div>

                    <AnimatePresence mode="wait">
                        <motion.div
                            key={pasoActual}
                            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                            className="space-y-6"
                        >
                            <h1 className="text-6xl md:text-7xl font-black uppercase tracking-tighter leading-[0.9]">
                                {pasoActual === 'nombre' && <>Nombra tu <span className="text-tkd-blue">Legado Marcial</span></>}
                                {pasoActual === 'contacto' && <>Configura tu <span className="text-tkd-blue">Acceso Maestro</span></>}
                                {pasoActual === 'identidad' && <>Crea tu <span className="text-tkd-blue">Dojang Digital</span></>}
                            </h1>
                            <p className="text-lg text-gray-500 font-medium uppercase leading-relaxed max-w-md">
                                {pasoActual === 'nombre' && "Comienza el viaje. El nombre de tu academia es el primer paso para la digitalización de tu enseñanza."}
                                {pasoActual === 'contacto' && "Necesitamos tu correo institucional para enviarte las llaves de tu nuevo centro de gestión digital."}
                                {pasoActual === 'identidad' && "Define tu dirección en la red. Este será el portal donde tus alumnos y padres de familia interactuarán con tu academia."}
                            </p>
                        </motion.div>
                    </AnimatePresence>

                    {/* VISTA PREVIA DEL DOMINIO: AYUDA VISUAL SOLICITADA */}
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="relative max-w-sm mt-12"
                    >
                        <div className="bg-tkd-dark text-white p-8 rounded-[3rem] shadow-2xl relative z-10 overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-tkd-blue/20 rounded-full blur-3xl group-hover:bg-tkd-blue/40 transition-all" />
                            <div className="flex items-center gap-5 relative z-10">
                                <div className="bg-white/10 p-4 rounded-2xl border border-white/20">
                                    <IconoCasa className="w-8 h-8 text-tkd-blue" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-tkd-blue uppercase tracking-[0.3em] mb-1">Identidad Digital:</p>
                                    <p className="text-lg font-black tracking-tight leading-none truncate max-w-[200px]">
                                        {slugDeseado ? slugDeseado : 'mi-academia'}
                                        <span className="text-blue-400 opacity-50">.tudojang.com</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-tkd-red/10 rounded-full blur-2xl" />
                    </motion.div>
                </div>

                {/* LADO DERECHO: FORMULARIO POR PASOS */}
                <div className="relative">
                    <div className="bg-white p-10 md:p-16 rounded-[4rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.1)] border border-gray-100 space-y-10">

                        {/* INDICADOR DE PASOS */}
                        <div className="flex gap-2 justify-center lg:justify-start mb-8">
                            {(['nombre', 'contacto', 'identidad'] as FormPaso[]).map((p, i) => (
                                <div
                                    key={p}
                                    className={`h-1.5 rounded-full transition-all duration-500 ${pasoActual === p ? 'w-12 bg-tkd-blue' : 'w-4 bg-gray-100'}`}
                                />
                            ))}
                        </div>

                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                            <AnimatePresence mode="wait">
                                {pasoActual === 'nombre' && (
                                    <motion.div
                                        key="step1"
                                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                                        className="space-y-6"
                                    >
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase text-gray-400 ml-4 tracking-widest">Nombre de la Institución</label>
                                            <input
                                                {...register('nombreClub')}
                                                autoFocus
                                                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), irASiguiente('contacto'))}
                                                className="w-full bg-gray-50 border-2 border-transparent focus:border-tkd-blue focus:bg-white rounded-3xl p-6 text-xl font-black outline-none transition-all shadow-inner"
                                                placeholder="EJ: CLUB DRAGONES"
                                            />
                                            <FormInputError mensaje={errors.nombreClub?.message as string} />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => irASiguiente('contacto')}
                                            className="w-full bg-tkd-dark text-white py-6 rounded-[2rem] font-black uppercase tracking-widest text-xs hover:bg-tkd-blue transition-all flex items-center justify-center gap-4 group"
                                        >
                                            Continuar
                                            <IconoEnviar className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                        </button>
                                    </motion.div>
                                )}

                                {pasoActual === 'contacto' && (
                                    <motion.div
                                        key="step2"
                                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                                        className="space-y-6"
                                    >
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase text-gray-400 ml-4 tracking-widest">Correo del Director</label>
                                            <input
                                                {...register('email')}
                                                type="email"
                                                autoFocus
                                                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), irASiguiente('identidad'))}
                                                className="w-full bg-gray-50 border-2 border-transparent focus:border-tkd-blue focus:bg-white rounded-3xl p-6 text-xl font-black outline-none transition-all shadow-inner"
                                                placeholder="DIRECTOR@DOJANG.COM"
                                            />
                                            <FormInputError mensaje={errors.email?.message as string} />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <button type="button" onClick={() => setPasoActual('nombre')} className="py-6 font-black uppercase text-[10px] tracking-widest text-gray-400 hover:text-tkd-dark transition-all">Atrás</button>
                                            <button
                                                type="button"
                                                onClick={() => irASiguiente('identidad')}
                                                className="bg-tkd-dark text-white py-6 rounded-[2rem] font-black uppercase tracking-widest text-xs hover:bg-tkd-blue transition-all flex items-center justify-center gap-4"
                                            >
                                                Siguiente
                                            </button>
                                        </div>
                                    </motion.div>
                                )}

                                {pasoActual === 'identidad' && (
                                    <motion.div
                                        key="step3"
                                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                                        className="space-y-6"
                                    >
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase text-gray-400 ml-4 tracking-widest">Nombre Corto de URL</label>
                                            <div className="relative">
                                                <input
                                                    {...register('slug')}
                                                    autoFocus
                                                    className={`w-full bg-gray-50 border-2 rounded-3xl p-6 pr-32 text-xl font-black outline-none transition-all shadow-inner lowercase ${slugDisponible === true ? 'border-green-500 bg-green-50' : slugDisponible === false ? 'border-tkd-red bg-red-50' : 'border-transparent focus:border-tkd-blue focus:bg-white'}`}
                                                    placeholder="mi-academia"
                                                />
                                                <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                    {validandoSlug ? (
                                                        <div className="w-5 h-5 border-2 border-tkd-blue border-t-transparent rounded-full animate-spin" />
                                                    ) : slugDisponible === true ? (
                                                        <IconoAprobar className="w-6 h-6 text-green-500" />
                                                    ) : slugDisponible === false ? (
                                                        <div className="text-[10px] font-black text-tkd-red uppercase">Ocupado</div>
                                                    ) : null}
                                                </div>
                                            </div>
                                            <FormInputError mensaje={errors.slug?.message as string} />
                                        </div>

                                        <div className="grid grid-cols-1 gap-4">
                                            <button
                                                type="submit"
                                                disabled={cargando || !slugDisponible}
                                                className={`w-full py-7 rounded-[2.5rem] font-black uppercase tracking-[0.25em] text-sm shadow-2xl transition-all flex items-center justify-center gap-4 ${slugDisponible ? 'bg-tkd-red text-white hover:scale-105 shadow-[0_20px_40px_-10px_rgba(205,46,58,0.4)]' : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'}`}
                                            >
                                                {cargando ? (
                                                    <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                                                ) : (
                                                    <>¡Lanzar mi Dojang Digital ahora!</>
                                                )}
                                            </button>
                                            <button type="button" onClick={() => setPasoActual('contacto')} className="py-2 font-black uppercase text-[10px] tracking-widest text-gray-400 hover:text-tkd-dark transition-all">Cambiar correo/nombre</button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RegistroEscuela;
