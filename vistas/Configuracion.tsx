
// vistas/Configuracion.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Usuario, TipoVinculacionColaborador, RolUsuario, Programa, TipoCobroPrograma, Sede } from '../tipos';
import { generarUrlAbsoluta, formatearPrecio, formatearFecha } from '../utils/formatters';
import {
    IconoCerrar, IconoContrato, IconoWhatsApp, IconoCopiar, IconoAprobar,
    IconoAgregar, IconoImagen, IconoCampana, IconoUsuario, IconoGuardar,
    IconoLogoOficial, IconoInformacion, IconoEditar, IconoEliminar,
    IconoCasa, IconoEstudiantes, IconoEnviar, IconoExitoAnimado,
    IconoHistorial, IconoEmail, IconoCandado
} from '../components/Iconos';
import { useGestionConfiguracion } from '../hooks/useGestionConfiguracion';
import { useNotificacion } from '../context/NotificacionContext';
import { useProgramas, useEstudiantes, useSedes } from '../context/DataContext';
import { actualizarUsuario } from '../servicios/api';
import { actualizarCapacidadClub, actualizarPlanClub } from '../servicios/configuracionApi';
import * as C from '../constantes'; // IMPORTACIÓN ROBUSTA
import TablaUsuarios from '../components/TablaUsuarios';
import FormularioUsuario from '../components/FormularioUsuario';
import FormularioSede from '../components/FormularioSede';
import ModalContratoUsuario from '../components/ModalContratoUsuario';
import ModalConfirmacion from '../components/ModalConfirmacion';
import GestionNotificacionesPush from '../components/GestionNotificacionesPush';
import Loader from '../components/Loader';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLimpiarParametrosPago } from '../hooks/useLimpiarParametrosPago';

// --- SUB-COMPONENTES DE CONFIGURACIÓN ---

const ModalFormPrograma: React.FC<{
    programa: Partial<Programa> | null,
    onCerrar: () => void,
    onGuardar: (datos: any) => void
}> = ({ programa, onCerrar, onGuardar }) => {
    const [nombre, setNombre] = useState(programa?.nombre || '');
    const [tipo, setTipo] = useState(programa?.tipoCobro || TipoCobroPrograma.Recurrente);
    const [valor, setValor] = useState(programa?.valor || 0);
    const [horario, setHorario] = useState(programa?.horario || '');

    const inputStyle = "w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl p-4 text-sm font-black text-gray-900 dark:text-white uppercase outline-none focus:ring-2 focus:ring-tkd-blue shadow-inner transition-all placeholder:text-gray-300";
    const selectStyle = "w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl p-4 text-sm font-black text-gray-900 dark:text-white uppercase outline-none focus:ring-2 focus:ring-tkd-blue shadow-inner appearance-none cursor-pointer";

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-tkd-dark/95 p-4 animate-fade-in backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-900 rounded-[3rem] shadow-2xl w-full max-w-md p-10 space-y-8 overflow-hidden relative border border-gray-100 dark:border-white/5">
                <div className="text-center">
                    <h3 className="text-2xl font-black uppercase tracking-tight text-gray-900 dark:text-white">Parámetros del Programa</h3>
                    <p className="text-[10px] font-black text-tkd-blue uppercase tracking-[0.2em] mt-2">Definición de servicio complementario</p>
                </div>

                <div className="space-y-5">
                    <div>
                        <label className="text-[10px] font-black uppercase text-gray-400 mb-2 ml-2 block tracking-widest">Nombre Descriptivo</label>
                        <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Poomsae Avanzado" className={inputStyle} />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="relative">
                            <label className="text-[10px] font-black uppercase text-gray-400 mb-2 ml-2 block tracking-widest">Modalidad</label>
                            <select value={tipo} onChange={e => setTipo(e.target.value as any)} className={selectStyle}>
                                <option value={TipoCobroPrograma.Recurrente}>Membresía</option>
                                <option value={TipoCobroPrograma.Unico}>Taller Corto</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-gray-400 mb-2 ml-2 block tracking-widest">Inversión (COP)</label>
                            <input type="number" value={valor} onChange={e => setValor(Number(e.target.value))} className={inputStyle} />
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-black uppercase text-gray-400 mb-2 ml-2 block tracking-widest">Cronograma / Sesiones</label>
                        <input type="text" value={horario} onChange={e => setHorario(e.target.value)} placeholder="Ej: Sábados 10:00 AM - 12:00 PM" className={inputStyle} />
                    </div>
                </div>

                <div className="space-y-3 pt-4">
                    <button
                        onClick={() => onGuardar({ ...programa, nombre, tipoCobro: tipo, valor, horario })}
                        className="w-full bg-tkd-red text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 hover:bg-red-700 transition-all active:scale-95"
                    >
                        <IconoGuardar className="w-6 h-6" /> Actualizar Catálogo
                    </button>
                    <button onClick={onCerrar} className="w-full text-gray-400 font-black uppercase text-[10px] tracking-widest py-2 hover:text-gray-600 transition-colors">Cerrar sin guardar</button>
                </div>
            </div>
        </div>
    );
};

