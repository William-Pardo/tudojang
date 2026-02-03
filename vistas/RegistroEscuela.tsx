
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
import { useSearchParams } from 'react-router-dom';
import { abrirCheckoutWompi, generarReferenciaPago } from '../servicios/wompiService';
import { dispararNotificacionNuevaEscuela } from '../servicios/notificacionesApi';
import { slugify } from '../utils/formatters';
import { PLANES_SAAS, obtenerBeneficiosCortesia } from '../constantes';

const schema = yup.object({
    nombreClub: yup.string().min(3, 'Mínimo 3 letras.').required('El nombre de la academia es obligatorio.'),
    email: yup.string().email('Email inválido.').required('El email es obligatorio.'),
    slug: yup.string()
        .matches(/^[a-z0-9-]+$/, 'Solo letras minúsculas, números y guiones.')
        .min(3, 'Mínimo 3 caracteres.')
        .required('El nombre de la URL es obligatorio.'),
}).required();

type FormPaso = 'nombre' | 'contacto' | 'identidad';

const RegistroEscuela: React.FC = () => {
    const [pasoActual, setPasoActual] = useState<FormPaso>('nombre');
    const [searchParams] = useSearchParams();
    const esModoTest = searchParams.get('test') === 'true';
    const [finalizado, setFinalizado] = useState(false);
    const [cargando, setCargando] = useState(false);
    const { mostrarNotificacion } = useNotificacion();
    const [planSeleccionado] = useState(obtenerCookie('plan_pendiente') || 'starter');
    const [confirmando, setConfirmando] = useState(false); // Nuevo paso de confirmación

    // Estados para validación de slug en tiempo real
    const [slugDisponible, setSlugDisponible] = useState<boolean | null>(null);
    const [validandoSlug, setValidandoSlug] = useState(false);

    const { register, handleSubmit, formState: { errors }, watch, trigger, setValue } = useForm({
        resolver: yupResolver(schema),
        mode: 'onChange',
        defaultValues: obtenerCookie('registro_pendiente') || {}
    });

    const slugDeseado = watch('slug');
    const nombreAcademia = watch('nombreClub');
    const emailDirector = watch('email');

    // Eliminamos el useEffect que validaba el slug con debounce ya que ahora la validación 
    // es parte del flujo de pasos y ocurre al darle "Siguiente" en el Paso 1.

    const irASiguiente = async (siguiente: FormPaso) => {
        let campoAValidar: any = '';
        if (pasoActual === 'nombre') {
            campoAValidar = 'nombreClub';
            const esValido = await trigger(campoAValidar);
            if (!esValido) return;

            // Validación de disponibilidad automática basada en el nombre
            setValidandoSlug(true);
            const provisionalSlug = slugify(nombreAcademia);
            setValue('slug', provisionalSlug);

            try {
                const existe = await buscarTenantPorSlug(provisionalSlug);
                if (existe) {
                    setSlugDisponible(false);
                } else {
                    setSlugDisponible(true);
                }
                setPasoActual(siguiente);
            } catch (error: any) {
                console.error("🔥 Error al verificar disponibilidad:", error);
                mostrarNotificacion(`Error de disponibilidad: ${error.message || 'Error desconocido'}`, "error");
            } finally {
                setValidandoSlug(false);
            }
            return;
        }

        if (pasoActual === 'contacto') campoAValidar = 'email';

        const esValido = await trigger(campoAValidar);
        if (esValido) setPasoActual(siguiente);
    };

    const processRegistration = async (data: any) => {
        setCargando(true);
        try {
            const beneficios = obtenerBeneficiosCortesia(data.slug);

            await registrarNuevaEscuela({
                nombreClub: data.nombreClub,
                slug: data.slug,
                emailClub: data.email,
                plan: beneficios ? beneficios.upgradePlanId : planSeleccionado,
                ...(esModoTest && { modo_simulacion: true }),
                // @ts-ignore
                ...(beneficios && { nota_admin: `Beneficio: ${beneficios.nombreCortesia}` })
            });

            // Disparar notificación formal
            await dispararNotificacionNuevaEscuela(data.email, data.slug, data.nombreClub);

            guardarCookie('registro_finalizado', { ...data, plan: planSeleccionado });
            setFinalizado(true);
        } catch (error) {
            mostrarNotificacion("Error al procesar el registro.", "error");
        } finally {
            setCargando(false);
        }
    };

    const onSubmit = async (data: any) => {
        if (!slugDisponible) {
            mostrarNotificacion("Este nombre de URL no está disponible.", "error");
            return;
        }

        const infoPlan = (PLANES_SAAS as any)[planSeleccionado];

        // SI ES TRIAL O PLAN GRATUITO (SI EXISTE), PROCESA DIRECTO
        if (planSeleccionado === 'starter' && infoPlan.precio === 0) {
            processRegistration(data);
            return;
        }

        // MOSTRAR RESUMEN ANTES DE PROCEDER
        setConfirmando(true);
    };

    const lanzarPago = (data: any) => {
        console.log("🚀 Iniciando proceso de pago para:", data);
        const beneficios = obtenerBeneficiosCortesia(data.slug);
        const infoPlan = (PLANES_SAAS as any)[planSeleccionado];

        const montoFinal = beneficios ? beneficios.precioEspecial : infoPlan.precio;

        abrirCheckoutWompi({
            referencia: generarReferenciaPago(data.slug, 'PLAN'),
            montoEnPesos: montoFinal,
            nombreCompleto: data.nombreClub,
            email: data.email,
            esSimulacion: esModoTest,
            onSuccess: () => processRegistration(data)
        });
    };

    if (finalizado) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center p-6 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                    className="max-w-md w-full bg-white rounded-[3rem] p-12 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.15)] text-center space-y-8 border border-gray-100 relative overflow-hidden"
                >
                    {/* BANNER DE BIENVENIDA DINÁMICO */}
                    <motion.div
                        initial={{ y: -100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.3, type: 'spring', stiffness: 100 }}
                        className="absolute top-0 left-0 right-0 bg-tkd-blue py-4 shadow-lg flex items-center justify-center gap-3"
                    >
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                        <p className="text-white text-xs font-black uppercase tracking-[0.2em]">
                            ¡Bienvenido a la red: {slugDeseado}!
                        </p>
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    </motion.div>

                    <div className="pt-8">
                        <IconoExitoAnimado className="mx-auto text-tkd-blue w-20 h-20" />
                    </div>
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
                                {pasoActual === 'nombre' && "Comienza el viaje. El nombre de tu academia (mínimo 3 letras) es el primer paso para la digitalización de tu enseñanza."}
                                {pasoActual === 'contacto' && "Necesitamos tu correo institucional para enviarte las llaves de tu nuevo centro de gestión digital."}
                                {pasoActual === 'identidad' && "Este será el nombre que representará tu academia y el que aparecerá en tu membresía oficial."}
                            </p>
                        </motion.div>
                    </AnimatePresence>

                    {/* VISTA PREVIA DEL DOMINIO: CAMBIADA A ROJO POR SOLICITUD */}
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="relative max-w-sm mt-12"
                    >
                        <div className="bg-tkd-red text-white p-8 rounded-[3rem] shadow-2xl relative z-10 overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full blur-3xl group-hover:bg-white/40 transition-all" />
                            <div className="flex items-center gap-5 relative z-10">
                                <div className="bg-white/10 p-4 rounded-2xl border border-white/20 shadow-lg">
                                    <IconoCasa className="w-8 h-8 text-white" />
                                </div>
                                <div className="overflow-hidden">
                                    <p className="text-[10px] font-black text-white/70 uppercase tracking-[0.3em] mb-1">Tu Membresía:</p>
                                    <p className="text-lg font-black tracking-tight leading-none truncate w-full">
                                        {slugDeseado ? slugDeseado : 'mi-academia'}
                                        <span className="text-white opacity-40">.tudojang.com</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                        {/* Animación de fondo decorativa */}
                        <motion.div
                            animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
                            transition={{ duration: 4, repeat: Infinity }}
                            className="absolute -bottom-10 -right-10 w-40 h-40 bg-tkd-red/30 rounded-full blur-[100px]"
                        />
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
                            {esModoTest && (
                                <div className="ml-auto flex items-center gap-2">
                                    <span className="flex h-2 w-2 rounded-full bg-tkd-red animate-pulse"></span>
                                    <span className="text-[8px] font-black text-tkd-red uppercase tracking-widest">Sandbox Activo</span>
                                </div>
                            )}
                        </div>

                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                            <AnimatePresence mode="wait">
                                {confirmando && (
                                    <motion.div
                                        key="resumen"
                                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                                        className="space-y-8"
                                    >
                                        <div className="text-center space-y-2">
                                            <h3 className="text-2xl font-black uppercase tracking-tight">Resumen de Activación</h3>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Confirma los datos de tu academia</p>
                                        </div>

                                        <div className="bg-tkd-blue text-white p-10 rounded-[4rem] shadow-2xl relative overflow-hidden group">
                                            {/* EFECTO DE LUZ */}
                                            <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-[100px] group-hover:bg-white/20 transition-all duration-1000" />

                                            <div className="relative z-10 space-y-8">
                                                <div className="flex justify-between items-center border-b border-white/10 pb-6">
                                                    <div className="text-left">
                                                        <p className="text-[10px] font-black uppercase text-gray-500 tracking-[0.3em] mb-1">Membresía Seleccionada:</p>
                                                        <h4 className="text-2xl font-black uppercase tracking-tight">{planSeleccionado}</h4>
                                                    </div>
                                                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/10">
                                                        <IconoLogoOficial className="w-6 h-6 text-white" />
                                                    </div>
                                                </div>

                                                {/* BANNER DE CORTESÍA DINÁMICO */}
                                                {obtenerBeneficiosCortesia(slugDeseado) && (
                                                    <motion.div
                                                        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                                                        className="bg-white/20 border border-white/30 p-4 rounded-2xl space-y-2"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-2 h-2 bg-tkd-blue rounded-full animate-pulse" />
                                                            <span className="text-[10px] font-black uppercase text-white tracking-[0.2em]">{obtenerBeneficiosCortesia(slugDeseado)?.nombreCortesia}</span>
                                                        </div>
                                                        <p className="text-[9px] font-bold text-blue-200/70 uppercase leading-relaxed text-left">
                                                            {obtenerBeneficiosCortesia(slugDeseado)?.mensaje}
                                                        </p>
                                                    </motion.div>
                                                )}

                                                <div className="flex justify-between items-end">
                                                    <div className="text-left">
                                                        <p className="text-[10px] font-black uppercase text-gray-500 tracking-[0.3em] mb-1">Inversión Lanzamiento:</p>
                                                        <div className="flex flex-col">
                                                            {obtenerBeneficiosCortesia(slugDeseado) ? (
                                                                <>
                                                                    <span className="text-xs text-gray-500 line-through font-bold">${(PLANES_SAAS as any)[planSeleccionado].precio.toLocaleString()}</span>
                                                                    <span className="text-4xl font-black text-tkd-blue">${obtenerBeneficiosCortesia(slugDeseado)!.precioEspecial.toLocaleString()}</span>
                                                                </>
                                                            ) : (
                                                                <span className="text-4xl font-black">${(PLANES_SAAS as any)[planSeleccionado].precio.toLocaleString()}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[10px] font-black uppercase text-gray-400 tracking-[0.3em] mb-1">Ciclo Pago:</p>
                                                        <p className="text-xs font-black text-white/50 uppercase">Mensual</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <button
                                                type="button"
                                                onClick={() => lanzarPago({ nombreClub: nombreAcademia, slug: slugDeseado, email: emailDirector })}
                                                className="w-full bg-tkd-red text-white py-7 rounded-[2.5rem] font-black uppercase tracking-[0.2em] text-sm shadow-2xl hover:scale-[1.02] transition-all"
                                            >
                                                {esModoTest ? 'Simular Pago (Sandbox)' : 'Proceder al Pago Seguro'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setConfirmando(false)}
                                                className="w-full py-2 font-black uppercase text-[10px] tracking-widest text-gray-400 hover:text-tkd-dark transition-all"
                                            >
                                                Corregir datos
                                            </button>
                                        </div>
                                    </motion.div>
                                )}

                                {!confirmando && pasoActual === 'nombre' && (
                                    <motion.div
                                        key="step1"
                                        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                                        className="space-y-6"
                                    >
                                        <div className="space-y-4">
                                            <p className="text-[10px] font-bold text-tkd-dark/60 uppercase text-center mb-4">
                                                Indica el nombre de tu escuela o club. <br />
                                                Este nombre te representará en adelante.
                                            </p>
                                            <label className="text-[10px] font-black uppercase text-gray-400 ml-4 tracking-widest">Nombre de la Institución</label>
                                            <input
                                                {...register('nombreClub')}
                                                autoFocus
                                                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), irASiguiente('contacto'))}
                                                className="w-full bg-gray-50 border-2 border-transparent focus:border-tkd-blue focus:bg-white rounded-3xl p-6 text-xl font-black outline-none transition-all shadow-inner uppercase"
                                                placeholder="EJ: CLUB DRAGONES"
                                            />
                                            <FormInputError mensaje={errors.nombreClub?.message as string} />
                                        </div>
                                        {nombreAcademia?.length > 2 && (
                                            <motion.button
                                                initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                                                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                                type="button"
                                                disabled={validandoSlug}
                                                onClick={() => irASiguiente('contacto')}
                                                className="w-full bg-tkd-dark text-white py-6 rounded-[2rem] font-black uppercase tracking-widest text-xs hover:bg-tkd-blue shadow-xl transition-all flex items-center justify-center gap-4 group disabled:opacity-50"
                                            >
                                                {validandoSlug ? 'Verificando...' : 'Siguiente'}
                                                {!validandoSlug && <IconoEnviar className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
                                            </motion.button>
                                        )}
                                    </motion.div>
                                )}

                                {!confirmando && pasoActual === 'contacto' && (
                                    <motion.div
                                        key="step2"
                                        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                                        className="space-y-6"
                                    >
                                        <div className="space-y-2 text-center lg:text-left">
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
                                        {emailDirector?.includes('@') && emailDirector?.includes('.') && (
                                            <div className="grid grid-cols-1 gap-4">
                                                <motion.button
                                                    initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                                                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                                    type="button"
                                                    onClick={() => irASiguiente('identidad')}
                                                    className="bg-tkd-dark text-white py-6 rounded-[2rem] font-black uppercase tracking-widest text-xs hover:bg-tkd-blue shadow-[0_20px_40px_-10px_rgba(0,0,0,0.2)] transition-all flex items-center justify-center gap-4"
                                                >
                                                    Siguiente Paso
                                                </motion.button>
                                                <button type="button" onClick={() => setPasoActual('nombre')} className="py-2 font-black uppercase text-[10px] tracking-widest text-gray-400 hover:text-tkd-dark transition-all">Atrás</button>
                                            </div>
                                        )}
                                    </motion.div>
                                )}

                                {!confirmando && pasoActual === 'identidad' && (
                                    <motion.div
                                        key="step3"
                                        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                                        className="space-y-8"
                                    >
                                        <div className="text-center space-y-4">
                                            <div className="mx-auto w-16 h-16 bg-tkd-blue/10 rounded-full flex items-center justify-center">
                                                <IconoAprobar className="w-8 h-8 text-tkd-blue" />
                                            </div>
                                            <h3 className="text-xl font-black uppercase tracking-tight text-tkd-dark">Configura tu URL</h3>
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest leading-relaxed">
                                                Este será el dominio de tu academia. Puedes personalizarlo ahora mismo.
                                            </p>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="relative">
                                                <input
                                                    {...register('slug')}
                                                    className={`w-full bg-gray-50 border-2 ${slugDisponible === false ? 'border-tkd-red' : 'border-tkd-blue/20'} rounded-3xl p-6 text-xl font-black outline-none transition-all shadow-inner lowercase`}
                                                    onChange={async (e) => {
                                                        const val = slugify(e.target.value);
                                                        setValue('slug', val);
                                                        if (val.length > 2) {
                                                            const existe = await buscarTenantPorSlug(val);
                                                            setSlugDisponible(!existe);
                                                        }
                                                    }}
                                                />
                                                <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                    {slugDisponible === true && <span className="text-[10px] font-black text-green-500 uppercase tracking-widest">Disponible</span>}
                                                    {slugDisponible === false && <span className="text-[10px] font-black text-tkd-red uppercase tracking-widest">Ocupado</span>}
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-center font-bold text-gray-400 uppercase tracking-widest">URL Final: {slugDeseado}.tudojang.com</p>
                                        </div>

                                        <div className="grid grid-cols-1 gap-4">
                                            <motion.button
                                                type="submit"
                                                disabled={cargando || slugDisponible === false}
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                                className={`w-full py-7 rounded-[2.5rem] ${slugDisponible === false ? 'bg-gray-300' : 'bg-tkd-red'} text-white font-black uppercase tracking-[0.25em] text-sm shadow-2xl transition-all flex items-center justify-center gap-4`}
                                            >
                                                {cargando ? (
                                                    <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                                                ) : (
                                                    <>¡Lanzar mi Dojang Digital ahora!</>
                                                )}
                                            </motion.button>
                                            <button type="button" onClick={() => setPasoActual('contacto')} className="py-2 font-black uppercase text-[10px] tracking-widest text-gray-400 hover:text-tkd-dark transition-all">Cambiar datos de contacto</button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </form>
                    </div>
                </div>
            </div>
        </div >
    );
};

export default RegistroEscuela;
