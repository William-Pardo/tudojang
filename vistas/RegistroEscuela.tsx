
// vistas/RegistroEscuela.tsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { motion } from 'framer-motion';
import { buscarTenantPorSlug, registrarNuevaEscuela } from '../servicios/configuracionApi';
import { IconoLogoOficial, IconoExitoAnimado, IconoInformacion, IconoCopiar, IconoAprobar } from '../components/Iconos';
import { useNotificacion } from '../context/NotificacionContext';
import FormInputError from '../components/FormInputError';
import { guardarCookie, obtenerCookie } from '../utils/cookieUtils';
import { useSearchParams } from 'react-router-dom';
import { abrirCheckoutWompi, generarReferenciaPago } from '../servicios/wompiService';
import { slugify } from '../utils/formatters';
import { WOMPI_CONFIG, PLANES_SAAS, obtenerBeneficiosCortesia } from '../constantes';
import { verificarEmailExistente } from '../servicios/validacionEmail';

const schema = yup.object({
    nombreClub: yup.string().min(3, 'Mínimo 3 letras.').required('El nombre de la academia es obligatorio.'),
    nombreDirector: yup.string().min(6, 'Ingresa nombre y apellido.').required('El nombre del director es obligatorio.'),
    telefonoDirector: yup.string().min(10, 'Formato inválido.').required('El teléfono es obligatorio.'),
    email: yup.string().email('Email inválido.').required('El email es obligatorio.'),
}).required();