const ModalPagoCheckout: React.FC<{
    item: any,
    tipo: 'addon' | 'plan',
    tenantId: string,
    onCerrar: () => void,
    onExito: (datos: any) => void
}> = ({ item, tipo, tenantId, onCerrar, onExito }) => {
    const [paso, setPaso] = useState<'checkout' | 'procesando' | 'exito'>('checkout');
    const { mostrarNotificacion } = useNotificacion();

    const ejecutarPagoYActivacion = async () => {
        setPaso('procesando');
        try {
            if (!C.CONFIGURACION_WOMPI) {
                throw new Error("Configuración de pagos no disponible.");
            }

            if (!window.crypto || !window.crypto.subtle) {
                alert("Error de seguridad: El navegador no soporta criptografía segura o no estás en HTTPS. Intenta desde un dispositivo seguro.");
                setPaso('checkout');
                return;
            }

            const precioEnCentavos = item.precio * 100;
            const moneda = 'COP';
            const referencia = `${tipo.toUpperCase()}_${tenantId}_${Date.now()}`;

            // Generar firma de integridad
            const cadenaFirma = `${referencia}${precioEnCentavos}${moneda}${C.CONFIGURACION_WOMPI.integrityKey}`;

            const encondedText = new TextEncoder().encode(cadenaFirma);
            const hashBuffer = await window.crypto.subtle.digest('SHA-256', encondedText);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

            // Asegurar que la URL de retorno use HashRouter correctamente
            const urlBase = window.location.origin + window.location.pathname;
            const urlRetorno = `${urlBase}#/configuracion?pago=exito`;

            const urlWompi = `https://checkout.wompi.co/p/?` +
                `public-key=${C.CONFIGURACION_WOMPI.publicKey}&` +
                `currency=${moneda}&` +
                `amount-in-cents=${precioEnCentavos}&` +
                `reference=${referencia}&` +
                `signature:integrity=${signature}&` +
                `redirect-url=${encodeURIComponent(urlRetorno)}`;

            // Marca optimista de pago iniciado
            localStorage.setItem('tkd_pago_reciente', Date.now().toString());
            window.location.assign(urlWompi);
        } catch (error) {
            console.error("Error al iniciar pago:", error);
            mostrarNotificacion("No se pudo iniciar el proceso de pago. Por favor intenta de nuevo.", "error");
            setPaso('checkout');
        }
    };

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-tkd-dark/90 p-4 animate-fade-in backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-900 rounded-[3rem] shadow-2xl w-full max-w-md p-10 overflow-hidden relative">
                {paso === 'checkout' && (
                    <div className="space-y-8 animate-slide-in-right">
                        <div className="text-center">
                            <h3 className="text-2xl font-black uppercase tracking-tight dark:text-white">Confirmar {tipo === 'plan' ? 'Cambio de Plan' : 'Compra'}</h3>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">Activación instantánea por sistema</p>
                        </div>

                        <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700 space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black uppercase text-gray-400">Concepto</span>
                                <span className="text-xs font-black dark:text-white uppercase">{item.label || item.nombre}</span>
                            </div>
                            <div className="flex justify-between items-center pt-4 border-t dark:border-gray-700">
                                <span className="text-[10px] font-black uppercase text-gray-400">Valor</span>
                                <span className="text-2xl font-black text-tkd-blue">{formatearPrecio(item.precio)}</span>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <button onClick={ejecutarPagoYActivacion} className="w-full bg-tkd-red text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 hover:bg-red-700 transition-all active:scale-95">
                                <IconoAprobar className="w-6 h-6" /> Pagar & Activar Ahora
                            </button>
                            <button onClick={onCerrar} className="w-full text-gray-400 font-black uppercase text-[10px] tracking-widest py-2">Cancelar Operación</button>
                        </div>
                    </div>
                )}

                {paso === 'procesando' && (
                    <div className="text-center py-12 space-y-6 animate-pulse">
                        <div className="w-24 h-24 border-8 border-tkd-blue border-t-transparent rounded-full animate-spin mx-auto"></div>
                        <h3 className="text-xl font-black uppercase dark:text-white">Procesando Pago</h3>
                    </div>
                )}

                {paso === 'exito' && (
                    <div className="text-center py-8 space-y-6 animate-fade-in">
                        <IconoExitoAnimado className="mx-auto text-green-500" />
                        <h3 className="text-3xl font-black uppercase text-green-600 tracking-tighter">¡Listo!</h3>
                        <button onClick={onCerrar} className="bg-tkd-blue text-white px-8 py-3 rounded-xl font-black uppercase text-xs">Regresar</button>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- VISTA PRINCIPAL ---

const VistaConfiguracion: React.FC = () => {
    const {
        usuarios, cargando, error, cargarConfiguracion,
        localConfigClub, localConfigNotificaciones, cargandoAccion,
        modalUsuarioAbierto, usuarioEnEdicion, abrirFormularioUsuario, cerrarFormularioUsuario, guardarUsuarioHandler,
        modalConfirmacionAbierto, usuarioAEliminar, abrirConfirmacionEliminar, cerrarConfirmacion, confirmarEliminacion,
        handleConfigChange, guardarConfiguracionesHandler, setLocalConfigClub, setLocalConfigNotificaciones, subirLogoTenant
    } = useGestionConfiguracion();

    const { programas, agregarPrograma, actualizarPrograma, eliminarPrograma } = useProgramas();
    const { sedes, agregarSede, actualizarSede, eliminarSede } = useSedes();
    const { mostrarNotificacion } = useNotificacion();
    const navigate = useNavigate();
    const location = useLocation();

    const [activeTab, setActiveTab] = useState<'institucional' | 'branding' | 'equipo' | 'sedes' | 'programas' | 'alertas' | 'licencia'>('institucional');
    const [itemAPagar, setItemAPagar] = useState<{ item: any, tipo: 'addon' | 'plan' } | null>(null);
    const [programaEdit, setProgramaEdit] = useState<Partial<Programa> | null>(null);
    const [modalProgramaAbierto, setModalProgramaAbierto] = useState(false);
    const [sedeEdit, setSedeEdit] = useState<Sede | null>(null);
    const [modalSedeAbierto, setModalSedeAbierto] = useState(false);
    const [usuarioContrato, setUsuarioContrato] = useState<Usuario | null>(null);

    // Usar ref para evitar ejecuciones múltiples
    const pagoProcesadoRef = useRef(false);

    // Limpiar parámetros de pago de la URL después de procesarlos
    useLimpiarParametrosPago(6000); // 6 segundos para dar tiempo al rastreo

    // Detectar retorno desde Wompi con pago exitoso (Rastreo Inteligente)
    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        const windowParams = new URLSearchParams(window.location.search);

        const pagoExitoso = queryParams.get('pago') || windowParams.get('pago') || (location.hash.includes('pago=exito') ? 'exito' : null);
        const transactionId = queryParams.get('id') || windowParams.get('id');

        if (pagoExitoso === 'exito' && !pagoProcesadoRef.current) {
            console.log('[Configuracion] Iniciando rastreo inteligente de pago. ID:', transactionId);
            pagoProcesadoRef.current = true;

            const iniciarRastreo = async () => {
                mostrarNotificacion('Detectamos tu pago. Sincronizando con el servidor...', 'info');

                let intentos = 0;
                const maxIntentos = 25; // ~1 minuto de rastreo (25 * 2.5s)

                const rastrear = async () => {
                    intentos++;
                    console.log(`[Configuracion] Rastreo activo #${intentos}...`);

                    if (transactionId) {
                        try {
                            const res = await fetch('/api/verificarTransaccion', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ data: { transactionId } })
                            });
                            const data = await res.json();
                            if (data?.data?.success) {
                                localStorage.removeItem('tkd_pago_reciente');
                                console.log('[Configuracion] ¡Éxito confirmado por API!');
                            }
                        } catch (e) { }
                    }

                    await cargarConfiguracion();

                    if (intentos < maxIntentos) {
                        setTimeout(rastrear, 2500);
                    } else {
                        localStorage.removeItem('tkd_pago_reciente');
                        mostrarNotificacion('Sincronización finalizada.', 'success');
                    }
                };


                rastrear();
                setActiveTab('licencia');
                navigate('/configuracion', { replace: true });
            };

            iniciarRastreo();
        }
    }, [location.search, cargarConfiguracion, mostrarNotificacion, navigate]);




    const handleExitoPago = (datos: any) => {
        setLocalConfigClub(prev => {
            if (!prev) return null;
            if (datos.tipo === 'addon') {
                return {
                    ...prev,
                    limiteEstudiantes: prev.limiteEstudiantes + (datos.limiteEstudiantes || 0),
                    limiteUsuarios: prev.limiteUsuarios + (datos.limiteUsuarios || 0),
                    limiteSedes: prev.limiteSedes + (datos.limiteSedes || 0)
                };
            } else {
                return {
                    ...prev,
                    plan: datos.plan.id,
                    limiteEstudiantes: datos.plan.limiteEstudiantes,
                    limiteUsuarios: datos.plan.limiteUsuarios,
                    limiteSedes: datos.plan.limiteSedes
                };
            }
        });
        setItemAPagar(null);
    };

    // Added comment above fix: implemented handleGuardarPrograma to manage creation and update of programs.
    const handleGuardarPrograma = async (datos: any) => {
        try {
            if (datos.id) {
                await actualizarPrograma(datos);
                mostrarNotificacion("Programa técnico actualizado.", "success");
            } else {
                await agregarPrograma(datos);
                mostrarNotificacion("Nuevo programa vinculado al catálogo.", "success");
            }
            setModalProgramaAbierto(false);
        } catch (error) {
            mostrarNotificacion("Error al procesar la solicitud del programa.", "error");
        }
    };

    // Added comment above fix: implemented handleGuardarSede to manage creation and update of dojang locations.
    const handleGuardarSede = async (datos: any) => {
        try {
            if (datos.id) {
                await actualizarSede(datos);
                mostrarNotificacion("Sede actualizada correctamente.", "success");
            } else {
                await agregarSede(datos);
                mostrarNotificacion("Sede registrada en el ecosistema.", "success");
            }
            setModalSedeAbierto(false);
        } catch (error) {
            mostrarNotificacion("Error al procesar la solicitud de la sede.", "error");
        }
    };

    // Modificado: Mejoramos la resiliencia de carga y el feedback visual
    if (!localConfigClub) {
        return (
            <div className="h-screen flex flex-col items-center justify-center bg-tkd-dark/5 gap-6 animate-pulse p-10 text-center">
                <Loader texto="Configurando Dojang..." />
                {(!cargando || error) && (
                    <div className="space-y-4 max-w-sm animate-fade-in">
                        {error && (
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 p-4 rounded-2xl mb-4">
                                <p className="text-red-600 dark:text-red-400 text-xs font-black uppercase tracking-tight">{error}</p>
                            </div>
                        )}
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-relaxed">
                            Si la carga se detiene, es posible que haya un problema con la conexión a la base de datos o el tenant no se haya sincronizado correctamente.
                        </p>
                        <button
                            onClick={() => cargarConfiguracion()}
                            className="bg-tkd-blue text-white px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all"
                        >
                            Forzar Reintento
                        </button>
                    </div>
                )}
            </div>
        );
    }

    const inputClasses = "w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl p-3 text-xs font-black text-gray-900 dark:text-white uppercase outline-none focus:ring-2 focus:ring-tkd-blue shadow-inner";

    return (
        <div className="p-4 sm:p-10 space-y-10 animate-fade-in">
            <header className="flex flex-col md:flex-row gap-8 justify-between items-start md:items-center">
                <div>
                    <h1 className="text-4xl font-black text-gray-900 dark:text-white uppercase tracking-tighter leading-none">Centro de Control</h1>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em] mt-2">Configuración Global y Parámetros del Dojang</p>
                </div>
                <button
                    onClick={(e) => guardarConfiguracionesHandler(e, sedes.length)}
                    disabled={cargandoAccion}
                    className="w-full md:w-auto bg-tkd-blue hover:brightness-110 text-white px-10 py-5 rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-premium flex items-center justify-center gap-4 active:scale-95 transition-all group"
                >
                    <IconoGuardar className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    <span>Guardar Cambios</span>
                </button>
            </header>

            {/* BARRA DE NAVEGACIÓN CAPAS DE ACCESO */}
            <div className="bg-white dark:bg-gray-800/50 p-1.5 rounded-[2rem] shadow-soft border border-gray-100 dark:border-white/5 w-full md:w-fit overflow-x-auto no-scrollbar">
                <div className="flex flex-row gap-1">
                    {[
                        { id: 'institucional', label: '1. Inf. Institucional', icon: IconoInformacion, bloqueado: false },
                        { id: 'branding', label: '2. Branding & Logo', icon: IconoImagen, bloqueado: !localConfigClub.nombreClub || !localConfigClub.nit },
                        { id: 'sedes', label: '3. Sedes', icon: IconoCasa, bloqueado: !localConfigClub.logoUrl },
                        { id: 'equipo', label: '4. Equipo Técnico', icon: IconoUsuario, bloqueado: sedes.length === 0 },
                        { id: 'programas', label: 'Programas Extra', icon: IconoLogoOficial, bloqueado: sedes.length === 0 },
                        { id: 'alertas', label: 'Alertas', icon: IconoCampana, bloqueado: sedes.length === 0 },
                        { id: 'licencia', label: 'Licencia', icon: IconoAprobar, bloqueado: false }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            disabled={tab.bloqueado}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex-shrink-0 flex items-center justify-center gap-3 px-8 py-4 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-tkd-blue text-white shadow-premium scale-[1.05] z-10' : tab.bloqueado ? 'text-gray-300 cursor-not-allowed grayscale' : 'text-gray-400 hover:text-tkd-blue hover:bg-gray-100 dark:hover:bg-white/5'}`}
                        >
                            <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-white' : ''}`} />
                            <span className="whitespace-nowrap">{tab.label}</span>
                            {tab.bloqueado && <div className="ml-1 opacity-50"><IconoCandado className="w-3 h-3" /></div>}
                        </button>
                    ))}
                </div>
            </div>

            {/* CONTENIDO DE PESTAÑAS */}
            <div className="min-h-[500px]">
                {activeTab === 'institucional' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 animate-fade-in">
                        <section className="bg-white dark:bg-white/5 p-10 rounded-[3rem] border border-gray-100 dark:border-white/10 space-y-8">
                            <h3 className="text-xl font-black uppercase tracking-tight text-tkd-blue">Información Institucional</h3>
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-gray-400 block mb-2 ml-1 tracking-widest">Nombre del Club</label>
                                        <input type="text" name="nombreClub" value={localConfigClub.nombreClub} onChange={(e) => handleConfigChange(e, setLocalConfigClub)} className={inputClasses} />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-gray-400 block mb-2 ml-1 tracking-widest flex items-center gap-1">
                                            NIT / Registro <span className="text-tkd-red text-xs">🔴</span>
                                        </label>
                                        <input type="text" name="nit" value={localConfigClub.nit} onChange={(e) => handleConfigChange(e, setLocalConfigClub)} className={inputClasses} placeholder="900.xxx.xxx-x" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-gray-400 block mb-2 ml-1 tracking-widest flex items-center gap-1">
                                            Representante Legal <span className="text-tkd-red text-xs">🔴</span>
                                        </label>
                                        <input type="text" name="representanteLegal" value={localConfigClub.representanteLegal} onChange={(e) => handleConfigChange(e, setLocalConfigClub)} className={inputClasses} placeholder="Nombre del Director" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-gray-400 block mb-2 ml-1 tracking-widest flex items-center gap-1">
                                            Documento Representante <span className="text-tkd-red text-xs">🔴</span>
                                        </label>
                                        <input type="text" name="ccRepresentante" value={localConfigClub.ccRepresentante} onChange={(e) => handleConfigChange(e, setLocalConfigClub)} className={inputClasses} placeholder="CC / Pasaporte" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-gray-400 block mb-2 ml-1 tracking-widest flex items-center gap-1">
                                            Ciudad de Firma <span className="text-tkd-red text-xs">🔴</span>
                                        </label>
                                        <input type="text" name="lugarFirma" value={localConfigClub.lugarFirma} onChange={(e) => handleConfigChange(e, setLocalConfigClub)} className={inputClasses} placeholder="Ej: Bogotá D.C." />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-gray-400 block mb-2 ml-1 tracking-widest flex items-center gap-1">
                                            Dirección Dojang <span className="text-tkd-red text-xs">🔴</span>
                                        </label>
                                        <input type="text" name="direccionClub" value={localConfigClub.direccionClub} onChange={(e) => handleConfigChange(e, setLocalConfigClub)} className={inputClasses} placeholder="Calle 123 #45-67" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-800">
                                        <label className="text-[9px] font-black uppercase text-tkd-blue block mb-2 ml-1 tracking-widest">Inscripción Inicial (COP)</label>
                                        <input type="number" name="valorInscripcion" value={localConfigClub.valorInscripcion} onChange={(e) => handleConfigChange(e, setLocalConfigClub)} className={inputClasses} />
                                    </div>
                                    <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-2xl border border-red-100 dark:border-red-800">
                                        <label className="text-[9px] font-black uppercase text-tkd-red block mb-2 ml-1 tracking-widest">Mora Mensual (%)</label>
                                        <input type="number" name="moraPorcentaje" value={localConfigClub.moraPorcentaje} onChange={(e) => handleConfigChange(e, setLocalConfigClub)} className={inputClasses} />
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section className="bg-tkd-blue/5 p-10 rounded-[3rem] border border-tkd-blue/10 flex flex-col items-center justify-center text-center space-y-6">
                            <div className="w-20 h-20 bg-tkd-blue text-white rounded-[2rem] flex items-center justify-center shadow-xl">
                                <IconoInformacion className="w-10 h-10" />
                            </div>
                            <h3 className="text-2xl font-black uppercase tracking-tight text-tkd-blue">Primer Paso Obligatorio</h3>
                            <p className="text-xs font-bold text-gray-500 max-w-xs uppercase leading-relaxed">
                                Completa los datos institucionales para habilitar la personalización de tu marca y la creación de sedes físicas.
                            </p>
                            {!localConfigClub.nombreClub || !localConfigClub.nit ? (
                                <span className="text-tkd-red font-black text-[10px] uppercase tracking-widest flex items-center gap-2">
                                    <div className="w-2 h-2 bg-tkd-red rounded-full animate-ping" /> Pendiente completar campos
                                </span>
                            ) : (
                                <span className="text-green-500 font-black text-[10px] uppercase tracking-widest flex items-center gap-2">
                                    <IconoAprobar className="w-4 h-4" /> ¡Identidad Definida!
                                </span>
                            )}
                        </section>
                    </div>
                )}

                {activeTab === 'branding' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 animate-fade-in">
                        <section className="bg-white dark:bg-white/5 p-10 rounded-[3rem] border border-gray-100 dark:border-white/10 space-y-8">
                            <h3 className="text-xl font-black uppercase tracking-tight text-tkd-blue">Branding & Logo</h3>

                            <div className="flex flex-col items-center justify-center border-4 border-dashed border-gray-100 dark:border-white/5 rounded-[3rem] p-8 text-center space-y-6">
                                <div className="w-40 h-40 bg-gray-50 dark:bg-black/20 rounded-full flex items-center justify-center overflow-hidden border-4 border-white dark:border-gray-800 shadow-xl relative group">
                                    {localConfigClub.logoUrl ? <img src={localConfigClub.logoUrl} className="w-full h-full object-contain" /> : <IconoLogoOficial className="w-20 h-20 opacity-20" />}
                                </div>
                                <div className="flex gap-4">
                                    <label className="cursor-pointer px-6 py-3 bg-tkd-dark text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all flex items-center gap-2">
                                        <IconoImagen className="w-4 h-4" />
                                        <span>Seleccionar Logo</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (file && localConfigClub) {
                                                    try {
                                                        const url = await subirLogoTenant(localConfigClub.tenantId, file);
                                                        setLocalConfigClub(prev => prev ? ({ ...prev, logoUrl: url }) : null);
                                                        mostrarNotificacion("Logo cargado. No olvide guardar los cambios.", "success");
                                                    } catch (err) {
                                                        mostrarNotificacion("Error al subir la imagen.", "error");
                                                    }
                                                }
                                            }}
                                        />
                                    </label>
                                    {localConfigClub.logoUrl && (
                                        <button
                                            onClick={() => setLocalConfigClub(prev => prev ? ({ ...prev, logoUrl: '' }) : null)}
                                            className="px-4 py-3 bg-red-50 text-tkd-red rounded-xl font-black uppercase text-[10px] tracking-widest shadow-sm active:scale-95 transition-all"
                                        >
                                            <IconoEliminar className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </section>

                        <section className="bg-white dark:bg-white/5 p-10 rounded-[3rem] border border-gray-100 dark:border-white/10 space-y-8">
                            <h3 className="text-xl font-black uppercase tracking-tight text-tkd-blue">Paleta de Colores Institucional</h3>
                            <div className="grid grid-cols-1 gap-4">
                                <div className="flex items-center gap-4 bg-gray-50 dark:bg-black/20 p-3 rounded-2xl">
                                    <input
                                        type="color"
                                        name="colorPrimario"
                                        value={localConfigClub.colorPrimario || '#FFFFFF'}
                                        onChange={(e) => handleConfigChange(e as any, setLocalConfigClub)}
                                        className="w-10 h-10 rounded-xl border-none cursor-pointer bg-transparent"
                                    />
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-gray-900 dark:text-white">Color Primario</p>
                                        <p className="text-[9px] font-mono text-gray-400">{localConfigClub.colorPrimario}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 bg-gray-50 dark:bg-black/20 p-3 rounded-2xl">
                                    <input
                                        type="color"
                                        name="colorSecundario"
                                        value={localConfigClub.colorSecundario || '#0047A0'}
                                        onChange={(e) => handleConfigChange(e as any, setLocalConfigClub)}
                                        className="w-10 h-10 rounded-xl border-none cursor-pointer bg-transparent"
                                    />
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-gray-900 dark:text-white">Color Secundario</p>
                                        <p className="text-[9px] font-mono text-gray-400">{localConfigClub.colorSecundario}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 bg-gray-50 dark:bg-black/20 p-3 rounded-2xl">
                                    <input
                                        type="color"
                                        name="colorAcento"
                                        value={localConfigClub.colorAcento || '#CD2E3A'}
                                        onChange={(e) => handleConfigChange(e as any, setLocalConfigClub)}
                                        className="w-10 h-10 rounded-xl border-none cursor-pointer bg-transparent"
                                    />
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-gray-900 dark:text-white">Color de Acento</p>
                                        <p className="text-[9px] font-mono text-gray-400">{localConfigClub.colorAcento}</p>
                                    </div>
                                </div>

                                <button
                                    onClick={() => {
                                        setLocalConfigClub(prev => prev ? ({
                                            ...prev,
                                            colorPrimario: '#111111',
                                            colorSecundario: '#0047A0',
                                            colorAcento: '#CD2E3A'
                                        }) : null);
                                        mostrarNotificacion("Colores restaurados a valores originales. No olvide guardar los cambios.", "success");
                                    }}
                                    className="mt-4 w-full bg-gray-100 dark:bg-white/5 text-gray-500 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-gray-200 dark:hover:bg-white/10 transition-all flex items-center justify-center gap-3"
                                >
                                    <IconoHistorial className="w-4 h-4" /> Restablecer Colores
                                </button>
                            </div>
                        </section>
                    </div>
                )}

                {activeTab === 'equipo' && (
                    <div className="space-y-8 animate-fade-in">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-black uppercase tracking-tight text-tkd-blue">Nómina Técnica y Personal</h3>
                                {localConfigClub && (
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">
                                        Cupos utilizados: <span className={usuarios.length >= localConfigClub.limiteUsuarios ? 'text-tkd-red' : 'text-tkd-blue'}>{usuarios.length} de {localConfigClub.limiteUsuarios}</span>
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={() => {
                                    if (localConfigClub && usuarios.length >= localConfigClub.limiteUsuarios) {
                                        mostrarNotificacion(`Ha alcanzado el límite de personal (${localConfigClub.limiteUsuarios}) para su plan actual.`, "warning");
                                        return;
                                    }
                                    abrirFormularioUsuario();
                                }}
                                className="bg-tkd-blue text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg flex items-center gap-2 active:scale-95 transition-all"
                            >
                                <IconoAgregar className="w-4 h-4" /> Vincular Miembro
                            </button>
                        </div>
                        <div className="tkd-card p-0">
                            <TablaUsuarios
                                usuarios={usuarios}
                                onEditar={abrirFormularioUsuario}
                                onEliminar={abrirConfirmacionEliminar}
                                onGestionarContrato={(u: Usuario) => setUsuarioContrato(u)}
                            />
                        </div>
                    </div>
                )}

                {activeTab === 'sedes' && (
                    <div className="space-y-8 animate-fade-in">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-black uppercase tracking-tight text-tkd-blue">Gestión de Sedes / Dojangs</h3>
                                {localConfigClub && (
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">
                                        Sedes activas: <span className={sedes.length >= localConfigClub.limiteSedes ? 'text-tkd-red' : 'text-tkd-blue'}>{sedes.length} de {localConfigClub.limiteSedes}</span>
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={() => {
                                    if (localConfigClub && sedes.length >= localConfigClub.limiteSedes) {
                                        mostrarNotificacion(`Ha alcanzado el límite de sedes (${localConfigClub.limiteSedes}) para su plan actual.`, "warning");
                                        return;
                                    }
                                    setSedeEdit(null); // Limpiar para nueva sede
                                    setModalSedeAbierto(true);
                                }}
                                className="bg-tkd-blue hover:brightness-110 text-white px-8 py-4 rounded-[2rem] font-black uppercase text-[10px] tracking-widest shadow-premium flex items-center gap-2 active:scale-95 transition-all"
                            >
                                <IconoAgregar className="w-5 h-5" /> Registrar Sede
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {sedes.map(s => (
                                <div key={s.id} className="tkd-card p-8 space-y-6">
                                    <div className="flex justify-between items-start">
                                        <div className="p-3 bg-tkd-blue/10 rounded-2xl"><IconoCasa className="w-6 h-6 text-tkd-blue" /></div>
                                        <div className="flex gap-2">
                                            <button onClick={() => { setSedeEdit(s); setModalSedeAbierto(true); }} className="p-2 text-gray-400 hover:text-tkd-blue"><IconoEditar className="w-4 h-4" /></button>
                                            <button onClick={() => eliminarSede(s.id)} className="p-2 text-gray-400 hover:text-tkd-red"><IconoEliminar className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="font-black uppercase text-lg leading-tight">{s.nombre}</h4>
                                        <p className="text-[10px] font-black text-gray-400 uppercase mt-1">{s.ciudad} • {s.direccion}</p>
                                    </div>
                                    <div className="pt-4 border-t dark:border-white/5 flex justify-between items-center">
                                        <p className="text-[9px] font-black text-gray-400 uppercase">Tarifa Sede</p>
                                        <p className="text-sm font-black text-tkd-blue">{s.valorMensualidad ? formatearPrecio(s.valorMensualidad) : 'TARIFA BASE'}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'programas' && (
                    <div className="space-y-8 animate-fade-in">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-black uppercase tracking-tight text-tkd-blue">Catálogo de Programas Extra</h3>
                            <button onClick={() => { setProgramaEdit(null); setModalProgramaAbierto(true); }} className="bg-tkd-blue hover:brightness-110 text-white px-8 py-4 rounded-[2rem] font-black uppercase text-[10px] tracking-widest shadow-premium flex items-center gap-2 active:scale-95 transition-all">
                                <IconoAgregar className="w-5 h-5" /> Crear Modalidad
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {programas.map(p => (
                                <div key={p.id} className="tkd-card p-8 space-y-6">
                                    <div className="flex justify-between items-start">
                                        <div className="p-3 bg-tkd-red/10 rounded-2xl"><IconoLogoOficial className="w-6 h-6 text-tkd-red" /></div>
                                        <div className="flex gap-2">
                                            <button onClick={() => { setProgramaEdit(p); setModalProgramaAbierto(true); }} className="p-2 text-gray-400 hover:text-tkd-blue"><IconoEditar className="w-4 h-4" /></button>
                                            <button onClick={() => eliminarPrograma(p.id)} className="p-2 text-gray-400 hover:text-tkd-red"><IconoEliminar className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="font-black uppercase text-lg leading-tight">{p.nombre}</h4>
                                        <p className="text-[10px] font-black text-tkd-blue uppercase mt-1">{p.tipoCobro}</p>
                                        <p className="text-xs text-gray-500 mt-4 uppercase font-medium line-clamp-2">{p.descripcion || 'Sin descripción técnica registrada.'}</p>
                                    </div>
                                    <div className="pt-4 border-t dark:border-white/5 flex justify-between items-center">
                                        <p className="text-sm font-black text-gray-900 dark:text-white">+{formatearPrecio(p.valor)}</p>
                                        <span className="text-[9px] font-black bg-gray-100 dark:bg-white/10 px-3 py-1 rounded-lg text-gray-400">ACTIVADO</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'alertas' && (
                    <div className="max-w-4xl space-y-8 animate-fade-in">
                        <section className="bg-white dark:bg-white/5 p-10 rounded-[3rem] border border-gray-100 dark:border-white/10 space-y-10">
                            <div className="flex items-center gap-4">
                                <IconoCampana className="w-10 h-10 text-tkd-blue" />
                                <div>
                                    <h3 className="text-2xl font-black uppercase tracking-tighter">Motor de Notificaciones</h3>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Business Intelligence Rules</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black uppercase text-gray-400 block ml-1 tracking-widest">Día de Cobro Mensual (1-28)</label>
                                    <input type="number" name="diaCobroMensual" value={localConfigNotificaciones.diaCobroMensual} onChange={(e) => handleConfigChange(e as any, setLocalConfigNotificaciones)} className={inputClasses} />
                                </div>
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black uppercase text-gray-400 block ml-1 tracking-widest">Días Anticipo Recordatorio</label>
                                    <input type="number" name="diasAnticipoRecordatorio" value={localConfigNotificaciones.diasAnticipoRecordatorio} onChange={(e) => handleConfigChange(e as any, setLocalConfigNotificaciones)} className={inputClasses} />
                                </div>
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black uppercase text-tkd-red block ml-1 tracking-widest">Días de Gracia antes de Suspensión</label>
                                    <input type="number" name="diasGraciaSuspension" value={localConfigNotificaciones.diasGraciaSuspension} onChange={(e) => handleConfigChange(e as any, setLocalConfigNotificaciones)} className={inputClasses} />
                                </div>
                            </div>

                            <GestionNotificacionesPush />
                        </section>
                    </div>
                )}

                {activeTab === 'licencia' && (
                    <div className="space-y-10 animate-fade-in">
                        {window.location.search.includes('pago=exito') && (
                            <div className="bg-tkd-blue/10 border-2 border-tkd-blue/30 p-6 rounded-3xl flex items-center justify-between mb-8 animate-pulse">
                                <div className="flex items-center gap-4">
                                    <div className="bg-tkd-blue p-3 rounded-2xl">
                                        <IconoInformacion className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <h4 className="font-black uppercase text-sm text-tkd-blue">Pago Recibido Correctamente</h4>
                                        <p className="text-[10px] text-tkd-blue/60 uppercase font-black tracking-widest">
                                            Tu transacción {new URLSearchParams(window.location.search).get('id')} está siendo validada por el servidor.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => window.location.reload()}
                                    className="bg-tkd-blue text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all"
                                >
                                    Refrescar Ahora
                                </button>
                            </div>
                        )}

                        <div className="bg-tkd-dark text-white p-10 rounded-[3rem] shadow-2xl flex flex-col md:flex-row justify-between items-center gap-8 border border-white/5 relative overflow-hidden">
                            <div className="relative z-10">
                                <p className="text-[10px] font-black text-tkd-red uppercase tracking-[0.4em] mb-2">Estado de Suscripción</p>
                                <h3 className="text-4xl font-black uppercase tracking-tighter">Plan <span className="text-tkd-blue">{localConfigClub.plan}</span></h3>
                                <p className="text-gray-400 text-xs mt-4 font-bold uppercase tracking-widest">Vence el: {formatearFecha(localConfigClub.fechaVencimiento)}</p>
                            </div>
                            <div className="flex gap-4 relative z-10">
                                <button
                                    onClick={() => setItemAPagar({ item: (C.PLANES_SAAS as any)[localConfigClub.plan || 'starter'], tipo: 'plan' })}
                                    className="bg-white text-tkd-dark px-10 py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-gray-100 transition-all active:scale-95"
                                >
                                    Renovar Licencia
                                </button>
                            </div>
                            <div className="absolute -right-20 -bottom-20 opacity-5 rotate-12"><IconoLogoOficial className="w-80 h-80" /></div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {Object.values(C.COSTOS_ADICIONALES).map(addon => (
                                <div key={addon.key} className="bg-white dark:bg-white/5 p-8 rounded-[2.5rem] border border-gray-100 dark:border-white/10 flex flex-col justify-between hover:shadow-premium transition-all">
                                    <div>
                                        <p className="text-[10px] font-black text-tkd-blue uppercase tracking-[0.2em] mb-1">Add-on de Capacidad</p>
                                        <h4 className="text-xl font-black uppercase tracking-tight dark:text-white">{addon.label}</h4>
                                        <p className="text-sm font-black text-gray-900 dark:text-gray-400 mt-4">{formatearPrecio(addon.precio)} <span className="text-[9px] opacity-40">Pago único</span></p>
                                    </div>
                                    <button onClick={() => setItemAPagar({ item: addon, tipo: 'addon' })} className="mt-8 w-full py-4 bg-gray-50 dark:bg-gray-800 rounded-xl font-black uppercase text-[9px] tracking-widest text-gray-500 hover:bg-tkd-blue hover:text-white transition-all active:scale-95 shadow-sm">Adquirir Capacidad</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* MODALES DINÁMICOS */}
            {modalUsuarioAbierto && <FormularioUsuario abierto={modalUsuarioAbierto} onCerrar={cerrarFormularioUsuario} onGuardar={guardarUsuarioHandler} usuarioActual={usuarioEnEdicion} cargando={cargandoAccion} />}
            {modalConfirmacionAbierto && usuarioAEliminar && <ModalConfirmacion abierto={modalConfirmacionAbierto} titulo="Eliminar Usuario" mensaje={`¿Confirmas la eliminación definitiva de ${usuarioAEliminar.nombreUsuario}?`} onCerrar={cerrarConfirmacion} onConfirmar={confirmarEliminacion} cargando={cargandoAccion} />}
            {modalProgramaAbierto && <ModalFormPrograma programa={programaEdit} onCerrar={() => setModalProgramaAbierto(false)} onGuardar={handleGuardarPrograma} />}
            {modalSedeAbierto && <FormularioSede abierto={modalSedeAbierto} onCerrar={() => setModalSedeAbierto(false)} onGuardar={handleGuardarSede} sedeActual={sedeEdit} cargando={cargandoAccion} />}
            {itemAPagar && <ModalPagoCheckout item={itemAPagar.item} tipo={itemAPagar.tipo} tenantId={localConfigClub.tenantId} onCerrar={() => setItemAPagar(null)} onExito={handleExitoPago} />}
            {usuarioContrato && (
                <ModalContratoUsuario
                    abierto={!!usuarioContrato}
                    usuario={usuarioContrato}
                    configClub={localConfigClub}
                    onCerrar={() => setUsuarioContrato(null)}
                    onGuardar={async (usuarioActualizado) => {
                        try {
                            await actualizarUsuario({ contrato: usuarioActualizado.contrato, estadoContrato: usuarioActualizado.estadoContrato }, usuarioActualizado.id);
                            mostrarNotificacion("Contrato actualizado correctamente.", "success");
                            setUsuarioContrato(null);
                            cargarConfiguracion();
                        } catch (err) {
                            mostrarNotificacion("Error al guardar el contrato.", "error");
                        }
                    }}
                />
            )}
        </div>
    );
};

export default VistaConfiguracion;
