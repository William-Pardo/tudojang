
// vistas/RegistroEscuela.tsx
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { buscarTenantPorSlug, registrarNuevaEscuela } from '../servicios/configuracionApi';
import { IconoLogoOficial, IconoCasa, IconoEnviar, IconoExitoAnimado, IconoInformacion } from '../components/Iconos';
import { useNotificacion } from '../context/NotificacionContext';
import { DATOS_RECAUDO_MASTER } from '../constantes';
import FormInputError from '../components/FormInputError';

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
    const { register, handleSubmit, formState: { errors }, watch } = useForm({
        resolver: yupResolver(schema)
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
                emailClub: data.email
            });

            setPaso('exito');
        } catch (error) {
            mostrarNotificacion("Error al procesar el registro.", "error");
        } finally {
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

    if (paso === 'exito') {
        return (
            <div className="min-h-screen bg-white font-sans selection:bg-tkd-blue selection:text-white">
                {navbar}
                <div className="min-h-screen flex items-center justify-center p-6 pt-32">
                    <div className="max-w-md w-full bg-white rounded-[3rem] p-12 shadow-2xl border border-gray-100 text-center space-y-8 animate-fade-in">
                        <IconoExitoAnimado className="mx-auto text-green-500 w-24 h-24" />
                        <div className="space-y-4">
                            <h2 className="text-3xl font-black uppercase text-tkd-dark tracking-tighter">¡Reserva Exitosa!</h2>
                            <p className="text-sm text-gray-500 leading-relaxed uppercase font-bold tracking-tight px-4">
                                Hemos reservado la URL <br /> <span className="text-tkd-blue text-lg">"{slugDeseado}.tudojang.com"</span> <br /> para tu academia.
                            </p>
                        </div>
                        <div className="p-8 bg-blue-50 rounded-[2.5rem] border border-blue-100 text-left space-y-4">
                            <p className="text-[10px] font-black uppercase text-tkd-blue tracking-[0.2em]">Próximos Pasos de Activación:</p>
                            <ul className="text-[11px] font-black text-gray-700 space-y-3 uppercase">
                                <li className="flex gap-3 items-center"><span className="bg-tkd-blue text-white w-6 h-6 rounded-full flex items-center justify-center text-[9px]">1</span> Realiza el pago de tu plan elegido.</li>
                                <li className="flex gap-3 items-center"><span className="bg-tkd-blue text-white w-6 h-6 rounded-full flex items-center justify-center text-[9px]">2</span> Envía el comprobante a nuestro WhatsApp.</li>
                                <li className="flex gap-3 items-center"><span className="bg-tkd-blue text-white w-6 h-6 rounded-full flex items-center justify-center text-[9px]">3</span> Recibirás tus credenciales de acceso.</li>
                            </ul>
                        </div>
                        <a
                            href={`https://wa.me/57${DATOS_RECAUDO_MASTER.whatsappSoporte}?text=Hola! Acabo de registrar mi academia ${slugDeseado}. Envío el comprobante para activación.`}
                            target="_blank"
                            className="block w-full bg-tkd-red text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-red-700 transition-all hover:scale-[1.02] active:scale-95 text-xs"
                        >
                            Enviar Comprobante
                        </a>
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

                        <div className="flex items-center gap-5 p-8 bg-gray-50 rounded-[2.5rem] border border-gray-100 shadow-sm max-w-md hover:shadow-lg transition-shadow">
                            <div className="bg-white p-4 rounded-2xl shadow-sm text-tkd-red">
                                <IconoCasa className="w-8 h-8" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Tu Identidad en la Red:</p>
                                <p className="text-lg font-black text-tkd-dark uppercase tracking-tight flex items-center gap-1">
                                    <span className="text-tkd-blue">{slugDeseado || 'nombre'}</span>.tudojang.com
                                </p>
                            </div>
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
                                <label className="text-[10px] font-black uppercase text-tkd-blue block ml-4 tracking-widest">Nombre Corto (URL)</label>
                                <div className="relative group">
                                    <input
                                        {...register('slug')}
                                        className="w-full bg-blue-50/50 border border-blue-100 focus:border-tkd-blue rounded-2xl p-5 text-sm font-black text-tkd-blue placeholder-blue-200 outline-none lowercase transition-all focus:ring-4 focus:ring-tkd-blue/10"
                                        placeholder="mi-escuela"
                                    />
                                    <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-blue-300 uppercase tracking-widest pointer-events-none">.tudojang.com</span>
                                </div>
                                <FormInputError mensaje={errors.slug?.message} />
                                <p className="text-[9px] text-gray-400 font-bold mt-2 uppercase px-4 leading-relaxed">Este nombre será tu acceso directo único en la plataforma.</p>
                            </div>

                            <button
                                type="submit"
                                disabled={cargando}
                                className="w-full bg-tkd-dark text-white py-6 rounded-2xl font-black uppercase tracking-[0.2em] text-xs shadow-xl hover:bg-tkd-blue transition-all flex items-center justify-center gap-4 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-95 mt-4"
                            >
                                {cargando ? <div className="w-5 h-5 border-4 border-white border-t-transparent rounded-full animate-spin"></div> : <IconoEnviar className="w-5 h-5" />}
                                Reservar mi Entorno
                            </button>
                        </form>
                    </div>
                </div>
            </div>
            {/* Footer Minimalista */}
            <footer className="py-8 border-t border-gray-100 text-center bg-white">
                <p className="text-[9px] font-black text-gray-300 uppercase tracking-[0.3em]">Aliant • Tudojang SaaS Core 2026</p>
            </footer>
        </div>
    );
};

export default RegistroEscuela;


