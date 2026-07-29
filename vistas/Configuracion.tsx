
// vistas/Configuracion.tsx
import React, { useState, useEffect } from 'react';
import { Usuario, TipoVinculacionColaborador, RolUsuario, Programa, TipoCobroPrograma, Sede, ConfiguracionClub } from '../tipos';
import { generarUrlAbsoluta, formatearPrecio } from '../utils/formatters';
import {
    IconoCerrar, IconoContrato, IconoWhatsApp, IconoCopiar, IconoAprobar,
    IconoAgregar, IconoImagen, IconoUsuario, IconoGuardar,
    IconoLogoOficial, IconoInformacion, IconoEditar, IconoEliminar,
    IconoProgramasExtra, IconoConfiguracionAlertas,
    IconoCasa, IconoEstudiantes, IconoEnviar, IconoExitoAnimado,
    IconoHistorial, IconoEmail
} from '../components/Iconos';
import { useGestionConfiguracion } from '../hooks/useGestionConfiguracion';
import { useNotificacion } from '../context/NotificacionContext';
import { useProgramas, useEstudiantes, useSedes } from '../context/DataContext';
import { actualizarUsuario } from '../servicios/api';
import { actualizarCapacidadClub, actualizarPlanClub } from '../servicios/configuracionApi';
import { COSTOS_ADICIONALES, PLANES_SAAS, CONFIGURACION_WOMPI } from '../constantes';
import { construirUrlCheckoutWompi, crearFuentePagoWompi } from '../servicios/wompiApi';
import TablaUsuarios from '../components/TablaUsuarios';
import FormularioUsuario from '../components/FormularioUsuario';
import FormularioSede from '../components/FormularioSede';
import ModalConfirmacion from '../components/ModalConfirmacion';
import GestionNotificacionesPush from '../components/GestionNotificacionesPush';
import InvitacionesView from './admin/InvitacionesView';
import VinculosView from './admin/VinculosView';
import { optimizarImagenBase64 } from '../utils/imageProcessor';
import Loader from '../components/Loader';
import { obtenerLimiteEquipoTecnico, obtenerLimiteOperativo } from '../utils/limitesSaas';

// --- SUB-COMPONENTES DE CONFIGURACIÓN ---

