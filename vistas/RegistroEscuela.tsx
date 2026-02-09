// vistas/RegistroEscuela.tsx
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { registrarNuevaEscuela, buscarTenantPorSlug } from '../servicios/configuracionApi';
import { IconoLogoOficial, IconoCasa, IconoEnviar, IconoExitoAnimado } from '../components/Iconos';
import { useNotificacion } from '../context/NotificacionContext';
import FormInputError from '../components/FormInputError';
import { CONFIGURACION_WOMPI } from '../constantes';
import { enviarEmailBienvenida } from '../servicios/emailService';

const schema = yup.object({
    nombreClub: yup.string().required('El nombre de la academia es obligatorio.'),
    email: yup.string().email('Email inválido.').required('El email es obligatorio.'),
    telefono: yup.string().required('El WhatsApp es obligatorio para el contacto.'),
}).required();

const generarSlug = (nombre: string) => {
    return nombre
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Eliminar tildes
        .replace(/[^a-z0-9]+/g, '-') // Reemplazar caracteres no alfanuméricos por guiones
        .replace(/^-+|-+$/g, ''); // Eliminar guiones al inicio y final
};

const RegistroEscuela: React.FC = () => {
    const [paso, setPaso] = useState<'formulario' | 'procesando' | 'exito'>('formulario');
    const [cargando, setCargando] = useState(false);
    const [datosTemporales, setDatosTemporales] = useState<any>(null); // Datos tras volver de Wompi
    const [passwordCopiada, setPasswordCopiada] = useState(false); // Control para habilitar login
    const { mostrarNotificacion } = useNotificacion();
    const { register, handleSubmit, formState: { errors }, watch } = useForm({
        resolver: yupResolver(schema)
    });

    const nombreClub = watch('nombreClub');
    const slugCalculado = nombreClub ? generarSlug(nombreClub) : '';

    // Helper robusto para obtener parámetros sin importar HashRouter
    const getParam = (name: string) => {
        const searchParams = new URLSearchParams(window.location.search);
        if (searchParams.has(name)) return searchParams.get(name);

        const hashParts = window.location.hash.split('?');
        if (hashParts.length > 1) {
            const hashParams = new URLSearchParams(hashParts[1]);
            return hashParams.get(name);
        }
        return null;
    };

    // Detectar retorno de Wompi
    useEffect(() => {
        const wompiId = getParam('id');
        const pendingReg = localStorage.getItem('registro_pendiente');

        if (wompiId && pendingReg) {
            setPaso('procesando');
            setTimeout(async () => {
                const datos = JSON.parse(pendingReg);
                setDatosTemporales(datos);
                setPaso('exito');
                localStorage.removeItem('registro_pendiente');
                console.log('Pago detectado. Esperando confirmación del webhook...');
            }, 2000);
        }
    }, [window.location.search, window.location.hash]);

    // Función para generar SHA-256 en el navegador
    const generarFirmaIntegridad = async (cadena: string) => {
        const encondedText = new TextEncoder().encode(cadena);
        const hashBuffer = await crypto.subtle.digest('SHA-256', encondedText);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    };

    const onSubmit = async (data: any) => {
        setCargando(true);
        try {
            let slug = generarSlug(data.nombreClub);
            const existe = await buscarTenantPorSlug(slug);

            // Si el slug ya existe, no bloqueamos, sino que le agregamos un sufijo único
            if (existe) {
                slug = `${slug}-${Math.random().toString(36).slice(-4)}`;
            }

            // 1. Generar contraseña temporal segura e ID único
            const passwordTemporal = Math.random().toString(36).slice(-8).toUpperCase();
            const nuevoTenantId = `tnt-${Date.now()}`;

            // 2. Registrar tenant preliminar (Estado: pendiente_pago)
            await registrarNuevaEscuela({
                tenantId: nuevoTenantId,
                nombreClub: data.nombreClub,
                slug: slug,
                emailClub: data.email,
                telefono: data.telefono,
                passwordTemporal: passwordTemporal,
                plan: getParam('plan') || 'starter',
                estadoSuscripcion: 'pendiente_pago' as any
            } as any);

            // 3. Preparar datos para Wompi
            const precioParam = getParam('precio') || '50000';
            const montoCentavos = parseInt(precioParam) * 100;
            const referencia = `SUSC_${slug.toUpperCase()}_${nuevoTenantId}`;
            const moneda = 'COP';

            // Generar Firma de Integridad
            // Fórmula: SHA256(Referencia + MontoEnCentavos + Moneda + SecretoIntegridad)
            const cadenaConcatenada = `${referencia}${montoCentavos}${moneda}${CONFIGURACION_WOMPI.integrityKey}`;
            const firmaIntegridad = await generarFirmaIntegridad(cadenaConcatenada);

            // Guardar en local storage para recuperar tras volver de Wompi
            localStorage.setItem('registro_pendiente', JSON.stringify({
                slug,
                email: data.email,
                password: passwordTemporal,
                nombreClub: data.nombreClub
            }));

            // 4. Redirigir a Wompi
            // Limpiamos la URL de retorno para remover parámetros previos y evitar el doble "?"
            const [baseHash] = window.location.hash.split('?');
            const urlRetorno = window.location.origin + window.location.pathname + baseHash;

            const urlWompi = `https://checkout.wompi.co/p/?` +
                `public-key=${CONFIGURACION_WOMPI.publicKey}&` +
                `currency=${moneda}&` +
                `amount-in-cents=${montoCentavos}&` +
                `reference=${referencia}&` +
                `signature:integrity=${firmaIntegridad}&` +
                `redirect-url=${encodeURIComponent(urlRetorno)}`;

            window.location.href = urlWompi;

        } catch (error) {
            console.error(error);
            mostrarNotificacion("Error al iniciar el proceso de pago.", "error");
            setCargando(false);
        }
    };

    const navbar = (
        <nav className="fixed top-0 w-full z-[100] bg-white/80 backdrop-blur-md border-b border-gray-100 py-4 px-6 sm:px-12 flex justify-between items-center">
            <div className="flex items-center gap-3">
                <IconoLogoOficial className="w-10 h-10 text-tkd-blue" />
                <span className="font-black text-xl tracking-tighter uppercase italic text-tkd-dark">Tudojang</span>
            </div>
            <a href="/" className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-tkd-blue transition-colors">
                Volver al Inicio
            </a>
        </nav>
    );

    if (paso === 'procesando') {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center font-sans">
                <div className="text-center space-y-4">
                    <div className="w-16 h-16 border-4 border-tkd-blue border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <h2 className="text-2xl font-black uppercase text-tkd-dark">Verificando Pago...</h2>
                    <p className="text-gray-500 text-sm">Estamos confirmando tu transacción con el banco.</p>
                </div>
            </div>
        );
    }

    if (paso === 'exito' && datosTemporales) {
        const copiarPassword = () => {
            navigator.clipboard.writeText(datosTemporales.password);
            setPasswordCopiada(true);
            mostrarNotificacion('Contraseña copiada al portapapeles', 'success');
        };

        return (
            <div className="min-h-screen bg-white font-sans selection:bg-tkd-blue selection:text-white">
                {navbar}
                <div className="min-h-screen flex items-center justify-center p-6 pt-32">
                    <div className="max-w-md w-full bg-white rounded-[3rem] p-12 shadow-2xl border border-gray-100 text-center space-y-8 animate-fade-in">
                        <IconoExitoAnimado className="mx-auto text-green-500 w-24 h-24" />
                        <div className="space-y-4">
                            <h2 className="text-3xl font-black uppercase text-tkd-dark tracking-tighter">¡Dojang Activado!</h2>
                            <p className="text-sm text-gray-500 leading-relaxed font-medium px-4">
                                Tu suscripción ha sido confirmada. Hemos enviado los detalles de acceso a <span className="font-bold text-tkd-dark">{datosTemporales.email}</span>
                            </p>
                        </div>

                        <div className="p-8 bg-blue-50 rounded-[2.5rem] border border-blue-100 text-left space-y-4">
                            <p className="text-[10px] font-black uppercase text-tkd-blue tracking-[0.2em] text-center mb-2">Tus Credenciales Temporales</p>

                            <div className="space-y-3">
                                <div className="bg-white p-4 rounded-xl border border-blue-100">
                                    <p className="text-[9px] font-bold text-gray-400 uppercase">Usuario / Email</p>
                                    <p className="text-sm font-black text-tkd-dark">{datosTemporales.email}</p>
                                </div>
                                <div className="bg-white p-4 rounded-xl border border-blue-100 relative">
                                    <p className="text-[9px] font-bold text-gray-400 uppercase">Contraseña Temporal</p>
                                    <div className="flex justify-between items-center mt-2">
                                        <p className="text-xl font-mono font-black text-tkd-blue tracking-wider">{datosTemporales.password}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Botón de Copiar - CRÍTICO para habilitar login */}
                            <button
                                onClick={copiarPassword}
                                disabled={passwordCopiada}
                                className={`w-full py-4 rounded-xl font-black uppercase tracking-widest text-xs transition-all ${passwordCopiada
                                    ? 'bg-green-500 text-white cursor-default'
                                    : 'bg-tkd-red text-white hover:bg-red-700 active:scale-95'
                                    }`}
                            >
                                {passwordCopiada ? '✓ Contraseña Copiada' : '📋 Copiar Contraseña'}
                            </button>

                            <p className="text-[9px] text-gray-400 text-center leading-tight pt-2">
                                {passwordCopiada
                                    ? 'Ahora puedes iniciar sesión con tu nueva cuenta'
                                    : 'Debes copiar la contraseña para continuar'}
                            </p>
                        </div>

                        {/* Botón de Login - Solo habilitado después de copiar */}
                        <a
                            href={passwordCopiada ? "/#/login" : "#"}
                            onClick={(e) => !passwordCopiada && e.preventDefault()}
                            className={`block w-full py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl text-xs transition-all ${passwordCopiada
                                ? 'bg-tkd-dark text-white hover:bg-tkd-blue hover:scale-[1.02] active:scale-95 cursor-pointer'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-50'
                                }`}
                        >
                            {passwordCopiada ? 'Iniciar Sesión Ahora' : '🔒 Copia la Contraseña Primero'}
                        </a>

                        {passwordCopiada && (
                            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-4 text-left">
                                <p className="text-[10px] font-black uppercase text-yellow-700 mb-2">⚠️ Importante</p>
                                <p className="text-[9px] text-yellow-600 leading-relaxed">
                                    Usa <strong>{datosTemporales.email}</strong> y la contraseña que copiaste para iniciar sesión.
                                    El sistema te pedirá cambiarla en tu primer acceso.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white font-sans selection:bg-tkd-blue selection:text-white flex flex-col">
            {navbar}
            <div className="flex-grow flex items-center justify-center p-6 pt-32 pb-12">
                <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-20 items-center animate-fade-in">

                    {/* COLUMNA IZQUIERDA: MENSAJE DE VALOR */}
                    <div className="space-y-10">
                        <div className="inline-block bg-tkd-blue/10 text-tkd-blue px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">
                            Alta de Nueva Academia
                        </div>
                        <div className="space-y-6">
                            <h1 className="text-5xl md:text-7xl font-black text-tkd-dark uppercase tracking-tighter leading-[0.9]">
                                Crea tu <br /> <span className="text-tkd-blue">Dojang Digital</span>
                            </h1>
                            <p className="text-gray-500 text-lg font-medium uppercase leading-relaxed max-w-md tracking-tight">
                                La plataforma definitiva para escalar la gestión de tu escuela de Taekwondo. Inicia tu transformación digital hoy.
                            </p>
                        </div>

                    </div>

                    {/* COLUMNA DERECHA: FORMULARIO */}
                    <div className="bg-white p-10 md:p-12 rounded-[3.5rem] shadow-2xl border border-gray-100 space-y-8 relative overflow-hidden">
                        {/* Decoración de fondo */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-tkd-blue/5 rounded-full blur-[80px] -z-10"></div>

                        <div className="text-center lg:text-left space-y-2">
                            <h2 className="text-3xl font-black uppercase text-tkd-dark tracking-tighter">Formulario de Alta</h2>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Datos Maestros del Dojang</p>
                        </div>

                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 relative z-10">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-gray-500 block ml-4 tracking-widest">Nombre de la Institución</label>
                                <input
                                    {...register('nombreClub')}
                                    className="w-full bg-gray-50 border border-gray-100 focus:border-tkd-blue rounded-2xl p-5 text-sm font-black text-tkd-dark placeholder-gray-300 focus:ring-4 focus:ring-tkd-blue/10 transition-all outline-none"
                                    placeholder="EJ: CLUB DRAGONES DEL SUR"
                                />
                                <FormInputError mensaje={errors.nombreClub?.message} />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-gray-500 block ml-4 tracking-widest">Correo del Director</label>
                                <input
                                    {...register('email')}
                                    type="email"
                                    className="w-full bg-gray-50 border border-gray-100 focus:border-tkd-blue rounded-2xl p-5 text-sm font-black text-tkd-dark placeholder-gray-300 focus:ring-4 focus:ring-tkd-blue/10 transition-all outline-none"
                                    placeholder="DIRECTOR@DOJANG.COM"
                                />
                                <FormInputError mensaje={errors.email?.message} />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-gray-500 block ml-4 tracking-widest">WhatsApp de Contacto</label>
                                <input
                                    {...register('telefono')}
                                    type="tel"
                                    className="w-full bg-gray-50 border border-gray-100 focus:border-tkd-blue rounded-2xl p-5 text-sm font-black text-tkd-dark placeholder-gray-300 focus:ring-4 focus:ring-tkd-blue/10 transition-all outline-none"
                                    placeholder="+57 300 123 4567"
                                />
                                <FormInputError mensaje={errors.telefono?.message} />
                            </div>

                            <button
                                type="submit"
                                disabled={cargando}
                                className="w-full bg-tkd-dark text-white py-6 rounded-2xl font-black uppercase tracking-[0.2em] text-xs shadow-xl hover:bg-tkd-blue transition-all flex items-center justify-center gap-4 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-95 mt-4"
                            >
                                {cargando ? <div className="w-5 h-5 border-4 border-white border-t-transparent rounded-full animate-spin"></div> : <IconoEnviar className="w-5 h-5" />}
                                Ir al Pago Seguro
                            </button>
                        </form>
                    </div>
                </div>
            </div>
            <footer className="py-8 border-t border-gray-100 text-center bg-white">
                <p className="text-[9px] font-black text-gray-300 uppercase tracking-[0.3em]">Aliant • Tudojang SaaS Core 2026</p>
            </footer>
        </div>
    );
};

export default RegistroEscuela;