const RegistroEscuela: React.FC = () => {
    const [searchParams] = useSearchParams();
    const esModoTest = searchParams.get('test') === 'true' || WOMPI_CONFIG.MODO_TEST;
    const [finalizado, setFinalizado] = useState(false);
    const [cargandoPago, setCargandoPago] = useState(false);
    const { mostrarNotificacion } = useNotificacion();
    const [planSeleccionado, setPlanSeleccionado] = useState(() => {
        const cookie = obtenerCookie('plan_pendiente');
        console.log("%c >>> REGISTRO: Cargando plan desde cookie: " + cookie, "background: #CD2E3A; color: white; pading: 4px;");
        return (PLANES_SAAS as any)[cookie] ? cookie : 'starter';
    });
    const [emailExistente, setEmailExistente] = useState(false);
    const [validandoEmail, setValidandoEmail] = useState(false);

    const { register, handleSubmit, formState: { errors }, watch } = useForm({
        resolver: yupResolver(schema),
        mode: 'onChange',
        defaultValues: obtenerCookie('registro_pendiente') || {}
    });

    const nombreAcademia = watch('nombreClub');
    const emailDirector = watch('email');
    const slugDeseado = slugify(nombreAcademia || '');

    // Detectar retorno de Wompi exitoso
    useEffect(() => {
        const exitoParam = searchParams.get('exito') === 'true';
        const slugParam = searchParams.get('slug');
        const registroPendiente = obtenerCookie('registro_pendiente');

        // REGLA DE ORO: Si la URL dice éxito y tenemos un slug, ES ÉXITO. No dependamos solo de la cookie.
        if (exitoParam && (registroPendiente || slugParam)) {
            setFinalizado(true);
        }
    }, [searchParams]);

    // Validar email con debounce
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (emailDirector && emailDirector.includes('@') && emailDirector.length > 5) {
                setValidandoEmail(true);
                const existe = await verificarEmailExistente(emailDirector);
                setEmailExistente(existe);
                setValidandoEmail(false);
            }
        }, 600);
        return () => clearTimeout(timer);
    }, [emailDirector]);

    const onSubmit = async (data: any) => {
        try {
            setCargandoPago(true);

            // Auto-generar slug
            const slug = slugify(data.nombreClub);

            // Verificar disponibilidad de slug
            const existe = await buscarTenantPorSlug(slug);
            if (existe) {
                mostrarNotificacion(`El nombre "${data.nombreClub}" ya está en uso. Por favor elige otro nombre.`, "error");
                setCargandoPago(false);
                return;
            }

            const beneficios = obtenerBeneficiosCortesia(slug);
            const infoPlan = (PLANES_SAAS as any)[planSeleccionado];

            // Registro preventivo
            const nuevoTenantId = await registrarNuevaEscuela({
                nombreClub: data.nombreClub,
                slug: slug,
                emailClub: data.email,
                representanteLegal: data.nombreDirector,
                pagoNequi: data.telefonoDirector,
                plan: beneficios ? beneficios.upgradePlanId : planSeleccionado,
                limiteEstudiantes: beneficios ? (PLANES_SAAS as any)[beneficios.upgradePlanId].limiteEstudiantes : infoPlan.limiteEstudiantes,
                ...(esModoTest && { modo_simulacion: true }),
            });

            const datosParaCookie = { ...data, tenantId: nuevoTenantId, slug };
            guardarCookie('registro_pendiente', datosParaCookie);

            const montoFinal = beneficios ? beneficios.precioEspecial : infoPlan.precio;

            // Abrir pasarela de pago
            abrirCheckoutWompi({
                referencia: generarReferenciaPago(nuevoTenantId, 'PLAN'),
                montoEnPesos: montoFinal,
                nombreCompleto: data.nombreDirector,
                email: data.email,
                telefono: data.telefonoDirector,
                esSimulacion: esModoTest,
                redirectUrl: `${window.location.origin}/#/registro?exito=true&slug=${slug}`,
                onSuccess: () => {
                    setFinalizado(true);
                },
                onClose: () => setCargandoPago(false)
            });
        } catch (err: any) {
            console.error("🔥 Error:", err);
            mostrarNotificacion(err.message || "Error al procesar el registro", "error");
            setCargandoPago(false);
        }
    };

    if (finalizado) {
        const datosRegistro = obtenerCookie('registro_pendiente') || {
            slug: searchParams.get('slug'),
            email: 'el correo registrado',
            nombreClub: 'Tu Academia'
        };
        const passwordTemp = "Cambiar123";

        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 md:p-10">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                    className="max-w-4xl w-full bg-white rounded-[4rem] p-10 md:p-24 shadow-[0_0_100px_rgba(0,0,0,0.5)] text-center space-y-12 border-8 border-tkd-blue/10 relative"
                >
                    <div className="space-y-6">
                        <div className="w-32 h-32 bg-green-50 rounded-full flex items-center justify-center mx-auto shadow-inner border-4 border-green-100">
                            <IconoExitoAnimado className="text-green-500 w-20 h-20" />
                        </div>
                        <h2 className="text-6xl md:text-8xl font-black uppercase text-tkd-blue tracking-tighter leading-none italic">¡LISTA!</h2>
                        <p className="text-sm font-black text-gray-400 uppercase tracking-[0.5em]">Tu academia profesional ha sido activada</p>
                    </div>

                    <div className="grid gap-8">
                        {/* URL DE ACCESO PRINCIPAL */}
                        <div className="p-12 bg-blue-50 rounded-[3.5rem] border-4 border-tkd-blue/20 space-y-4 relative group">
                            <p className="text-[10px] text-tkd-blue font-black uppercase tracking-[0.3em]">🔗 TU DIRECCIÓN EXCLUSIVA DE ACCESO (ELITE):</p>
                            <a
                                href={`https://${datosRegistro?.slug}.tudojang.com`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block text-3xl md:text-5xl font-black text-tkd-blue break-all underline decoration-tkd-red/30 decoration-8 underline-offset-8 hover:text-tkd-red transition-all"
                            >
                                {datosRegistro?.slug}.tudojang.com
                            </a>
                            <p className="text-[10px] text-gray-400 font-bold uppercase mt-4">¿Error de conexión? Usa este enlace seguro:</p>
                            <a
                                href={`https://tudojang.com/?s=${datosRegistro?.slug}#/login`}
                                className="text-sm font-black text-tkd-blue underline hover:text-tkd-red"
                            >
                                tudojang.com/?s={datosRegistro?.slug}
                            </a>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(`https://tudojang.com/?s=${datosRegistro?.slug}#/login`);
                                    mostrarNotificacion("¡Enlace seguro copiado!", "success");
                                }}
                                className="absolute top-4 right-8 p-2 bg-white rounded-full shadow-md text-tkd-blue hover:scale-110 transition-all opacity-0 group-hover:opacity-100"
                            >
                                <IconoCopiar className="w-5 h-5" />
                            </button>
                        </div>

                        {/* BLOQUE DE CREDENCIALES CRÍTICAS */}
                        <div className="grid md:grid-cols-2 gap-8">
                            <div className="bg-gray-50 p-10 rounded-[3rem] border-2 border-gray-100 text-left space-y-4">
                                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <span className="text-xl">📧</span> USUARIO / EMAIL
                                </h3>
                                <p className="text-xl md:text-2xl font-black text-tkd-blue break-all">{datosRegistro?.email}</p>
                                <p className="text-[10px] text-gray-400 font-bold uppercase leading-tight mt-2 italic">
                                    * Recibirás un correo automático (revisa Spam). No es un popup de tu navegador.
                                </p>
                            </div>

                            <div className="bg-tkd-blue p-10 rounded-[3rem] text-left space-y-4 shadow-2xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-10 flex gap-1">
                                    <div className="w-2 h-2 bg-white rounded-full"></div>
                                    <div className="w-2 h-2 bg-white rounded-full"></div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <p className="text-5xl font-black text-white tracking-widest font-mono group-hover:scale-105 transition-transform origin-left">{passwordTemp}</p>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(passwordTemp);
                                            mostrarNotificacion("¡Clave copiada!", "success");
                                        }}
                                        className="p-2 bg-white/10 rounded-lg text-white hover:bg-white/20"
                                    >
                                        <IconoCopiar className="w-4 h-4" />
                                    </button>
                                </div>
                                <p className="text-[10px] text-tkd-red font-black uppercase tracking-tighter bg-white/90 inline-block px-2 py-1 rounded animate-pulse">
                                    ⚠️ DEBERÁS CAMBIARLA AL INGRESAR
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="pt-10 space-y-8">
                        <a
                            href={`https://${datosRegistro?.slug}.tudojang.com/login`}
                            className="block w-full bg-tkd-red text-white py-10 rounded-[2.5rem] font-black uppercase tracking-[0.3em] text-2xl shadow-[0_25px_60px_-10px_rgba(205,46,58,0.4)] hover:bg-black transition-all hover:scale-[1.03] active:scale-95 text-center"
                        >
                            ENTRAR A MI DOJANG AHORA 🥋
                        </a>

                        <div className="flex flex-col md:flex-row justify-center items-center gap-6 opacity-40 grayscale scale-75">
                            <img src="https://social-plugins.wompi.co/logos/pse.png" alt="PSE" className="h-8" />
                            <img src="https://social-plugins.wompi.co/logos/nequi.png" alt="Nequi" className="h-8" />
                            <img src="https://social-plugins.wompi.co/logos/bancolombia.png" alt="Bancolombia" className="h-8" />
                        </div>
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white md:bg-gray-50 flex items-center justify-center p-0 md:p-6 lg:p-12">
            <div className="max-w-6xl w-full bg-white rounded-none md:rounded-[4rem] shadow-none md:shadow-[0_50px_100px_-20px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col lg:flex-row min-h-[80vh]">

                {/* Lado izquierdo - Branding e Impacto */}
                <div className="lg:w-1/2 bg-tkd-blue text-white p-12 md:p-20 flex flex-col justify-between relative overflow-hidden">
                    <div className="relative z-10 space-y-12">
                        <div className="flex items-center gap-4">
                            <IconoLogoOficial className="w-16 h-16" />
                            <div className="h-10 w-px bg-white/20" />
                            <span className="text-[10px] font-black uppercase tracking-[0.4em] opacity-60">SaaS Core v4.5</span>
                        </div>

                        <div className="space-y-6">
                            <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter leading-[0.9]">
                                Digitaliza tu <br />
                                <span className="text-blue-400">Escuela</span> hoy.
                            </h1>
                            <p className="text-blue-100/70 text-lg font-medium leading-relaxed max-w-md">
                                La plataforma #1 para la gestión de academias de artes marciales en Latinoamérica.
                                Inicia tu transformación digital en segundos.
                            </p>
                        </div>

                        <div className="space-y-4">
                            {[
                                { t: 'Configuración en 30 segundos', d: 'Sistema llave en mano listo para usar.' },
                                { t: 'Acceso Inmediato', d: 'Sin esperas manuales tras el pago.' },
                                { t: 'Dominio Propio Incluido', d: 'Tu academia en internet bajo tu nombre.' }
                            ].map((item, i) => (
                                <div key={i} className="flex gap-4 items-start group">
                                    <div className="mt-1 w-5 h-5 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-all">
                                        <IconoAprobar className="w-3 h-3" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-black uppercase tracking-wider">{item.t}</p>
                                        <p className="text-xs text-blue-200/50 uppercase font-bold tracking-tight">{item.d}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Efecto de fondo dinámico */}
                    <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-tkd-red/20 rounded-full blur-[100px]" />
                    <div className="absolute top-1/2 left-0 w-40 h-40 bg-white/5 rounded-full blur-[80px]" />
                </div>

                {/* Lado derecho - Formulario Dinámico */}
                <div className="lg:w-1/2 p-12 md:p-20 bg-white space-y-10">
                    <div className="space-y-2">
                        <h2 className="text-3xl font-black uppercase tracking-tighter">Detalles Técnicos</h2>
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.3em]">Completa tu suscripción profesional</p>
                    </div>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-gray-400 ml-4 tracking-widest">Nombre de la Institución</label>
                                <input
                                    {...register('nombreClub')}
                                    className="w-full bg-gray-50 border-2 border-transparent focus:border-tkd-blue rounded-[2rem] p-6 text-xl font-black outline-none transition-all shadow-inner uppercase"
                                    placeholder="EJ: TAEKWONDO DRAGONES"
                                />
                                <FormInputError mensaje={errors.nombreClub?.message as string} />
                                {nombreAcademia && (
                                    <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="px-4">
                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                                            Tu URL será: <strong className="text-tkd-blue">{slugDeseado}.tudojang.com</strong>
                                        </p>
                                    </motion.div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-gray-400 ml-4 tracking-widest">Director General</label>
                                <input
                                    {...register('nombreDirector')}
                                    className="w-full bg-gray-50 border-2 border-transparent focus:border-tkd-blue rounded-[2rem] p-6 text-xl font-black outline-none transition-all shadow-inner uppercase"
                                    placeholder="NOMBRE Y APELLIDO"
                                />
                                <FormInputError mensaje={errors.nombreDirector?.message as string} />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-gray-400 ml-4 tracking-widest">Email Maestro</label>
                                    <div className="relative">
                                        <input
                                            {...register('email')}
                                            type="email"
                                            className={`w-full bg-gray-50 border-2 ${emailExistente ? 'border-tkd-red' : 'border-transparent'} focus:border-tkd-blue rounded-2xl p-5 text-lg font-black outline-none transition-all shadow-inner lowercase`}
                                            placeholder="correo@ejemplo.com"
                                        />
                                        {validandoEmail && <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-tkd-blue border-t-transparent rounded-full animate-spin" />}
                                    </div>
                                    <FormInputError mensaje={errors.email?.message as string} />
                                    {emailExistente && (
                                        <p className="text-[9px] text-tkd-red font-black uppercase tracking-widest ml-4 animate-pulse">Este correo ya tiene un Dojang activo</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-gray-400 ml-4 tracking-widest">WhatsApp</label>
                                    <input
                                        {...register('telefonoDirector')}
                                        className="w-full bg-gray-50 border-2 border-transparent focus:border-tkd-blue rounded-2xl p-5 text-lg font-black outline-none transition-all shadow-inner"
                                        placeholder="300 123 4567"
                                    />
                                    <FormInputError mensaje={errors.telefonoDirector?.message as string} />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase text-gray-400 ml-4 tracking-widest">Membresía Profesional</label>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {Object.values(PLANES_SAAS).map((plan: any) => (
                                    <button
                                        key={plan.id}
                                        type="button"
                                        onClick={() => {
                                            console.log("Cambiando plan a:", plan.id);
                                            setPlanSeleccionado(plan.id);
                                            guardarCookie('plan_pendiente', plan.id);
                                        }}
                                        className={`p-6 rounded-3xl border-4 text-left transition-all relative overflow-hidden flex flex-col justify-between h-48 group cursor-pointer ${planSeleccionado === plan.id ? 'border-tkd-red bg-blue-50 shadow-2xl scale-105 z-10' : 'border-gray-100 bg-white hover:border-gray-200 opacity-60'}`}
                                    >
                                        <div className="relative z-10">
                                            {planSeleccionado === plan.id && (
                                                <div className="bg-tkd-red text-white text-[8px] font-black uppercase px-2 py-1 rounded-full w-fit mb-2 animate-pulse">
                                                    Plan Seleccionado
                                                </div>
                                            )}
                                            <p className={`text-[10px] font-black uppercase tracking-widest ${planSeleccionado === plan.id ? 'text-tkd-blue' : 'text-gray-400'}`}>{plan.nombre}</p>
                                            <p className="text-xl font-black mt-1 tracking-tighter">${plan.precio.toLocaleString()}</p>
                                        </div>
                                        <div className="relative z-10">
                                            <p className="text-[8px] font-bold text-gray-400 uppercase leading-none">Hasta {plan.limiteEstudiantes} alumnos</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-6">
                            <button
                                type="submit"
                                disabled={cargandoPago || emailExistente}
                                className="w-full bg-tkd-red text-white py-7 rounded-[2rem] font-black uppercase tracking-[0.2em] text-sm shadow-xl hover:bg-red-700 transition-all hover:scale-[1.02] active:scale-95 disabled:bg-gray-200 disabled:scale-100 disabled:cursor-not-allowed"
                            >
                                {cargandoPago ? (
                                    <div className="flex items-center justify-center gap-3">
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Procesando Pago...
                                    </div>
                                ) : (
                                    esModoTest ? '🧪 Simular Pago (Sandbox)' : 'Activar mi Academia Ahora'
                                )}
                            </button>

                            {/* Sellos de confianza integrados */}
                            <div className="space-y-4 pt-4 border-t border-gray-100">
                                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest text-center">Pagos 100% seguros procesados por Wompi con:</p>
                                <div className="grid grid-cols-4 gap-6 opacity-40 grayscale hover:grayscale-0 transition-all duration-700">
                                    <img src="https://social-plugins.wompi.co/logos/pse.png" alt="PSE" className="h-6 object-contain mx-auto" />
                                    <img src="https://social-plugins.wompi.co/logos/nequi.png" alt="Nequi" className="h-6 object-contain mx-auto" />
                                    <img src="https://social-plugins.wompi.co/logos/bancolombia.png" alt="Bancolombia" className="h-6 object-contain mx-auto" />
                                    <img src="https://social-plugins.wompi.co/logos/visa.png" alt="Visa" className="h-6 object-contain mx-auto" />
                                </div>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default RegistroEscuela;