const ModalFormPrograma: React.FC<{
    programa: Partial<Programa> | null,
    onCerrar: () => void,
    onGuardar: (datos: any) => void
}> = ({ programa, onCerrar, onGuardar }) => {
    const [nombre, setNombre] = useState(programa?.nombre || '');
    const [tipo, setTipo] = useState(programa?.tipoCobro || TipoCobroPrograma.Recurrente);
    const [valor, setValor] = useState<number | ''>(programa?.valor || '');
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
                            <input type="number" min="0" value={valor} onChange={e => setValor(e.target.value === '' ? '' : Number(e.target.value))} className={inputStyle} placeholder="0" />
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-black uppercase text-gray-400 mb-2 ml-2 block tracking-widest">Cronograma / Sesiones</label>
                        <input type="text" value={horario} onChange={e => setHorario(e.target.value)} placeholder="Ej: Sábados 10:00 AM - 12:00 PM" className={inputStyle} />
                    </div>
                </div>

                <div className="space-y-3 pt-4">
                    <button
                        onClick={() => onGuardar({ ...programa, nombre, tipoCobro: tipo, valor: Number(valor) || 0, horario })}
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
    const { mostrarNotificacion } = useNotificacion();
    // Selector Mensual/Anual (mismo patron que vistas/PasarelaPagos.tsx y
    // vistas/LicenciaSuspendida.tsx). Solo aplica a cambio/renovacion de plan -- los
    // addons (+alumnos, +usuario, +sede) son siempre un cargo mensual recurrente.
    const [periodoAnual, setPeriodoAnual] = useState(false);
    const esPlan = tipo === 'plan';
    const MESES_A_COBRAR_ANUAL = 10; // 12 meses de plan, 10 cobrados (2 de bonificación).
    const montoFinal = esPlan && periodoAnual ? item.precio * MESES_A_COBRAR_ANUAL : item.precio;

    const handleProcederAlPago = async () => {
        try {
            const urlRetorno = `${window.location.origin}/#/`;
            const urlWompi = await construirUrlCheckoutWompi({
                tenantId,
                itemType: tipo === 'addon' ? 'addon' : 'plan',
                itemId: tipo === 'addon' ? item.key : item.id,
                periodo: esPlan && periodoAnual ? 'anual' : 'mensual',
                montoEnPesos: montoFinal,
                redirectUrl: urlRetorno,
            });

            window.open(urlWompi, '_blank');
            if (tipo === 'addon') onExito({ tipo: 'addon', item: item.key });
            else onExito({ tipo: 'plan', plan: item.id });
            onCerrar();
        } catch (error) {
            console.error("Error al redireccionar a pasarela:", error);
            mostrarNotificacion("Error al conectar con la pasarela de pagos.", "error");
        }
    };

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-tkd-dark/90 p-4 animate-fade-in backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-900 rounded-[3rem] shadow-2xl w-full max-w-md p-10 overflow-hidden relative">
                <div className="space-y-8 animate-slide-in-right">
                    <div className="text-center">
                        <h3 className="text-2xl font-black uppercase tracking-tight dark:text-white">Confirmar {tipo === 'plan' ? 'Cambio de Plan' : 'Compra'}</h3>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">Serás redirigido a la pasarela segura de Wompi</p>
                    </div>

                    {esPlan && (
                        <div className="flex justify-center">
                            <div className="bg-gray-100 dark:bg-white/10 p-1.5 rounded-2xl flex items-center shadow-inner">
                                <button
                                    type="button"
                                    onClick={() => setPeriodoAnual(false)}
                                    className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!periodoAnual ? 'bg-white dark:bg-gray-900 text-tkd-blue shadow-md scale-105' : 'text-gray-400'}`}
                                >
                                    Mensual
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPeriodoAnual(true)}
                                    className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${periodoAnual ? 'bg-white dark:bg-gray-900 text-tkd-blue shadow-md scale-105' : 'text-gray-400'}`}
                                >
                                    Anual (Ahorra 2 Meses)
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700 space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase text-gray-400">Concepto</span>
                            <span className="text-xs font-black dark:text-white uppercase">{item.label || item.nombre}</span>
                        </div>
                        <div className="flex justify-between items-center pt-4 border-t dark:border-gray-700">
                            <span className="text-[10px] font-black uppercase text-gray-400">
                                {esPlan && periodoAnual ? 'Inversión (pago único anual)' : 'Inversión'}
                            </span>
                            <span className="text-2xl font-black text-tkd-blue">{formatearPrecio(montoFinal)}</span>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <button onClick={handleProcederAlPago} className="w-full bg-tkd-red text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 hover:bg-red-700 transition-all active:scale-95">
                            <IconoAprobar className="w-6 h-6" /> Ir a pago seguro
                        </button>
                        <button onClick={onCerrar} className="w-full text-gray-400 font-black uppercase text-[10px] tracking-widest py-2">Cancelar</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Decisión (2026-07-15, confirmada contra https://docs.wompi.co/en/docs/colombia/fuentes-de-pago/
// y https://docs.wompi.co/en/docs/colombia/widget-checkout-web/): NO se usa `new WidgetCheckout(...).open(callback)`
// para tokenizar. Ese constructor JS solo está documentado para el widget de COBRO (exige
// amountInCents/reference y devuelve result.transaction) -- no tiene modo tokenización.
// El único modo tokenización real documentado por Wompi es el embed HTML
// `<script data-render="button" data-widget-operation="tokenize">` dentro de un <form>, que
// al completarse hace un POST de navegación de página completa al `action` del form (pensado
// para apps server-rendered, no para una SPA: exigiría un endpoint HTTP nuevo -- no un
// callable-- y perder el estado de React). En su lugar se usa la tokenización directa que
// Wompi documenta como alternativa explícita para este caso (POST /v1/tokens/cards con la
// public key, sin backend de por medio -- mismo nivel de PCI-compliance: "the card data
// should only travel between the device and the API, never through the merchant's server").
// El resultado (token) se manda tal cual al callable `crearFuentePagoWompi`.
interface DatosTarjetaCobroAutomatico {
    numero: string;
    nombreTitular: string;
    mesExpiracion: string;
    anioExpiracion: string;
    cvc: string;
}

const DATOS_TARJETA_INICIAL: DatosTarjetaCobroAutomatico = {
    numero: '',
    nombreTitular: '',
    mesExpiracion: '',
    anioExpiracion: '',
    cvc: '',
};

const SeccionCobroAutomatico: React.FC<{
    tenant: ConfiguracionClub,
    // wompiPaymentSourceId ya no se propaga a ConfiguracionClub (fix seguridad 2026-07-18:
    // ese campo se movió al subdocumento privado tenants/{tenantId}/privado/facturacion,
    // fuera del doc principal del tenant que sincroniza el listener de Firestore). El
    // callable crearFuentePagoWompi lo sigue devolviendo -- es la respuesta directa al mismo
    // Admin que lo acaba de crear -- pero ya no hay razón para guardarlo en el estado local.
    onActivado: () => void
}> = ({ tenant, onActivado }) => {
    const { mostrarNotificacion } = useNotificacion();
    const [formularioAbierto, setFormularioAbierto] = useState(false);
    const [datosTarjeta, setDatosTarjeta] = useState<DatosTarjetaCobroAutomatico>(DATOS_TARJETA_INICIAL);
    const [enviando, setEnviando] = useState(false);

    const inputStyle = "w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl p-3 text-xs font-black text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-tkd-blue shadow-inner transition-all disabled:opacity-50";

    const handleCambioTarjeta = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setDatosTarjeta(prev => ({ ...prev, [name]: value }));
    };

    const validarFormulario = (): string | null => {
        const numeroLimpio = datosTarjeta.numero.replace(/\s+/g, '');
        if (!/^\d{13,19}$/.test(numeroLimpio)) return "Número de tarjeta inválido.";
        if (!datosTarjeta.nombreTitular.trim()) return "El nombre del titular es obligatorio.";
        if (!/^(0[1-9]|1[0-2])$/.test(datosTarjeta.mesExpiracion)) return "Mes de expiración inválido (MM).";
        if (!/^\d{2}$/.test(datosTarjeta.anioExpiracion)) return "Año de expiración inválido (AA).";
        if (!/^\d{3,4}$/.test(datosTarjeta.cvc)) return "CVC inválido.";
        return null;
    };

    const handleActivarCobroAutomatico = async () => {
        const errorValidacion = validarFormulario();
        if (errorValidacion) {
            mostrarNotificacion(errorValidacion, "error");
            return;
        }

        setEnviando(true);
        try {
            const numeroLimpio = datosTarjeta.numero.replace(/\s+/g, '');
            const respuestaTokenizacion = await fetch('https://production.wompi.co/v1/tokens/cards', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${CONFIGURACION_WOMPI.publicKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    number: numeroLimpio,
                    cvc: datosTarjeta.cvc,
                    exp_month: datosTarjeta.mesExpiracion,
                    exp_year: datosTarjeta.anioExpiracion,
                    card_holder: datosTarjeta.nombreTitular.trim(),
                }),
            });

            const cuerpoTokenizacion = await respuestaTokenizacion.json().catch(() => null);

            if (!respuestaTokenizacion.ok || cuerpoTokenizacion?.status !== 'CREATED' || !cuerpoTokenizacion?.data?.id) {
                const mensajesError = cuerpoTokenizacion?.error?.messages
                    ? Object.values(cuerpoTokenizacion.error.messages).flat().join(' ')
                    : null;
                throw new Error(mensajesError || "No se pudo validar la tarjeta con la pasarela de pagos.");
            }

            const token = cuerpoTokenizacion.data.id as string;

            await crearFuentePagoWompi({ tenantId: tenant.tenantId, token });

            setDatosTarjeta(DATOS_TARJETA_INICIAL);
            setFormularioAbierto(false);
            mostrarNotificacion("Cobro automático activado exitosamente.", "success");
            onActivado();
        } catch (error) {
            mostrarNotificacion(
                error instanceof Error ? error.message : "No se pudo activar el cobro automático.",
                "error"
            );
        } finally {
            setEnviando(false);
        }
    };

    if (tenant.cobroAutomaticoActivo) {
        return (
            <section className="bg-white dark:bg-white/5 p-8 rounded-[3rem] border border-gray-100 dark:border-white/10">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-green-50 dark:bg-green-900/10 rounded-2xl text-green-600">
                        <IconoAprobar className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black uppercase tracking-tight text-gray-900 dark:text-white">Cobro automático activo</h3>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">La mensualidad se debitará automáticamente cada mes</p>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="bg-white dark:bg-white/5 p-8 rounded-[3rem] border border-gray-100 dark:border-white/10 space-y-6">
            <div>
                <h3 className="text-xl font-black uppercase tracking-tight text-tkd-blue">Cobro Automático</h3>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-2 max-w-2xl leading-relaxed">
                    Registra una tarjeta para que la mensualidad de tu plan se cobre automáticamente cada mes, sin gestiones manuales.
                </p>
            </div>

            {!formularioAbierto ? (
                <button
                    onClick={() => setFormularioAbierto(true)}
                    className="bg-tkd-blue text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all"
                >
                    Activar Cobro Automático
                </button>
            ) : (
                <div className="space-y-5 max-w-lg animate-fade-in">
                    <div>
                        <label className="text-[10px] font-black uppercase text-gray-400 mb-2 ml-1 block tracking-widest">Número de Tarjeta</label>
                        <input type="text" name="numero" inputMode="numeric" maxLength={19} value={datosTarjeta.numero} onChange={handleCambioTarjeta} placeholder="4242 4242 4242 4242" className={inputStyle} disabled={enviando} />
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase text-gray-400 mb-2 ml-1 block tracking-widest">Nombre del Titular</label>
                        <input type="text" name="nombreTitular" value={datosTarjeta.nombreTitular} onChange={handleCambioTarjeta} placeholder="Como aparece en la tarjeta" className={inputStyle} disabled={enviando} />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="text-[10px] font-black uppercase text-gray-400 mb-2 ml-1 block tracking-widest">Mes (MM)</label>
                            <input type="text" name="mesExpiracion" inputMode="numeric" maxLength={2} value={datosTarjeta.mesExpiracion} onChange={handleCambioTarjeta} placeholder="08" className={inputStyle} disabled={enviando} />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-gray-400 mb-2 ml-1 block tracking-widest">Año (AA)</label>
                            <input type="text" name="anioExpiracion" inputMode="numeric" maxLength={2} value={datosTarjeta.anioExpiracion} onChange={handleCambioTarjeta} placeholder="28" className={inputStyle} disabled={enviando} />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-gray-400 mb-2 ml-1 block tracking-widest">CVC</label>
                            <input type="text" name="cvc" inputMode="numeric" maxLength={4} value={datosTarjeta.cvc} onChange={handleCambioTarjeta} placeholder="123" className={inputStyle} disabled={enviando} />
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        <button
                            onClick={handleActivarCobroAutomatico}
                            disabled={enviando}
                            className="flex-1 bg-tkd-red disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
                        >
                            {enviando ? 'Procesando...' : 'Confirmar Tarjeta'}
                        </button>
                        <button
                            onClick={() => { setFormularioAbierto(false); setDatosTarjeta(DATOS_TARJETA_INICIAL); }}
                            disabled={enviando}
                            className="flex-1 sm:flex-none text-gray-400 font-black uppercase text-[10px] tracking-widest py-4 px-6 hover:text-gray-600 transition-colors disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                    </div>
                    <p className="text-[9px] text-gray-400 uppercase font-bold italic">Tus datos de tarjeta viajan directo a la pasarela de pagos Wompi. Nunca pasan por nuestros servidores.</p>
                </div>
            )}
        </section>
    );
};

