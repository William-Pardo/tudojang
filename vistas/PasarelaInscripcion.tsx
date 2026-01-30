
// vistas/PasarelaInscripcion.tsx
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTenant } from '../components/BrandingProvider';
import { obtenerSolicitudInscripcion, subirSoportePago, registrarAspirantePublico } from '../servicios/censoApi';
import { RegistroTemporal } from '../tipos';
import {
    IconoLogoOficial, IconoWhatsApp, IconoExitoAnimado,
    IconoUsuario, IconoEnviar, IconoAprobar, IconoInformacion
} from '../components/Iconos';
import LogoDinamico from '../components/LogoDinamico';
import Loader from '../components/Loader';
import { formatearPrecio } from '../utils/formatters';
import { abrirCheckoutWompi } from '../servicios/wompiService';

const PasarelaInscripcion: React.FC = () => {
    const { solicitudId } = useParams();
    const { tenant, estaCargado } = useTenant();

    const [solicitud, setSolicitud] = useState<RegistroTemporal | null>(null);
    const [cargandoSolicitud, setCargandoSolicitud] = useState(true);
    const [soporteUrl, setSoporteUrl] = useState('');
    const [subiendo, setSubiendo] = useState(false);
    const [enviado, setEnviado] = useState(false);

    // Estado para el formulario de datos técnico (Fase 3)
    const [formData, setFormData] = useState({
        nombres: '', apellidos: '', email: '', telefono: '',
        fechaNacimiento: '', tutorNombre: '', tutorEmail: '',
        tutorTelefono: '', parentesco: 'Padre'
    });

    useEffect(() => {
        const cargarSolicitud = async () => {
            if (solicitudId) {
                const s = await obtenerSolicitudInscripcion(solicitudId);
                setSolicitud(s);
                if (s?.datos) {
                    setFormData(prev => ({ ...prev, ...s.datos }));
                }
            }
            setCargandoSolicitud(false);
        };
        cargarSolicitud();
    }, [solicitudId]);

    const handlePagarConWompi = async () => {
        if (!solicitudId || !solicitud || !tenant) return;
        setSubiendo(true);
        try {
            const montoEnCentavos = (solicitud.pago?.monto || 0) * 100;
            const referencia = `INS_${solicitudId}_${Date.now()}`;

            await abrirCheckoutWompi({
                referencia,
                montoEnCentavos,
                email: solicitud.datos?.email || '',
                nombreCompleto: `${solicitud.datos?.nombres} ${solicitud.datos?.apellidos}`,
                telefono: solicitud.datos?.telefono || '',
                redirectUrl: window.location.href
            });
        } catch (e: any) {
            console.error("Error al iniciar pago con Wompi");
        } finally {
            setSubiendo(false);
        }
    };

    const handleFinalizarDatos = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!solicitudId || !tenant) return;
        setSubiendo(true);
        try {
            // Actualizamos los datos finales y pasamos a 'procesado'
            await registrarAspirantePublico('inscripcion_premium', tenant.tenantId, formData);
            setEnviado(true);
        } catch (e: any) {
            console.error("Error al enviar datos");
        } finally {
            setSubiendo(false);
        }
    };

    if (!estaCargado || cargandoSolicitud) return <Loader texto="Abriendo Portal de Inscripción..." />;

    if (!solicitud) return <div className="p-20 text-center font-black uppercase text-gray-400">Solicitud no encontrada o expirada.</div>;

    if (enviado) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6 text-center" style={{ backgroundColor: tenant?.colorPrimario }}>
                <div className="bg-white dark:bg-gray-950 p-12 rounded-[4rem] shadow-2xl max-w-sm w-full animate-fade-in border border-white/10">
                    <IconoExitoAnimado className="mx-auto w-32 h-32" />
                    <h2 className="text-3xl font-black text-gray-900 dark:text-white uppercase mt-6 tracking-tight">¡Bienvenido!</h2>
                    <p className="text-gray-500 mt-4 font-bold uppercase text-[10px] tracking-widest leading-relaxed">
                        Tus datos han sido registrados. Revisa tu WhatsApp para la firma de los contratos técnicos.
                    </p>
                </div>
            </div>
        );
    }

    const inputClass = "w-full bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-tkd-blue rounded-2xl py-3 px-4 font-bold text-sm outline-none transition-all dark:text-white";

    return (
        <div className="min-h-screen py-10 px-6 flex flex-col items-center" style={{ backgroundColor: tenant?.colorPrimario }}>
            <div className="mb-8 text-center">
                <div className="bg-white p-4 rounded-[2rem] shadow-xl inline-block mb-3">
                    <LogoDinamico className="w-16 h-16" />
                </div>
                <h1 className="text-white text-3xl font-black uppercase tracking-tighter">{tenant?.nombreClub}</h1>
                <p className="text-white/60 text-[8px] font-black uppercase tracking-[0.4em] mt-1">Inscripción Alumno Nuevo</p>
            </div>

            <div className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-[3.5rem] shadow-2xl overflow-hidden border border-white/10">
                {/* --- HEADER DE ESTADO --- */}
                <div className="p-8 bg-tkd-dark text-white border-b border-white/5 flex justify-between items-center">
                    <div>
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Estado de tu proceso:</p>
                        <h2 className="text-lg font-black uppercase tracking-tight">
                            {solicitud.estado === 'pendiente_pago' && "💳 Pendiente de Pago"}
                            {solicitud.estado === 'por_verificar' && "⏳ Verificando Soporte"}
                            {solicitud.estado === 'pago_validado' && "📝 Formulario de Datos"}
                        </h2>
                    </div>
                </div>

                <div className="p-10 space-y-8">
                    {/* --- FASE 1: PENDIENTE PAGO --- */}
                    {solicitud.estado === 'pendiente_pago' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-3xl border border-blue-100 dark:border-blue-800">
                                <p className="text-[10px] font-black uppercase text-blue-800 dark:text-blue-300 tracking-widest mb-2">Total a Cancelar:</p>
                                <h3 className="text-3xl font-black text-tkd-blue">{formatearPrecio(solicitud.pago?.monto || 0)}</h3>
                                <p className="text-[9px] font-bold text-gray-500 uppercase mt-2">Incluye Inscripción + Primer Mes</p>
                            </div>

                            <div className="space-y-4">
                                <button
                                    onClick={handlePagarConWompi}
                                    disabled={subiendo}
                                    className="w-full bg-tkd-blue text-white py-5 rounded-[2rem] font-black uppercase tracking-widest shadow-xl hover:bg-blue-800 transition-all flex items-center justify-center gap-3"
                                >
                                    {subiendo ? <Loader /> : <IconoAprobar className="w-5 h-5" />}
                                    Pagar Inscripción con Wompi
                                </button>
                                <p className="text-[9px] text-gray-400 text-center font-bold uppercase">Pago Seguro Protegido por SSL</p>
                            </div>
                        </div>
                    )}

                    {/* --- FASE 2: VERIFICANDO --- */}
                    {solicitud.estado === 'por_verificar' && (
                        <div className="text-center py-12 px-6 space-y-6 animate-fade-in">
                            <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto animate-pulse">
                                <IconoInformacion className="w-10 h-10 text-orange-500" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black uppercase tracking-tight">Validando con el Banco</h3>
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-2 leading-relaxed">
                                    Hemos recibido tu comprobante. Pronto desbloquearemos tu formulario de registro oficial. ¡Gracias por tu paciencia!
                                </p>
                            </div>
                        </div>
                    )}

                    {/* --- FASE 3: FORMULARIO DESBLOQUEADO --- */}
                    {solicitud.estado === 'pago_validado' && (
                        <form onSubmit={handleFinalizarDatos} className="space-y-8 animate-fade-in">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="sm:col-span-2">
                                    <label className="text-[9px] font-black uppercase text-gray-400 mb-1 ml-2">Nombres del Alumno</label>
                                    <input required className={inputClass} value={formData.nombres} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, nombres: e.target.value.toUpperCase() })} />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="text-[9px] font-black uppercase text-gray-400 mb-1 ml-2">Apellidos</label>
                                    <input required className={inputClass} value={formData.apellidos} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, apellidos: e.target.value.toUpperCase() })} />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black uppercase text-gray-400 mb-1 ml-2">WhatsApp</label>
                                    <input required className={inputClass} value={formData.telefono} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, telefono: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black uppercase text-gray-400 mb-1 ml-2">F. Nacimiento</label>
                                    <input type="date" required className={inputClass} value={formData.fechaNacimiento} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, fechaNacimiento: e.target.value })} />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={subiendo}
                                className="w-full bg-tkd-red text-white py-5 rounded-[2rem] font-black uppercase tracking-widest shadow-2xl hover:bg-red-700 transition-all flex items-center justify-center gap-3"
                            >
                                {subiendo ? <Loader /> : <IconoEnviar className="w-5 h-5" />}
                                Finalizar Inscripción
                            </button>
                        </form>
                    )}
                </div>
            </div>

            <p className="mt-8 text-white/30 text-[9px] font-black uppercase tracking-widest">Tudojang • Registro Seguro SSL 256bits</p>
        </div>
    );
};

export default PasarelaInscripcion;