// --- VISTA PRINCIPAL ---

const VistaConfiguracion: React.FC = () => {
    const MAX_PROGRAMAS_EXTRA = 10;
    const {
        usuarios, localConfigClub, localConfigNotificaciones, cargando, error,
        cargandoAccion, handleConfigChange, guardarConfiguracionesHandler,
        guardarConfiguraciones,
        modalUsuarioAbierto, cerrarFormularioUsuario, guardarUsuarioHandler, usuarioEnEdicion,
        modalConfirmacionAbierto, usuarioAEliminar, cerrarConfirmacion, confirmarEliminacion,
        abrirFormularioUsuario, abrirConfirmacionEliminar, setLocalConfigClub, setLocalConfigNotificaciones
    } = useGestionConfiguracion();

    const { programas, eliminarPrograma, agregarPrograma, actualizarPrograma } = useProgramas();
    const { estudiantes } = useEstudiantes();
    const { sedes, sedesVisibles, totalSedesActivas, eliminarSede, agregarSede, actualizarSede } = useSedes();
    const { mostrarNotificacion } = useNotificacion();

    const [activeTab, setActiveTab] = useState<'branding' | 'equipo' | 'sedes' | 'programas' | 'alertas' | 'accesos' | 'licencia'>('branding');
    const [programaEdit, setProgramaEdit] = useState<Partial<Programa> | null>(null);
    const [modalProgramaAbierto, setModalProgramaAbierto] = useState(false);
    const [sedeEdit, setSedeEdit] = useState<Partial<Sede> | null>(null);
    const [modalSedeAbierto, setModalSedeAbierto] = useState(false);
    const [planSeleccionado, setPlanSeleccionado] = useState<string>(localConfigClub?.plan || 'starter');
    const [itemAPagar, setItemAPagar] = useState<{ item: any, tipo: 'addon' | 'plan' } | null>(null);

    const cerrarModalSede = () => {
        setModalSedeAbierto(false);
        setSedeEdit(null);
    };

    const handleGuardarSede = async (datos: any) => {
        try {
            if (sedeEdit?.id) {
                await actualizarSede({ ...sedeEdit, ...datos, id: sedeEdit.id } as Sede);
            } else {
                const { id, ...datosNuevaSede } = datos;
                await agregarSede(datosNuevaSede);
            }
            cerrarModalSede();
            mostrarNotificacion("Sede guardada correctamente.", "success");
        } catch (e) {
            // createSede/updateSede (Cloud Functions) ahora pueden rechazar con un motivo
            // real y específico (límite de plan alcanzado, nombre duplicado) -- mostrar ese
            // mensaje en vez de uno genérico, si está disponible.
            const mensaje = e instanceof Error && e.message ? e.message : "Error al guardar la sede.";
            mostrarNotificacion(mensaje, "error");
        }
    };

    const handleGuardarPrograma = async (datos: any) => {
        try {
            if (datos.id) {
                await actualizarPrograma(datos);
            } else {
                if (programas.length >= MAX_PROGRAMAS_EXTRA) {
                    mostrarNotificacion(`Límite de programas extra alcanzado (${MAX_PROGRAMAS_EXTRA}).`, "warning");
                    return;
                }
                await agregarPrograma(datos);
            }
            setModalProgramaAbierto(false);
            mostrarNotificacion("Programa actualizado en el catálogo.", "success");
        } catch (e) {
            mostrarNotificacion("Error al guardar el programa.", "error");
        }
    };

    const handleExitoPago = (datos: any) => {
        setItemAPagar(null);
        mostrarNotificacion("Solicitud de pago iniciada. Verifica tu correo tras completar la transacción.", "warning");
    };

    // --- LÓGICA DE ONBOARDING ---
    const currentStep = localConfigClub?.onboardingStep || 0;
    const isWizardMode = currentStep < 5;

    const restaurarColores = async () => {
        if (!localConfigClub) return;
        if (window.confirm("¿Deseas restaurar los colores originales?")) {
            const configRestaurada = {
                ...localConfigClub,
                colorPrimario: '#111111',
                colorSecundario: '#0047A0',
                colorAcento: '#CD2E3A'
            };

            try {
                await guardarConfiguraciones(localConfigNotificaciones, configRestaurada);
                setLocalConfigClub(configRestaurada);

                // Forzar actualización visual inmediata
                document.documentElement.style.setProperty('--color-primario', '#111111');
                document.documentElement.style.setProperty('--color-secundario', '#0047A0');
                document.documentElement.style.setProperty('--color-acento', '#CD2E3A');

                mostrarNotificacion("Colores restaurados y guardados.", "success");
            } catch (error) {
                mostrarNotificacion("Error al restaurar colores.", "error");
            }
        }
    };

    const avanzarPaso = async (pasoCompletado: number) => {
        if (!localConfigClub) return;
        const nuevoPaso = pasoCompletado + 1;
        try {
            const nuevaConfig = { ...localConfigClub, onboardingStep: nuevoPaso };
            await guardarConfiguraciones(localConfigNotificaciones, nuevaConfig);

            setLocalConfigClub(nuevaConfig);
            mostrarNotificacion(`¡Paso ${pasoCompletado} completado y guardado!`, "success");
        } catch (error) {
            console.error('[Configuracion] Error al avanzar paso:', error);
            mostrarNotificacion("Error al guardar la configuración. Intenta de nuevo.", "error");
        }
    };

    const reiniciarWizard = async () => {
        if (!localConfigClub) return;
        if (window.confirm("¿Estás SEGURO? Se borrarán los datos institucionales y volverás al paso 1.")) {
            try {
                const nuevaConfig: ConfiguracionClub = {
                    ...localConfigClub,
                    onboardingStep: 1,
                    nombreClub: '',
                    nit: '',
                    representanteLegal: '',
                    direccionClub: '',
                    valorMensualidad: 0,
                    moraPorcentaje: 0,
                    valorMatricula: 0,
                    activarMatriculaAnual: false
                };
                await guardarConfiguraciones(localConfigNotificaciones, nuevaConfig);
                setLocalConfigClub(nuevaConfig);
                mostrarNotificacion("Onboarding reiniciado con éxito.", "success");
            } catch (error) {
                mostrarNotificacion("Error al reiniciar onboarding", "error");
            }
        }
    };

    const pasosWizard = [
        { num: 1, label: 'Institucional', bloqueado: false },
        { num: 2, label: 'Branding', bloqueado: false },
        { num: 3, label: 'Mi Dojang', bloqueado: currentStep < 2 },
        { num: 4, label: 'Equipo', bloqueado: currentStep < 3 },
        { num: 5, label: 'Finalizado', bloqueado: currentStep < 4 }
    ];

    // --- GUARDIA DE IDENTIDAD SAAS ---
    // Si el tenantId es el de plataforma o pendiente, forzamos Loader para evitar flickering
    const esTenantTemporal = localConfigClub?.tenantId === 'PLATFORM_INIT_PENDING' || !localConfigClub?.tenantId;
    if (cargando || esTenantTemporal) return <Loader texto="Sincronizando Consola..." />;

    const inputClasses = "w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl p-3 text-xs font-black text-gray-900 dark:text-white uppercase outline-none focus:ring-2 focus:ring-tkd-blue shadow-inner transition-all";
    // Fix tutor-role-end-to-end (2026-07-14): Tutor y Estudiante son CONSULTORES (solo lectura),
    // no parte del equipo técnico / nómina. No deben figurar en la gestión de personal ni
    // contar contra el cupo del plan (que es de staff). Se filtran de la tabla y del conteo.
    // Existen para autenticarse y leer sus datos, pero se administran desde el directorio de
    // estudiantes (donde se define el tutor), no desde acá.
    const usuariosStaff = usuarios.filter(
        (u) => u.rol !== RolUsuario.Tutor && u.rol !== RolUsuario.Estudiante
    );
    const limiteEquipoTecnico = obtenerLimiteEquipoTecnico(localConfigClub);
    const equipoTecnicoCompleto = limiteEquipoTecnico > 0 && usuariosStaff.length >= limiteEquipoTecnico;

    return (
        <div className="p-4 sm:p-10 space-y-10 animate-fade-in pb-32">
            <header className="flex flex-col md:flex-row gap-8 justify-between items-start md:items-center">
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                        <h1 className="text-4xl font-black text-gray-900 dark:text-white uppercase tracking-tighter leading-none">
                            {isWizardMode ? 'Configuración Inicial' : 'Centro de Control'}
                        </h1>
                        <span className="bg-tkd-red text-white text-[9px] font-black px-2 py-1 rounded-full animate-pulse">
                            V: 1.0.6 - ACTUALIZADO
                        </span>
                    </div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em] mt-2">
                        {isWizardMode ? 'Pasos obligatorios para activar tu plataforma' : 'Gestión Global del Dojang'}
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                    <button
                        onClick={reiniciarWizard}
                        className="px-6 py-3 bg-tkd-red/10 text-tkd-red border border-tkd-red/20 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-tkd-red hover:text-white transition-all shadow-sm active:scale-95"
                    >
                        ⚠️ Reiniciar Todo el Proceso
                    </button>

                    {!isWizardMode && (
                        <button onClick={guardarConfiguracionesHandler} disabled={cargandoAccion} className="bg-tkd-blue text-white px-10 py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl flex items-center gap-3 active:scale-95 transition-all">
                            <IconoGuardar className="w-5 h-5" /> Guardar Cambios
                        </button>
                    )}
                </div>
            </header>

            {isWizardMode && (
                <div className="w-full bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-xl border border-gray-100 dark:border-gray-700 flex justify-between relative overflow-hidden">
                    <div className="absolute top-1/2 left-10 right-10 h-1 bg-gray-200 dark:bg-gray-700 -translate-y-1/2 z-0" />
                    {pasosWizard.map((p) => {
                        const completado = (localConfigClub.onboardingStep || 0) > p.num;
                        const actual = (localConfigClub.onboardingStep || 0) === p.num || ((localConfigClub.onboardingStep || 0) === 0 && p.num === 1);
                        const Bloqueado = p.bloqueado && !actual && !completado;

                        return (
                            <div key={p.num} className="relative z-10 flex flex-col items-center gap-3">
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border-4 transition-all duration-500
                                    ${completado ? 'bg-green-500 border-green-500 text-white' :
                                        actual ? 'bg-tkd-blue border-tkd-blue text-white scale-110 shadow-lg shadow-tkd-blue/30' :
                                            'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-400'}`}>
                                    {completado ? <IconoExitoAnimado className="w-6 h-6" /> :
                                        Bloqueado ? <div className="w-full h-full flex items-center justify-center"><div className="w-3 h-3 bg-gray-400 rounded-full" /></div> :
                                            <span className="font-black text-lg">{p.num}</span>}
                                </div>
                                <span className={`text-[9px] font-black uppercase tracking-widest ${actual ? 'text-tkd-blue' : 'text-gray-400'}`}>
                                    {p.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}

            {!isWizardMode && (
                <div className="bg-white dark:bg-gray-800/50 p-1.5 rounded-[2rem] shadow-soft border border-gray-100 dark:border-white/5 w-full overflow-visible">
                    <div className="flex flex-row flex-wrap gap-1">
                        {[
                            { id: 'branding', label: 'Identidad & Pagos', icon: IconoImagen },
                            { id: 'equipo', label: 'Equipo Técnico', icon: IconoUsuario },
                            { id: 'accesos', label: 'Cuentas Externas', icon: IconoEmail },
                            { id: 'sedes', label: 'Sedes Adicionales', icon: IconoCasa },
                            { id: 'programas', label: 'Programas Extra', icon: IconoProgramasExtra },
                            { id: 'alertas', label: 'Alertas', icon: IconoConfiguracionAlertas },
                            { id: 'licencia', label: 'Licencia', icon: IconoAprobar }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex-shrink-0 flex items-center justify-center gap-3 px-5 py-4 md:px-7 md:py-4 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-tkd-dark text-white shadow-xl scale-[1.01] md:scale-[1.03] z-10' : 'text-gray-400 hover:text-tkd-blue hover:bg-gray-50 dark:hover:bg-white/5'}`}
                            >
                                <tab.icon className={`w-[30px] h-[30px] md:w-6 md:h-6 ${activeTab === tab.id ? 'text-tkd-red' : ''}`} />
                                <span className="inline">{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="min-h-[500px]">
                {(activeTab === 'branding' || (isWizardMode && currentStep <= 2)) && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 animate-fade-in">
                        <section className={`bg-white dark:bg-white/5 p-10 rounded-[3rem] border border-gray-100 dark:border-white/10 space-y-8 ${isWizardMode && currentStep !== 1 && currentStep !== 0 ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                            <div className="flex justify-between items-center">
                                <h3 className="text-xl font-black uppercase tracking-tight text-tkd-blue">1. Información Institucional</h3>
                                {isWizardMode && currentStep <= 1 && (
                                    <span className="bg-red-500 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase">Obligatorio</span>
                                )}
                            </div>

                            <div className="space-y-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-gray-400 block mb-2 ml-1 tracking-widest">Nombre del Club</label>
                                        <input type="text" name="nombreClub" value={localConfigClub.nombreClub} onChange={(e) => handleConfigChange(e as any, setLocalConfigClub)} className={inputClasses} />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-gray-400 block mb-2 ml-1 tracking-widest">NIT / Registro</label>
                                        <input type="text" name="nit" value={localConfigClub.nit} onChange={(e) => handleConfigChange(e as any, setLocalConfigClub)} className={inputClasses} />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-gray-400 block mb-2 ml-1 tracking-widest">Dirección Principal <span className="text-red-500">*</span></label>
                                    <input type="text" name="direccionClub" value={localConfigClub.direccionClub} onChange={(e) => handleConfigChange(e as any, setLocalConfigClub)} className={inputClasses} placeholder="Calle 123... (Obligatorio)" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-gray-400 block mb-2 ml-1 tracking-widest">Representante Legal</label>
                                    <input type="text" name="representanteLegal" value={localConfigClub.representanteLegal} onChange={(e) => handleConfigChange(e as any, setLocalConfigClub)} className={inputClasses} placeholder="Cédula y Nombre Completo" />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-800">
                                        <label className="text-[9px] font-black uppercase text-tkd-blue block mb-2 ml-1 tracking-widest">Valor Mensualidad Base</label>
                                        <input type="number" min="0" name="valorMensualidad" value={localConfigClub.valorMensualidad || ''} onChange={(e) => handleConfigChange(e as any, setLocalConfigClub)} className={inputClasses} placeholder="0" />
                                    </div>
                                    <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-2xl border border-red-100 dark:border-red-800">
                                        <label className="text-[9px] font-black uppercase text-tkd-red block mb-2 ml-1 tracking-widest">Mora Mensual (%)</label>
                                        <input type="number" min="0" name="moraPorcentaje" value={localConfigClub.moraPorcentaje || ''} onChange={(e) => handleConfigChange(e as any, setLocalConfigClub)} className={inputClasses} placeholder="0" />
                                    </div>
                                </div>
                                <div className="p-6 bg-sky-50 dark:bg-sky-900/10 rounded-3xl border border-sky-100 dark:border-sky-800/20 space-y-3">
                                    <label className="text-[10px] font-black uppercase text-sky-700 dark:text-sky-400 tracking-widest">Link de Pago en Línea (Opcional)</label>
                                    <input
                                        type="text"
                                        name="linkPagoMensualidad"
                                        value={localConfigClub.linkPagoMensualidad || ''}
                                        onChange={(e) => handleConfigChange(e as any, setLocalConfigClub)}
                                        className={inputClasses}
                                        placeholder="https://checkout.wompi.co/l/..."
                                    />
                                    <p className="text-[9px] text-gray-400 font-bold italic">
                                        Pegá acá el link de pago de tu cuenta en Wompi, PayU o ePayco para que tus alumnos puedan pagar en línea. Tudojang no gestiona ni recibe este dinero — ver Términos de Servicio.
                                    </p>
                                </div>
                                <div className="p-6 bg-amber-50 dark:bg-amber-900/10 rounded-3xl border border-amber-100 dark:border-amber-800/20 space-y-4">
                                    <label className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-400 tracking-widest">Otros Medios de Recaudo (Opcional)</label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[9px] font-black uppercase text-gray-400 block mb-2 ml-1">Número Nequi</label>
                                            <input type="text" name="pagoNequi" value={localConfigClub.pagoNequi || ''} onChange={(e) => handleConfigChange(e as any, setLocalConfigClub)} className={inputClasses} />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-black uppercase text-gray-400 block mb-2 ml-1">Número Daviplata</label>
                                            <input type="text" name="pagoDaviplata" value={localConfigClub.pagoDaviplata || ''} onChange={(e) => handleConfigChange(e as any, setLocalConfigClub)} className={inputClasses} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black uppercase text-gray-400 block mb-2 ml-1">Llave BRE-B</label>
                                        <input type="text" name="pagoBreB" value={localConfigClub.pagoBreB || ''} onChange={(e) => handleConfigChange(e as any, setLocalConfigClub)} className={inputClasses} placeholder="Email, Celular o ID..." />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black uppercase text-gray-400 block mb-2 ml-1">Detalles Cuenta Bancaria</label>
                                        <input type="text" name="pagoBanco" value={localConfigClub.pagoBanco || ''} onChange={(e) => handleConfigChange(e as any, setLocalConfigClub)} className={inputClasses} placeholder="Banco, tipo y número de cuenta..." />
                                    </div>
                                    <p className="text-[9px] text-gray-400 font-bold italic">
                                        Estos datos se muestran a tus alumnos y acudientes en el portal de inscripción y en el reporte de pago, y se incluyen en los recordatorios automáticos de mora.
                                    </p>
                                </div>
                                <div className="p-6 bg-green-50 dark:bg-green-900/10 rounded-3xl border border-green-100 dark:border-green-800/20 space-y-4">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[10px] font-black uppercase text-green-700 dark:text-green-400 tracking-widest">Valor Matrícula / Formulario</label>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] font-black uppercase text-gray-400">¿Cobro Anual?</span>
                                            <input type="checkbox" name="activarMatriculaAnual" checked={localConfigClub.activarMatriculaAnual} onChange={(e) => handleConfigChange(e as any, setLocalConfigClub)} className="w-5 h-5 accent-tkd-blue" />
                                        </div>
                                    </div>
                                    <input type="number" min="0" name="valorMatricula" value={localConfigClub.valorMatricula || ''} onChange={(e) => handleConfigChange(e as any, setLocalConfigClub)} className={inputClasses} placeholder="$40.000 sugerido" />
                                    <p className="text-[9px] text-gray-400 uppercase font-bold italic">Este valor se sugerirá en el registro de cada alumno nuevo.</p>
                                </div>

                                <div className="p-6 bg-purple-50 dark:bg-purple-900/10 rounded-3xl border border-purple-100 dark:border-purple-800/20 flex items-center justify-between">
                                    <div className="space-y-1">
                                        <h4 className="text-xs font-black uppercase text-purple-900 dark:text-purple-300">Formulario de Inscripción</h4>
                                        <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Activar/Desactivar portal público</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            name="activarFormularioInscripcion"
                                            checked={localConfigClub.activarFormularioInscripcion !== false}
                                            onChange={(e) => handleConfigChange({ target: { name: 'activarFormularioInscripcion', value: e.target.checked, type: 'checkbox' } } as any, setLocalConfigClub)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                                    </label>
                                </div>
                            </div>
                            {isWizardMode && currentStep <= 1 && (
                                <button
                                    onClick={async () => {
                                        if (!localConfigClub.direccionClub || !localConfigClub.nombreClub) {
                                            mostrarNotificacion("Diligencia los campos obligatorios", "error");
                                            return;
                                        }
                                        try {
                                            await guardarConfiguraciones(localConfigNotificaciones, localConfigClub);
                                            await avanzarPaso(1);
                                        } catch (error) {
                                            mostrarNotificacion("Error al guardar datos institucionales", "error");
                                        }
                                    }}
                                    className="w-full py-4 bg-tkd-blue text-white rounded-xl font-black uppercase text-xs shadow-lg hover:bg-blue-800 transition-all"
                                >
                                    Guardar y Continuar a Branding
                                </button>
                            )}
                        </section>

                        <section className={`bg-white dark:bg-white/5 p-10 rounded-[3rem] border border-gray-100 dark:border-white/10 space-y-8 ${isWizardMode && currentStep !== 2 && currentStep !== 5 ? 'opacity-50 pointer-events-none' : ''}`}>
                            <div className="flex justify-between items-center">
                                <h3 className="text-xl font-black uppercase tracking-tight text-tkd-blue">2. Look & Feel</h3>
                                {isWizardMode && currentStep === 2 && (
                                    <button onClick={restaurarColores} className="text-[9px] font-black uppercase text-gray-400 hover:text-tkd-red underline">Restaurar Originales</button>
                                )}
                            </div>

                            <div className="space-y-6">
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="text-[9px] font-black uppercase text-gray-400 block mb-2 tracking-widest">Primario</label>
                                        <div className="flex items-center gap-2">
                                            <input type="color" name="colorPrimario" value={localConfigClub.colorPrimario} onChange={(e) => handleConfigChange(e as any, setLocalConfigClub)} className="w-10 h-10 rounded-full border-none cursor-pointer" />
                                            <span className="text-[9px] font-mono">{localConfigClub.colorPrimario}</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black uppercase text-gray-400 block mb-2 tracking-widest">Secundario</label>
                                        <div className="flex items-center gap-2">
                                            <input type="color" name="colorSecundario" value={localConfigClub.colorSecundario} onChange={(e) => handleConfigChange(e as any, setLocalConfigClub)} className="w-10 h-10 rounded-full border-none cursor-pointer" />
                                            <span className="text-[9px] font-mono">{localConfigClub.colorSecundario}</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black uppercase text-gray-400 block mb-2 tracking-widest">Acento</label>
                                        <div className="flex items-center gap-2">
                                            <input type="color" name="colorAcento" value={localConfigClub.colorAcento} onChange={(e) => handleConfigChange(e as any, setLocalConfigClub)} className="w-10 h-10 rounded-full border-none cursor-pointer" />
                                            <span className="text-[9px] font-mono">{localConfigClub.colorAcento}</span>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-[9px] text-gray-400">Estos colores se aplicarán globalmente en carnets, documentos y UI.</p>
                            </div>

                            <div className="flex flex-col items-center justify-center border-4 border-dashed border-gray-100 dark:border-white/5 rounded-[3rem] p-8 text-center space-y-4">
                                <div className="w-32 h-32 bg-gray-50 dark:bg-black/20 rounded-full flex items-center justify-center overflow-hidden border-4 border-white dark:border-gray-800 shadow-xl group relative">
                                    {localConfigClub.logoUrl ? <img src={localConfigClub.logoUrl} className="w-full h-full object-contain" /> : <IconoLogoOficial className="w-16 h-16 opacity-20" />}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <IconoImagen className="w-8 h-8 text-white" />
                                    </div>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                const reader = new FileReader();
                                                reader.onload = async (ev) => {
                                                    try {
                                                        const base64 = ev.target?.result as string;
                                                        const optimizada = await optimizarImagenBase64(base64);
                                                        setLocalConfigClub(prev => prev ? { ...prev, logoUrl: optimizada } : null);
                                                        mostrarNotificacion("Logotipo optimizado.", "success");
                                                    } catch (error) {
                                                        mostrarNotificacion("Error al procesar la imagen.", "error");
                                                    }
                                                };
                                                reader.readAsDataURL(file);
                                            }
                                        }}
                                    />
                                </div>
                                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Click en el círculo para subir logo</p>
                                {localConfigClub.logoUrl && (
                                    <button
                                        onClick={async () => {
                                            const configSinLogo = { ...localConfigClub, logoUrl: '' };
                                            try {
                                                await guardarConfiguraciones(localConfigNotificaciones, configSinLogo);
                                                setLocalConfigClub(configSinLogo);
                                                mostrarNotificacion("Logo removido.", "success");
                                            } catch (error) {
                                                mostrarNotificacion("Error al remover logo", "error");
                                            }
                                        }}
                                        className="text-[9px] font-black uppercase text-tkd-red hover:underline py-2 px-4 bg-tkd-red/5 rounded-full transition-all active:scale-95"
                                    >
                                        Remover Logo Personalizado
                                    </button>
                                )}
                            </div>

                            {isWizardMode && currentStep <= 2 && (
                                <button
                                    onClick={async () => {
                                        try {
                                            await guardarConfiguraciones(localConfigNotificaciones, localConfigClub);
                                            await avanzarPaso(2);
                                        } catch (error) {
                                            mostrarNotificacion("Error al guardar branding", "error");
                                        }
                                    }}
                                    className="w-full py-4 bg-tkd-blue text-white rounded-xl font-black uppercase text-xs shadow-lg hover:bg-blue-800 transition-all mt-4"
                                >
                                    Guardar Branding y Continuar
                                </button>
                            )}
                        </section>
                    </div>
                )}

                {(activeTab === 'sedes' || (isWizardMode && currentStep === 3)) && (
                    <div className="space-y-10 animate-fade-in">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-black uppercase tracking-tight text-tkd-blue">3. Mi Dojang y Sedes Adicionales</h3>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Base operativa principal + sucursales registradas</p>
                            </div>
                            <button onClick={() => {
                                const sedesAdicionalesActuales = totalSedesActivas - 1;
                                const effectiveLimit = obtenerLimiteOperativo(localConfigClub, 'limiteSedes');
                                const limiteSedesAdicionales = effectiveLimit - 1;

                                if (sedesAdicionalesActuales >= limiteSedesAdicionales) {
                                    mostrarNotificacion(`Límite de Sedes Adicionales alcanzado (${limiteSedesAdicionales}). Amplía tu plan para agregar más sucursales.`, "warning");
                                    return;
                                }
                                setSedeEdit(null);
                                setModalSedeAbierto(true);
                            }} className="bg-tkd-blue text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg flex items-center gap-2 active:scale-95 transition-all">
                                <IconoAgregar className="w-4 h-4" /> Agregar Sede Adicional
                            </button>
                        </div>

                        {/* ── BLOQUE 1: MI DOJANG (Base Operativa) ── */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-tkd-blue bg-tkd-blue/10 px-3 py-1.5 rounded-full">Base Operativa</span>
                                <div className="flex-1 h-px bg-tkd-blue/10" />
                            </div>
                            <div className="tkd-card p-8 space-y-6 border-2 border-tkd-blue/30 bg-gradient-to-br from-tkd-blue/5 to-transparent max-w-lg">
                                <div className="flex justify-between items-start">
                                    <div className="p-3 bg-tkd-blue/10 rounded-2xl"><IconoCasa className="w-6 h-6 text-tkd-blue" /></div>
                                    <span className="text-[8px] font-black uppercase tracking-widest text-tkd-blue bg-tkd-blue/10 px-3 py-1 rounded-full">Mi Dojang</span>
                                </div>
                                <div>
                                    <h4 className="text-lg font-black text-gray-900 dark:text-white uppercase">{localConfigClub.nombreClub || 'Mi Dojang'}</h4>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{localConfigClub.direccionClub || 'Sin dirección configurada'}</p>
                                </div>
                                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-t border-gray-100 dark:border-white/10 pt-4">
                                    📍 Configurable en &ldquo;Información Institucional&rdquo;
                                </div>
                            </div>
                        </div>

                        {/* ── BLOQUE 2: SEDES ADICIONALES ── */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500 bg-gray-100 dark:bg-white/5 px-3 py-1.5 rounded-full">Sedes Adicionales</span>
                                <div className="flex-1 h-px bg-gray-200 dark:bg-white/10" />
                            </div>
                            {/* Filtro anti-duplicado: usamos sedesVisibles y excluimos la 'principal' */}
                            {(() => {
                                const sedesAdicionales = sedesVisibles.filter(s => s.id !== 'principal');
                                return sedesAdicionales.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 px-8 rounded-[2.5rem] border-2 border-dashed border-gray-200 dark:border-white/10 text-center space-y-3">
                                        <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-2xl">
                                            <IconoCasa className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                                        </div>
                                        <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Sin sedes adicionales registradas</p>
                                        <p className="text-[9px] text-gray-300 dark:text-gray-600 uppercase font-bold">Usa el botón &ldquo;Agregar Sede Adicional&rdquo; para registrar sucursales</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                        {sedesAdicionales.map(s => (
                                            <div key={s.id} className="tkd-card p-8 space-y-6">
                                                <div className="flex justify-between items-start">
                                                    <div className="p-3 bg-gray-100 dark:bg-white/5 rounded-2xl"><IconoCasa className="w-6 h-6 text-gray-500" /></div>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => { setSedeEdit(s); setModalSedeAbierto(true); }} className="p-2 text-gray-400 hover:text-tkd-blue transition-colors"><IconoEditar className="w-4 h-4" /></button>
                                                        <button onClick={async () => {
                                                            if (window.confirm(`¿Seguro de eliminar la sede ${s.nombre}?`)) {
                                                                try {
                                                                    await eliminarSede(s.id!);
                                                                    mostrarNotificacion("Sede eliminada.", "success");
                                                                } catch (e) {
                                                                    const mensaje = e instanceof Error && e.message ? e.message : "Error al eliminar la sede.";
                                                                    mostrarNotificacion(mensaje, "error");
                                                                }
                                                            }
                                                        }} className="p-2 text-gray-400 hover:text-tkd-red transition-colors"><IconoEliminar className="w-4 h-4" /></button>
                                                    </div>
                                                </div>
                                                <div>
                                                    <h4 className="font-black uppercase text-lg leading-tight dark:text-white">{s.nombre}</h4>
                                                    <p className="text-[10px] font-black text-gray-400 uppercase mt-1">{s.ciudad} • {s.direccion}</p>
                                                </div>
                                                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                                    {s.telefono && `📞 ${s.telefono}`}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                        </div>

                        {isWizardMode && currentStep === 3 && (
                            <button onClick={() => avanzarPaso(3)} className="w-full py-4 bg-tkd-blue text-white rounded-xl font-black uppercase text-xs shadow-lg mt-4">Mi Dojang Confirmado — Continuar</button>
                        )}
                    </div>
                )}

                {(activeTab === 'equipo' || (isWizardMode && currentStep === 4)) && (
                    <div className="space-y-8 animate-fade-in">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-black uppercase tracking-tight text-tkd-blue">4. Nómina Inicial</h3>
                            <button
                                onClick={() => abrirFormularioUsuario()}
                                disabled={equipoTecnicoCompleto}
                                title={equipoTecnicoCompleto ? `Límite alcanzado: ${usuariosStaff.length} de ${limiteEquipoTecnico}` : undefined}
                                className="bg-tkd-blue disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg flex items-center gap-2 active:scale-95 transition-all"
                            >
                                <IconoAgregar className="w-4 h-4" /> Vincular Instructor
                            </button>
                        </div>
                        <div className="tkd-card p-0">
                            <TablaUsuarios usuarios={usuariosStaff} onEditar={abrirFormularioUsuario} onEliminar={abrirConfirmacionEliminar} onGestionarContrato={() => { }} />
                        </div>
                        {isWizardMode && currentStep === 4 && (
                            <button
                                onClick={async () => {
                                    await avanzarPaso(4);
                                    window.location.hash = '/';
                                    window.location.reload();
                                }}
                                className="w-full py-6 bg-green-500 text-white rounded-xl font-black uppercase text-sm shadow-xl mt-8"
                            >
                                Finalizar Configuración y Entrar
                            </button>
                        )}
                    </div>
                )}

                {!isWizardMode && activeTab === 'programas' && (
                    <div className="space-y-8 animate-fade-in">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-black uppercase tracking-tight text-tkd-blue">Catálogo de Programas Extra</h3>
                            <button onClick={() => {
                                if (programas.length >= MAX_PROGRAMAS_EXTRA) {
                                    mostrarNotificacion(`Límite de programas extra alcanzado (${MAX_PROGRAMAS_EXTRA}).`, "warning");
                                    return;
                                }
                                setProgramaEdit(null);
                                setModalProgramaAbierto(true);
                            }} disabled={programas.length >= MAX_PROGRAMAS_EXTRA} className="bg-tkd-blue disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg flex items-center gap-2 active:scale-95 transition-all">
                                <IconoAgregar className="w-4 h-4" /> Crear Modalidad
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {programas.map(p => (
                                <div key={p.id} className="tkd-card p-8 space-y-6">
                                    <div className="flex justify-between items-start">
                                        <div className="p-3 bg-tkd-red/10 rounded-2xl"><IconoLogoOficial className="w-6 h-6 text-tkd-red" /></div>
                                        <div className="flex gap-2">
                                            <button onClick={() => { setProgramaEdit(p); setModalProgramaAbierto(true); }} className="p-2 text-gray-400 hover:text-tkd-blue"><IconoEditar className="w-4 h-4" /></button>
                                            <button onClick={() => { if (window.confirm("¿Seguro?")) eliminarPrograma(p.id); }} className="p-2 text-gray-400 hover:text-tkd-red"><IconoEliminar className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                    <h4 className="font-black uppercase text-lg leading-tight">{p.nombre}</h4>
                                    <p className="text-sm font-black text-gray-900 dark:text-white">+{formatearPrecio(p.valor)}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {!isWizardMode && activeTab === 'alertas' && (
                    <div className="max-w-4xl space-y-8 animate-fade-in">
                        <section className="bg-white dark:bg-white/5 p-10 rounded-[3rem] border border-gray-100 dark:border-white/10 space-y-10">
                            <div className="flex items-center gap-4">
                                <IconoConfiguracionAlertas className="w-10 h-10 text-tkd-blue" />
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

                {!isWizardMode && activeTab === 'accesos' && (
                    <div className="space-y-8 animate-fade-in">
                        <section className="bg-white dark:bg-white/5 p-8 rounded-[3rem] border border-gray-100 dark:border-white/10 space-y-6">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.35em] text-tkd-red mb-2">Perfiles externos</p>
                                <h3 className="text-2xl font-black uppercase tracking-tight text-tkd-dark dark:text-white">Configuración de login externo</h3>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-2 max-w-3xl">
                                    Controla el acceso de alumnos y tutores que no trabajan dentro del club. Las invitaciones también se pueden enviar desde el registro o edición de cada estudiante.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {[
                                    {
                                        key: 'loginEstudiantesActivo',
                                        title: 'Activar cuentas externas',
                                        description: 'Permite crear login para alumnos y tutores.'
                                    },
                                    {
                                        key: 'invitarEstudianteAlCrear',
                                        title: 'Invitar estudiante al crear',
                                        description: 'Marca por defecto el envío al correo del alumno.'
                                    },
                                    {
                                        key: 'invitarTutorAlCrear',
                                        title: 'Invitar tutor al crear',
                                        description: 'Marca por defecto el envío al acudiente cuando exista correo.'
                                    }
                                ].map((item) => {
                                    const cuentasExternas = localConfigClub.configuracionCuentasExternas || {};
                                    const checked = !!cuentasExternas[item.key as keyof typeof cuentasExternas];

                                    return (
                                        <label key={item.key} className={`p-5 rounded-3xl border-2 cursor-pointer transition-all ${checked ? 'border-tkd-blue bg-tkd-blue/5' : 'border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-white/5'}`}>
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <h4 className="text-xs font-black uppercase text-gray-900 dark:text-white">{item.title}</h4>
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-2 leading-relaxed">{item.description}</p>
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={(e) => {
                                                        setLocalConfigClub(prev => prev ? {
                                                            ...prev,
                                                            configuracionCuentasExternas: {
                                                                ...(prev.configuracionCuentasExternas || {}),
                                                                [item.key]: e.target.checked
                                                            }
                                                        } : prev);
                                                    }}
                                                    className="w-5 h-5 accent-tkd-blue shrink-0"
                                                />
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>

                            <button
                                type="button"
                                onClick={() => guardarConfiguracionesHandler()}
                                className="bg-tkd-blue text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all"
                            >
                                Guardar configuración de cuentas
                            </button>
                        </section>

                        <InvitacionesView />
                        <VinculosView />
                    </div>
                )}

                {!isWizardMode && activeTab === 'licencia' && (
                    <div className="space-y-10 animate-fade-in">
                        <div className="bg-tkd-dark text-white p-10 rounded-[3rem] shadow-2xl flex flex-col md:flex-row justify-between items-center gap-8 border border-white/5 relative overflow-hidden">
                            <div className="relative z-10">
                                <p className="text-[10px] font-black text-tkd-red uppercase tracking-[0.4em] mb-2">Estado de Suscripción</p>
                                <h3 className="text-4xl font-black uppercase tracking-tighter">Plan <span className="text-tkd-blue">{localConfigClub.plan}</span></h3>
                                <p className="text-gray-400 text-xs mt-4 font-bold uppercase tracking-widest">Vence el: {localConfigClub.fechaVencimiento}</p>
                            </div>
                            <div className="flex gap-4 relative z-10">
                                <button onClick={() => {
                                    const el = document.getElementById('grid-planes-saas');
                                    el?.scrollIntoView({ behavior: 'smooth' });
                                }} className="bg-white text-tkd-dark px-10 py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-gray-100 transition-all active:scale-95">Renovar o Mejorar Licencia</button>
                            </div>
                            <div className="absolute -right-20 -bottom-20 opacity-5 rotate-12"><IconoLogoOficial className="w-80 h-80" /></div>
                        </div>

                        <SeccionCobroAutomatico
                            tenant={localConfigClub}
                            onActivado={() => {
                                setLocalConfigClub(prev => prev ? {
                                    ...prev,
                                    cobroAutomaticoActivo: true,
                                    cobroAutomaticoIntentosFallidos: 0,
                                } : prev);
                            }}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[
                                {
                                    label: 'Estudiantes',
                                    used: estudiantes.length,
                                    limit: obtenerLimiteOperativo(localConfigClub, 'limiteEstudiantes'),
                                    icon: IconoEstudiantes,
                                    color: 'text-tkd-blue'
                                },
                                {
                                    label: 'Docentes / Staff',
                                    used: usuariosStaff.length,
                                    limit: obtenerLimiteEquipoTecnico(localConfigClub),
                                    icon: IconoUsuario,
                                    color: 'text-green-500'
                                },
                                {
                                    label: 'Sedes (Principal + Adicionales)',
                                    used: totalSedesActivas,
                                    limit: obtenerLimiteOperativo(localConfigClub, 'limiteSedes'),
                                    icon: IconoCasa,
                                    color: 'text-tkd-red'
                                }
                            ].map((metric) => {
                                const percent = Math.min((metric.used / metric.limit) * 100, 100);
                                return (
                                    <div key={metric.label} className="bg-white dark:bg-white/5 p-6 rounded-[2.5rem] border border-gray-100 dark:border-white/10 space-y-4">
                                        <div className="flex justify-between items-start">
                                            <div className={`p-3 rounded-2xl bg-gray-50 dark:bg-white/5 ${metric.color}`}><metric.icon className="w-5 h-5" /></div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{metric.label}</span>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-end">
                                                <span className="text-2xl font-black dark:text-white leading-none">{metric.used} <span className="text-xs text-gray-400 font-bold lowercase">de</span> {metric.limit}</span>
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">{Math.round(percent)}%</span>
                                            </div>
                                            <div className="w-full h-2 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                                                <div className={`h-full transition-all duration-1000 ${percent > 90 ? 'bg-tkd-red' : percent > 70 ? 'bg-orange-500' : 'bg-tkd-blue'}`} style={{ width: `${percent}%` }} />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div id="grid-planes-saas" className="space-y-10">
                            <div className="text-center space-y-3">
                                <h4 className="text-3xl font-black uppercase tracking-tight dark:text-white">Membresías del Ecosistema</h4>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-100 dark:bg-white/5 px-4 py-1 rounded-full inline-block">
                                    Cobro recurrente mensual automático vía Wompi
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                {Object.values(PLANES_SAAS).map(plan => {
                                    const esPlanActual = localConfigClub.plan === plan.id;
                                    const esSeleccionado = planSeleccionado === plan.id;
                                    const orden = { starter: 1, growth: 2, pro: 3 };
                                    const actualOrden = (orden as any)[localConfigClub.plan || 'starter'] || 1;
                                    const planOrden = (orden as any)[plan.id] || 1;
                                    const esUpgrade = planOrden > actualOrden;

                                    return (
                                        <div
                                            key={plan.id}
                                            onClick={() => setPlanSeleccionado(plan.id)}
                                            className={`group cursor-pointer p-8 rounded-[3.5rem] border-4 transition-all duration-500 relative flex flex-col justify-between
                                                ${esSeleccionado
                                                    ? 'border-tkd-blue bg-white dark:bg-gray-800 shadow-[0_30px_60px_-15px_rgba(31,62,144,0.3)] scale-105 z-10'
                                                    : esUpgrade
                                                        ? 'border-tkd-red/20 opacity-90 hover:border-tkd-red/40 hover:opacity-100 bg-gray-50/50 dark:bg-white/5'
                                                        : 'border-transparent bg-gray-50/30 dark:bg-white/5 opacity-50 hover:opacity-100'
                                                }`}
                                        >
                                            {esUpgrade && (
                                                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-tkd-red text-white px-5 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-full shadow-lg z-20 animate-bounce">
                                                    Upgrade Recomendado
                                                </div>
                                            )}

                                            {esPlanActual && !esUpgrade && (
                                                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-tkd-blue text-white px-5 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-full shadow-lg z-20">
                                                    Plan Actual
                                                </div>
                                            )}

                                            <div className="space-y-6">
                                                <div className="flex justify-between items-start">
                                                    <h5 className={`text-xl font-black uppercase tracking-tighter ${esSeleccionado ? 'text-tkd-blue' : 'text-gray-400'}`}>
                                                        {plan.nombre}
                                                    </h5>
                                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${esSeleccionado ? 'border-tkd-blue bg-tkd-blue' : 'border-gray-200'}`}>
                                                        {esSeleccionado && <div className="w-2 h-2 bg-white rounded-full" />}
                                                    </div>
                                                </div>

                                                <div className="space-y-3">
                                                    <p className="text-3xl font-black dark:text-white flex items-start gap-1">
                                                        <span className="text-sm mt-1">$</span>
                                                        {formatearPrecio(plan.precio).replace('$', '')}
                                                        <span className="text-[10px] text-gray-400 uppercase self-end mb-1">/ mes</span>
                                                    </p>
                                                    <ul className="space-y-3">
                                                        {plan.caracteristicas.map(c => (
                                                            <li key={c} className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
                                                                <div className={`w-1.5 h-1.5 rounded-full ${esSeleccionado ? 'bg-tkd-blue' : 'bg-gray-300'}`} />
                                                                {c}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="flex justify-center pt-8">
                                <button
                                    onClick={() => {
                                        const p = (PLANES_SAAS as any)[planSeleccionado];
                                        if (p) setItemAPagar({ item: p, tipo: 'plan' });
                                    }}
                                    className="group bg-tkd-red text-white px-12 py-6 rounded-[2rem] font-black uppercase text-sm tracking-[0.2em] shadow-[0_20px_50px_-10px_rgba(205,46,58,0.5)] hover:scale-105 active:scale-95 transition-all flex items-center gap-4"
                                >
                                    <IconoAprobar className="w-6 h-6" />
                                    {planSeleccionado === localConfigClub.plan ? 'Renovar Membresía Actual' : 'Cambiar a este Plan Premium'}
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {Object.values(COSTOS_ADICIONALES).map(addon => (
                                <div key={addon.key} className="bg-white dark:bg-white/5 p-8 rounded-[2.5rem] border border-gray-100 dark:border-white/10 flex flex-col justify-between hover:shadow-premium transition-all">
                                    <h4 className="text-xl font-black uppercase tracking-tight dark:text-white">{addon.label}</h4>
                                    <p className="text-sm font-black text-gray-900 dark:text-gray-400 mt-4">{formatearPrecio(addon.precio)} <span className="text-[9px] opacity-40">Pago mensual</span></p>
                                    <button onClick={() => setItemAPagar({ item: addon, tipo: 'addon' })} className="mt-8 w-full py-4 bg-gray-50 dark:bg-gray-800 rounded-xl font-black uppercase text-[9px] tracking-widest text-gray-500 hover:bg-tkd-blue hover:text-white transition-all active:scale-95 shadow-sm">Adquirir Capacidad</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {modalUsuarioAbierto && <FormularioUsuario abierto={modalUsuarioAbierto} onCerrar={cerrarFormularioUsuario} onGuardar={guardarUsuarioHandler} usuarioActual={usuarioEnEdicion} cargando={cargandoAccion} />}
            {modalConfirmacionAbierto && usuarioAEliminar && <ModalConfirmacion abierto={modalConfirmacionAbierto} titulo="Eliminar Usuario" mensaje={`¿Confirmas la eliminación definitiva de ${usuarioAEliminar.nombreUsuario}?`} onCerrar={cerrarConfirmacion} onConfirmar={confirmarEliminacion} cargando={cargandoAccion} />}
            {modalProgramaAbierto && <ModalFormPrograma programa={programaEdit} onCerrar={() => setModalProgramaAbierto(false)} onGuardar={handleGuardarPrograma} />}
            {modalSedeAbierto && <FormularioSede abierto={modalSedeAbierto} onCerrar={cerrarModalSede} onGuardar={handleGuardarSede} sedeActual={sedeEdit} cargando={cargandoAccion} />}
            {itemAPagar && <ModalPagoCheckout item={itemAPagar.item} tipo={itemAPagar.tipo} tenantId={localConfigClub.tenantId} onCerrar={() => setItemAPagar(null)} onExito={handleExitoPago} />}
        </div>
    );
};

export default VistaConfiguracion;
