
// vistas/Configuracion.tsx
import React, { useState } from 'react';
import { Usuario, TipoVinculacionColaborador, RolUsuario, Programa, TipoCobroPrograma, Sede } from '../tipos';
import { generarUrlAbsoluta, formatearPrecio } from '../utils/formatters';
import { IconoCerrar, IconoContrato, IconoWhatsApp, IconoCopiar, IconoAprobar, IconoAgregar, IconoImagen, IconoCampana, IconoUsuario, IconoGuardar, IconoLogoOficial, IconoInformacion, IconoEditar, IconoEliminar, IconoCasa, IconoEstudiantes, IconoEnviar, IconoExitoAnimado, IconoHistorial, IconoEmail } from '../components/Iconos';
import { useGestionConfiguracion } from '../hooks/useGestionConfiguracion';
import { useNotificacion } from '../context/NotificacionContext';
import { useProgramas, useEstudiantes, useSedes } from '../context/DataContext';
import { actualizarUsuario } from '../servicios/api';
import { actualizarCapacidadClub, actualizarPlanClub } from '../servicios/configuracionApi';
import { COSTOS_ADICIONALES, PLANES_SAAS } from '../constantes';
import TablaUsuarios from '../components/TablaUsuarios';
import FormularioUsuario from '../components/FormularioUsuario';
import FormularioSede from '../components/FormularioSede';
import ModalConfirmacion from '../components/ModalConfirmacion';
import GestionNotificacionesPush from '../components/GestionNotificacionesPush';
import Loader from '../components/Loader';

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
                                <option value={TipoCobroPrograma.Recurrente}>MembresÍA</option>
                                <option value={TipoCobroPrograma.Unico}>Taller Corto</option>
                            </select>
                            <div className="absolute right-4 bottom-4 pointer-events-none text-gray-400">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"/></svg>
                            </div>
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
            await new Promise(r => setTimeout(r, 2500));
            
            if (tipo === 'addon') {
                const mapeoCampos: Record<string, any> = {
                    'estudiantes': 'limiteEstudiantes',
                    'instructor': 'limiteUsuarios',
                    'sede': 'limiteSedes'
                };
                const campoAIncrementar = mapeoCampos[item.key];
                await actualizarCapacidadClub(tenantId, campoAIncrementar, item.cantidad);
                onExito({ tipo: 'addon', [campoAIncrementar]: item.cantidad });
            } else {
                await actualizarPlanClub(tenantId, item);
                onExito({ tipo: 'plan', plan: item });
            }
            
            setPaso('exito');
        } catch (error) {
            mostrarNotificacion("La transacción fue rechazada por el banco.", "error");
            setPaso('checkout');
        }
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-tkd-dark/90 p-4 animate-fade-in backdrop-blur-sm">
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
                                <span className="text-[10px] font-black uppercase text-gray-400">Valor {tipo === 'plan' ? 'Mes' : 'Adicional'}</span>
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
                        <div className="space-y-2">
                            <h3 className="text-xl font-black uppercase dark:text-white">Procesando Pago</h3>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Sincronizando con red bancaria...</p>
                        </div>
                    </div>
                )}

                {paso === 'exito' && (
                    <div className="text-center py-8 space-y-6 animate-fade-in">
                        <IconoExitoAnimado className="mx-auto text-green-500" />
                        <div className="space-y-2">
                            <h3 className="text-3xl font-black uppercase text-green-600 tracking-tighter">¡Listo!</h3>
                            <p className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase leading-relaxed">
                                Tu licencia ha sido actualizada <br/> exitosamente por el sistema.
                            </p>
                        </div>
                        <button onClick={onCerrar} className="bg-tkd-blue text-white px-8 py-3 rounded-xl font-black uppercase text-xs">Regresar al Panel</button>
                    </div>
                )}
            </div>
        </div>
    );
};

const ModalGenerarContrato: React.FC<{ usuario: Usuario, sedes: Sede[], onCerrar: () => void, onGenerar: (datos: any) => void }> = ({ usuario, sedes, onCerrar, onGenerar }) => {
    const [monto, setMonto] = useState(usuario.contrato?.valorPago || 0);
    const [modalidad, setModalidad] = useState(usuario.contrato?.tipoVinculacion || TipoVinculacionColaborador.Mes);
    const [modalidadOtro, setModalidadOtro] = useState(usuario.contrato?.tipoVinculacionOtro || '');
    const [fechaInicio, setFechaInicio] = useState(usuario.contrato?.fechaInicio || new Date().toISOString().split('T')[0]);
    const [lugar, setLugar] = useState(usuario.contrato?.lugarEjecucion || "");
    
    const inputStyle = "w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl p-3 text-xs font-black text-gray-900 dark:text-white uppercase outline-none focus:ring-2 focus:ring-tkd-blue shadow-inner transition-all";

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-tkd-dark/95 p-4 animate-fade-in backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-900 rounded-[3rem] shadow-2xl w-full max-w-md p-10 space-y-8 relative overflow-hidden border border-gray-100 dark:border-white/5">
                <div className="text-center">
                    <h3 className="text-2xl font-black uppercase tracking-tight dark:text-white">Vínculo Técnico</h3>
                    <p className="text-[10px] font-black text-tkd-blue uppercase tracking-[0.2em] mt-2">Configuración Legal para {usuario.rol}</p>
                </div>

                <div className="space-y-5">
                    <div>
                        <label className="text-[9px] font-black uppercase text-gray-400 mb-1 ml-1 block tracking-widest">Valor Pactado Pago (COP)</label>
                        <input type="number" value={monto} onChange={e => setMonto(Number(e.target.value))} className={inputStyle} placeholder="$ 0.00" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="relative">
                            <label className="text-[9px] font-black uppercase text-gray-400 mb-1 ml-1 block tracking-widest">Modalidad</label>
                            <select value={modalidad} onChange={e => setModalidad(e.target.value as any)} className={`${inputStyle} appearance-none cursor-pointer`}>
                                {Object.values(TipoVinculacionColaborador).map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                            <div className="absolute right-3 bottom-3 pointer-events-none text-gray-400"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"/></svg></div>
                        </div>
                        <div>
                            <label className="text-[9px] font-black uppercase text-gray-400 mb-1 ml-1 block tracking-widest">Fecha de Inicio</label>
                            <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className={inputStyle} />
                        </div>
                    </div>

                    {modalidad === TipoVinculacionColaborador.Otro && (
                        <div className="animate-slide-in-right">
                            <label className="text-[9px] font-black uppercase text-tkd-red mb-1 ml-1 block tracking-widest">Defina el tipo de vínculo</label>
                            <input type="text" value={modalidadOtro} onChange={e => setModalidadOtro(e.target.value)} className={`${inputStyle} border border-tkd-red/20 focus:ring-tkd-red`} placeholder="Especifique..." />
                        </div>
                    )}

                    <div className="relative">
                        <label className="text-[9px] font-black uppercase text-gray-400 mb-1 ml-1 block tracking-widest">Lugar de Ejecución</label>
                        <select 
                            value={lugar} 
                            onChange={e => setLugar(e.target.value)} 
                            className={`${inputStyle} appearance-none cursor-pointer`}
                        >
                            <option value="">Seleccione Sede...</option>
                            {sedes.map(s => <option key={s.id} value={s.nombre}>{s.nombre} ({s.ciudad})</option>)}
                            <option value="Dojang Externo">Dojang Externo / Evento</option>
                        </select>
                        <div className="absolute right-3 bottom-3 pointer-events-none text-gray-400"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"/></svg></div>
                    </div>
                </div>

                <div className="space-y-3 pt-4">
                    <button 
                        onClick={() => onGenerar({ valorPago: monto, tipoVinculacion: modalidad, tipoVinculacionOtro: modalidadOtro, fechaInicio, lugarEjecucion: lugar, firmado: false })}
                        className="w-full bg-tkd-blue text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 hover:bg-blue-800 transition-all active:scale-95"
                    >
                        <IconoContrato className="w-6 h-6" /> Generar & Notificar
                    </button>
                    <button onClick={onCerrar} className="w-full text-gray-400 font-black uppercase text-[10px] tracking-widest py-2 hover:text-gray-600 transition-colors">Cancelar</button>
                </div>
            </div>
        </div>
    );
};

const VistaConfiguracion: React.FC = () => {
    const { 
        usuarios, cargando, cargarConfiguracion,
        localConfigClub, localConfigNotificaciones, cargandoAccion,
        modalUsuarioAbierto, usuarioEnEdicion, abrirFormularioUsuario, cerrarFormularioUsuario, guardarUsuarioHandler,
        modalConfirmacionAbierto, usuarioAEliminar, abrirConfirmacionEliminar, cerrarConfirmacion, confirmarEliminacion,
        handleConfigChange, guardarConfiguracionesHandler, setLocalConfigClub
    } = useGestionConfiguracion();
    
    const { programas, agregarPrograma, actualizarPrograma, eliminarPrograma } = useProgramas();
    const { sedes, agregarSede, actualizarSede, eliminarSede } = useSedes();
    const { estudiantes } = useEstudiantes();
    const { mostrarNotificacion } = useNotificacion();
    
    const [activeTab, setActiveTab] = useState<'branding' | 'equipo' | 'sedes' | 'programas' | 'alertas' | 'licencia'>('branding');
    const [usuarioParaContrato, setUsuarioParaContrato] = useState<Usuario | null>(null);
    const [itemAPagar, setItemAPagar] = useState<{ item: any, tipo: 'addon' | 'plan' } | null>(null);

    const [programaEdit, setProgramaEdit] = useState<Partial<Programa> | null>(null);
    const [modalProgramaAbierto, setModalProgramaAbierto] = useState(false);

    const [sedeEdit, setSedeEdit] = useState<Sede | null>(null);
    const [modalSedeAbierto, setModalSedeAbierto] = useState(false);

    const handleGenerarContrato = async (datosContrato: any) => {
        if (!usuarioParaContrato) return;
        try {
            await actualizarUsuario({ contrato: datosContrato, estadoContrato: 'Pendiente' }, usuarioParaContrato.id);
            const url = generarUrlAbsoluta(`/contrato-colaborador/${usuarioParaContrato.id}`);
            
            if (navigator.share) {
                await navigator.share({
                    title: 'Contrato ' + localConfigClub.nombreClub,
                    text: 'Hola! Por favor firma tu contrato de vinculación técnica aquí:',
                    url: url
                });
            } else {
                await navigator.clipboard.writeText(url);
                mostrarNotificacion("Enlace de contrato copiado al portapapeles.", "success");
            }
            
            setUsuarioParaContrato(null);
            cargarConfiguracion();
        } catch (e) {
            mostrarNotificacion("Error al preparar contrato", "error");
        }
    };

    const handleGuardarSede = async (datos: any) => {
        try {
            if (datos.id) {
                await actualizarSede(datos);
                mostrarNotificacion("Sede actualizada", "success");
            } else {
                if (sedes.length >= localConfigClub.limiteSedes) {
                    mostrarNotificacion("Límite de sedes alcanzado. Mejora tu plan para agregar más.", "warning");
                    return;
                }
                await agregarSede(datos);
                mostrarNotificacion("Sede registrada exitosamente", "success");
            }
            setModalSedeAbierto(false);
            setSedeEdit(null);
        } catch (e) {
            mostrarNotificacion("Error al guardar sede", "error");
        }
    };

    const handleGuardarPrograma = async (datos: Programa) => {
        try {
            if (datos.id) {
                await actualizarPrograma(datos);
                mostrarNotificacion("Programa actualizado", "success");
            } else {
                await agregarPrograma({
                    ...datos,
                    activo: true,
                    descripcion: datos.descripcion || '',
                    tenantId: localConfigClub.tenantId
                } as any);
                mostrarNotificacion("Nueva modalidad creada", "success");
            }
            setModalProgramaAbierto(false);
            setProgramaEdit(null);
        } catch (e) {
            mostrarNotificacion("Error al guardar programa", "error");
        }
    };

    const handleExitoPago = (datos: any) => {
        if (datos.tipo === 'addon') {
            setLocalConfigClub(prev => ({
                ...prev,
                limiteEstudiantes: prev.limiteEstudiantes + (datos.limiteEstudiantes || 0),
                limiteUsuarios: prev.limiteUsuarios + (datos.limiteUsuarios || 0),
                limiteSedes: prev.limiteSedes + (datos.limiteSedes || 0)
            }));
        } else {
            setLocalConfigClub(prev => ({
                ...prev,
                plan: datos.plan.id,
                limiteEstudiantes: datos.plan.limiteEstudiantes,
                limiteUsuarios: datos.plan.limiteUsuarios,
                limiteSedes: datos.plan.limiteSedes
            }));
        }
        setItemAPagar(null);
        mostrarNotificacion("Licencia actualizada exitosamente.", "success");
    };

    if (cargando) return <div className="h-screen flex items-center justify-center"><Loader texto="Sincronizando Dojang..." /></div>;

    const inputStyle = "w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl p-3 text-xs font-black text-gray-900 dark:text-white uppercase outline-none focus:ring-2 focus:ring-tkd-blue shadow-inner";

    return (
        <div className="p-4 sm:p-8 space-y-10 animate-fade-in">
            <header className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight leading-none">Centro de Control</h1>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mt-2">Configuración Global y Parámetros del Dojang</p>
                </div>
                <button onClick={guardarConfiguracionesHandler} disabled={cargandoAccion} className="w-full md:w-auto bg-tkd-blue text-white px-10 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all">
                    <IconoGuardar className="w-5 h-5" /> Guardar Cambios
                </button>
            </header>

            <div className="relative">
                <div className="bg-white dark:bg-gray-800 p-1.5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 w-full md:w-fit overflow-hidden">
                    <div className="flex flex-row overflow-x-auto no-scrollbar gap-1">
                        {[
                            { id: 'branding', label: 'Identidad & Pagos', icon: IconoImagen },
                            { id: 'equipo', label: 'Equipo Técnico', icon: IconoUsuario },
                            { id: 'sedes', label: 'Sedes', icon: IconoCasa },
                            { id: 'programas', label: 'Programas Extra', icon: IconoLogoOficial },
                            { id: 'alertas', label: 'Alertas', icon: IconoCampana },
                            { id: 'licencia', label: 'Licencia', icon: IconoAprobar }
                        ].map(tab => (
                            <button 
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex-shrink-0 flex items-center justify-center md:justify-start gap-3 px-6 py-4 md:py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-tkd-dark text-white shadow-xl scale-[1.01] md:scale-[1.02] z-10' : 'text-gray-400 hover:text-tkd-blue hover:bg-gray-50 dark:hover:bg-white/5'}`}
                                title={tab.label}
                            >
                                <tab.icon className="w-5 h-5 md:w-4 md:h-4" />
                                <span className="hidden md:inline">{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            
            {activeTab === 'branding' && (
                <div className="space-y-8 animate-fade-in">
                    <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="p-8 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/20">
                            <div className="flex items-center gap-3">
                                <IconoInformacion className="w-5 h-5 text-tkd-blue" />
                                <h2 className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white">Información Institucional y Legal</h2>
                            </div>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <div>
                                    <label className="text-[9px] font-black uppercase text-gray-400 block mb-2 ml-1 tracking-widest">Nombre Comercial del Club</label>
                                    <input type="text" name="nombreClub" value={localConfigClub.nombreClub} onChange={(e) => handleConfigChange(e as any, setLocalConfigClub)} className={inputStyle} placeholder="Eje: Taekwondo Ga Jog" />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black uppercase text-gray-400 block mb-2 ml-1 tracking-widest">NIT / Registro Legal</label>
                                    <input type="text" name="nit" value={localConfigClub.nit} onChange={(e) => handleConfigChange(e as any, setLocalConfigClub)} className={inputStyle} placeholder="900.xxx.xxx-x" />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black uppercase text-gray-400 block mb-2 ml-1 tracking-widest">Nombre del Representante Legal</label>
                                    <input type="text" name="representanteLegal" value={localConfigClub.representanteLegal} onChange={(e) => handleConfigChange(e as any, setLocalConfigClub)} className={inputStyle} placeholder="Nombre completo" />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black uppercase text-gray-400 block mb-2 ml-1 tracking-widest">Dirección Principal (Sede Administrativa)</label>
                                    <input type="text" name="direccionClub" value={localConfigClub.direccionClub} onChange={(e) => handleConfigChange(e as any, setLocalConfigClub)} className={inputStyle} placeholder="Calle, Av, Carrera..." />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black uppercase text-gray-400 block mb-2 ml-1 tracking-widest">Correo Institucional (Opcional)</label>
                                    <input type="email" name="emailClub" value={localConfigClub.emailClub || ''} onChange={(e) => handleConfigChange(e as any, setLocalConfigClub)} className={inputStyle} placeholder="club@ejemplo.com" />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black uppercase text-tkd-blue block mb-2 ml-1 tracking-widest">Tarifa Base Mensualidad (COP)</label>
                                    <input type="number" name="valorMensualidad" value={localConfigClub.valorMensualidad} onChange={(e) => handleConfigChange(e as any, setLocalConfigClub)} className={`${inputStyle} border-2 border-tkd-blue/10 focus:ring-tkd-blue`} />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
                            <div className="p-8 border-b dark:border-gray-700 flex justify-between items-center">
                                <h2 className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white">Branding & Identidad Visual</h2>
                                <IconoImagen className="w-5 h-5 text-gray-400" />
                            </div>
                            <div className="p-8 space-y-8">
                                <div className="flex flex-col sm:flex-row items-center gap-8">
                                    <div className="w-32 h-32 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-[2rem] flex items-center justify-center bg-gray-50 dark:bg-gray-900/50">
                                        {localConfigClub.logoUrl ? <img src={localConfigClub.logoUrl} className="w-24 h-24 object-contain" alt="Logo actual" /> : <IconoImagen className="w-10 h-10 text-gray-300" />}
                                    </div>
                                    <div className="space-y-3 flex-1 text-center sm:text-left">
                                        <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Logo del Club</p>
                                        <button className="bg-gray-500 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md">Seleccionar Archivo</button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-6 pt-4 border-t dark:border-gray-700">
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-gray-400 block mb-2 text-center">Fondo</label>
                                        <input type="color" name="colorPrimario" value={localConfigClub.colorPrimario} onChange={(e) => handleConfigChange(e as any, setLocalConfigClub)} className="w-full h-12 rounded-xl cursor-pointer border-none" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-gray-400 block mb-2 text-center">Primario</label>
                                        <input type="color" name="colorSecundario" value={localConfigClub.colorSecundario} onChange={(e) => handleConfigChange(e as any, setLocalConfigClub)} className="w-full h-12 rounded-xl cursor-pointer border-none" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-gray-400 block mb-2 text-center">Acento</label>
                                        <input type="color" name="colorAcento" value={localConfigClub.colorAcento} onChange={(e) => handleConfigChange(e as any, setLocalConfigClub)} className="w-full h-12 rounded-xl cursor-pointer border-none" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
                            <div className="p-8 border-b dark:border-gray-700 flex justify-between items-center">
                                <h2 className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white">Destinos de Dinero (Recaudo)</h2>
                                <IconoAprobar className="w-5 h-5 text-green-500" />
                            </div>
                            <div className="p-8 space-y-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[9px] font-black uppercase text-gray-400 block mb-2 ml-1">Número Nequi</label>
                                        <input type="text" name="pagoNequi" value={localConfigClub.pagoNequi} onChange={(e) => handleConfigChange(e as any, setLocalConfigClub)} className={inputStyle} />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black uppercase text-gray-400 block mb-2 ml-1">Número Daviplata</label>
                                        <input type="text" name="pagoDaviplata" value={localConfigClub.pagoDaviplata} onChange={(e) => handleConfigChange(e as any, setLocalConfigClub)} className={inputStyle} />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[9px] font-black uppercase text-gray-400 block mb-2 ml-1">Llave BRE-B</label>
                                    <input type="text" name="pagoBreB" value={localConfigClub.pagoBreB} onChange={(e) => handleConfigChange(e as any, setLocalConfigClub)} className={inputStyle} placeholder="Email, Celular o ID..." />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black uppercase text-gray-400 block mb-2 ml-1">Detalles Cuenta Bancaria</label>
                                    <input type="text" name="pagoBanco" value={localConfigClub.pagoBanco} onChange={(e) => handleConfigChange(e as any, setLocalConfigClub)} className={inputStyle} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'equipo' && (
                <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden animate-slide-in-right">
                    <div className="p-8 border-b dark:border-gray-700 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <h2 className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white">Equipo Técnico y Administrativo</h2>
                        <button onClick={() => abrirFormularioUsuario()} className="w-full sm:w-auto bg-tkd-blue text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center justify-center gap-2">
                             <IconoAgregar className="w-4 h-4" /> Nuevo Miembro
                        </button>
                    </div>
                    <div className="p-4 sm:p-8">
                        <TablaUsuarios 
                            usuarios={usuarios} 
                            onEditar={abrirFormularioUsuario} 
                            onEliminar={abrirConfirmacionEliminar}
                            onGestionarContrato={(u) => setUsuarioParaContrato(u)}
                        />
                    </div>
                </div>
            )}

            {activeTab === 'sedes' && (
                <div className="space-y-10 animate-fade-in">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-4 gap-4">
                        <div className="space-y-1">
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Sedes / Ubicaciones</h2>
                            <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Sucursales activas para tu licencia ({sedes.length} / {localConfigClub.limiteSedes})</p>
                        </div>
                        <button 
                            onClick={() => { setSedeEdit(null); setModalSedeAbierto(true); }}
                            disabled={sedes.length >= localConfigClub.limiteSedes}
                            className="bg-tkd-blue text-white px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg flex items-center gap-2 active:scale-95 transition-all disabled:bg-gray-300"
                        >
                            <IconoAgregar className="w-4 h-4" /> Registrar Nueva Sede
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 px-4">
                        {sedes.map(s => (
                            <div key={s.id} className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl transition-all p-8 flex flex-col justify-between">
                                <div className="space-y-6">
                                    <div className="flex justify-between items-center">
                                        <div className="p-3 bg-tkd-blue/5 text-tkd-blue rounded-2xl">
                                            <IconoCasa className="w-6 h-6" />
                                        </div>
                                        <div className="flex gap-1">
                                            <button onClick={() => { setSedeEdit(s); setModalSedeAbierto(true); }} className="p-2 text-gray-400 hover:text-tkd-blue rounded-lg transition-colors"><IconoEditar className="w-5 h-5" /></button>
                                            <button onClick={() => eliminarSede(s.id)} className="p-2 text-gray-400 hover:text-tkd-red rounded-lg transition-colors"><IconoEliminar className="w-5 h-5" /></button>
                                        </div>
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black uppercase text-gray-900 dark:text-white mb-1">{s.nombre}</h3>
                                        <p className="text-[10px] text-tkd-blue font-black uppercase tracking-widest">{s.ciudad}</p>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-xs text-gray-500 font-medium uppercase leading-tight">{s.direccion}</p>
                                        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest flex items-center gap-2">
                                            <IconoWhatsApp className="w-3.5 h-3.5" /> {s.telefono}
                                        </p>
                                    </div>
                                    
                                    {/* Muestra el precio específico si existe */}
                                    <div className="pt-4 border-t dark:border-gray-700">
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Precio Clase:</p>
                                        <p className="text-sm font-black text-tkd-dark dark:text-white">
                                            {s.valorMensualidad && s.valorMensualidad > 0 ? formatearPrecio(s.valorMensualidad) : `BASE (${formatearPrecio(localConfigClub.valorMensualidad)})`}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {modalSedeAbierto && (
                        <FormularioSede 
                            abierto={modalSedeAbierto} 
                            onCerrar={() => setModalSedeAbierto(false)} 
                            onGuardar={handleGuardarSede}
                            sedeActual={sedeEdit}
                            cargando={false}
                        />
                    )}
                </div>
            )}

            {activeTab === 'programas' && (
                <div className="space-y-10 animate-fade-in">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-4 gap-4">
                        <div className="space-y-1">
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Catálogo de Modalidades</h2>
                            <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Defina servicios con costos y horarios independientes</p>
                        </div>
                        <button 
                            onClick={() => { setProgramaEdit(null); setModalProgramaAbierto(true); }}
                            className="bg-tkd-blue text-white px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg flex items-center gap-2 active:scale-95 transition-all"
                        >
                            <IconoAgregar className="w-4 h-4" /> Nueva Modalidad
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 px-4">
                        {programas.map(p => (
                            <div key={p.id} className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between hover:shadow-md transition-all group overflow-hidden relative">
                                <div className="space-y-4 relative z-10">
                                    <div className="flex justify-between items-start">
                                        <div className={`w-12 h-12 rounded-2xl bg-gray-50 dark:bg-gray-900 flex items-center justify-center ${p.tipoCobro === TipoCobroPrograma.Recurrente ? 'text-tkd-blue' : 'text-tkd-red'} shadow-inner mb-4`}>
                                            <IconoLogoOficial className="w-6 h-6" />
                                        </div>
                                        <div className="flex gap-1">
                                            <button onClick={() => { setProgramaEdit(p); setModalProgramaAbierto(true); }} className="p-2 text-gray-400 hover:text-tkd-blue transition-all"><IconoEditar className="w-5 h-5" /></button>
                                            <button onClick={() => eliminarPrograma(p.id)} className="p-2 text-gray-400 hover:text-tkd-red transition-all"><IconoEliminar className="w-5 h-5" /></button>
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <span className={`inline-block text-[9px] font-black uppercase px-3 py-1 rounded-full mb-3 ${p.tipoCobro === TipoCobroPrograma.Recurrente ? 'bg-tkd-blue/10 text-tkd-blue' : 'bg-tkd-red/10 text-tkd-red'}`}>
                                            {p.tipoCobro === TipoCobroPrograma.Recurrente ? 'Suscripción Mensual' : 'Pago por Taller'}
                                        </span>
                                        <h3 className="text-xl font-black uppercase text-gray-900 dark:text-white tracking-tight leading-tight">{p.nombre}</h3>
                                        <p className="text-[10px] text-gray-50 font-bold uppercase tracking-widest mt-2 flex items-center gap-2">
                                            <IconoCampana className="w-3.5 h-3.5" /> {p.horario || 'Horario flexible'}
                                        </p>
                                    </div>

                                    <div className="pt-6 border-t border-gray-50 dark:border-gray-700 mt-4">
                                        <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-1">Inversión Adicional</p>
                                        <p className="text-2xl font-black text-tkd-dark dark:text-white">
                                            {formatearPrecio(p.valor)}
                                            {p.tipoCobro === TipoCobroPrograma.Recurrente && <span className="text-[10px] text-gray-400 ml-1">/mes</span>}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}

                        <button 
                            onClick={() => { setProgramaEdit(null); setModalProgramaAbierto(true); }}
                            className="bg-gray-50 dark:bg-gray-900/50 border-4 border-dashed border-gray-200 dark:border-gray-800 rounded-[3rem] p-10 flex flex-col items-center justify-center text-center gap-6 hover:border-tkd-blue hover:bg-tkd-blue/5 transition-all group min-h-[320px] shadow-inner"
                        >
                            <div className="w-16 h-16 bg-white dark:bg-gray-800 rounded-3xl shadow-xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-12 transition-all">
                                <IconoAgregar className="w-10 h-10 text-tkd-blue" />
                            </div>
                            <div className="space-y-2">
                                <p className="text-lg font-black uppercase text-gray-900 dark:text-white tracking-tight">Expandir Catálogo</p>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-relaxed px-4">Crea nuevas especialidades o talleres para tu dojang</p>
                            </div>
                        </button>
                    </div>

                    {modalProgramaAbierto && (
                        <ModalFormPrograma 
                            programa={programaEdit} 
                            onCerrar={() => setModalProgramaAbierto(false)} 
                            onGuardar={handleGuardarPrograma}
                        />
                    )}
                </div>
            )}

            {activeTab === 'alertas' && <div className="max-w-md mx-auto sm:mx-0 animate-slide-in-right"><GestionNotificacionesPush /></div>}

            {activeTab === 'licencia' && (
                <div className="max-w-4xl mx-auto animate-slide-in-right space-y-12 pb-20">
                    <div className="bg-tkd-dark rounded-[3rem] p-12 text-white shadow-2xl relative overflow-hidden">
                        <div className="relative z-10 space-y-8">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="text-4xl font-black uppercase tracking-tighter">Plan {localConfigClub.plan.toUpperCase()}</h2>
                                    <p className="text-tkd-red font-black text-xs uppercase tracking-[0.3em] mt-2">Estado: {localConfigClub.estadoSuscripcion}</p>
                                </div>
                                <IconoAprobar className="w-12 h-12 text-tkd-red" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                                    <p className="text-[10px] font-black uppercase opacity-50 mb-2">Alumnos</p>
                                    <p className="text-2xl font-black">{estudiantes.length} / {localConfigClub.limiteEstudiantes}</p>
                                </div>
                                <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                                    <p className="text-[10px] font-black uppercase opacity-50 mb-2">Personal</p>
                                    <p className="text-2xl font-black">{usuarios.length} / {localConfigClub.limiteUsuarios}</p>
                                </div>
                                <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                                    <p className="text-[10px] font-black uppercase opacity-50 mb-2">Sedes Activadas</p>
                                    <p className="text-xl font-black uppercase">{sedes.length} / {localConfigClub.limiteSedes}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="ml-2"><h3 className="text-sm font-black uppercase text-tkd-dark dark:text-white tracking-[0.2em]">Expansión Inmediata (Add-ons)</h3></div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[
                                { id: 'estudiantes', key: 'estudiantes', cantidad: COSTOS_ADICIONALES.estudiantes.cantidad, label: COSTOS_ADICIONALES.estudiantes.label, precio: COSTOS_ADICIONALES.estudiantes.precio, icon: IconoEstudiantes, color: 'text-blue-500' },
                                { id: 'instructor', key: 'instructor', cantidad: COSTOS_ADICIONALES.instructor.cantidad, label: COSTOS_ADICIONALES.instructor.label, precio: COSTOS_ADICIONALES.instructor.precio, icon: IconoUsuario, color: 'text-tkd-red' },
                                { id: 'sede', key: 'sede', cantidad: COSTOS_ADICIONALES.sede.cantidad, label: COSTOS_ADICIONALES.sede.label, precio: COSTOS_ADICIONALES.sede.precio, icon: IconoCasa, color: 'text-green-500' }
                            ].map((addon) => (
                                <div key={addon.id} className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between hover:shadow-md transition-all group overflow-hidden relative">
                                    <div className="space-y-4 relative z-10">
                                        <div className={`w-12 h-12 rounded-2xl bg-gray-50 dark:bg-gray-900 flex items-center justify-center ${addon.color} shadow-inner mb-4`}><addon.icon className="w-6 h-6" /></div>
                                        <p className="text-xs font-black uppercase dark:text-white tracking-tight">{addon.label}</p>
                                        <p className="text-2xl font-black text-tkd-dark dark:text-white">{formatearPrecio(addon.precio)} <span className="text-[9px] text-gray-400">/mes</span></p>
                                    </div>
                                    <button onClick={() => setItemAPagar({ item: addon, tipo: 'addon' })} className="mt-6 w-full bg-tkd-dark text-white py-3 rounded-xl font-black uppercase text-[10px] hover:bg-tkd-blue transition-all active:scale-90">Adquirir</button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="ml-2"><h3 className="text-sm font-black uppercase text-tkd-dark dark:text-white tracking-[0.2em]">Upgrade de MembresÍA</h3></div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Added comment above fix: explicitly cast plan as any to fix 'unknown' property access errors. */}
                            {Object.values(PLANES_SAAS).map((plan: any) => (
                                <div key={plan.id} className={`bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] border-2 flex flex-col justify-between hover:shadow-lg transition-all ${localConfigClub.plan === plan.id ? 'border-tkd-blue opacity-50' : 'border-gray-100 dark:border-gray-700'}`}>
                                    <div className="space-y-4">
                                        <h4 className="text-lg font-black uppercase dark:text-white">{plan.nombre}</h4>
                                        <p className="text-3xl font-black text-tkd-blue">{formatearPrecio(plan.precio)} <span className="text-[10px] text-gray-400">/mes</span></p>
                                        <ul className="space-y-2 mt-4">
                                            <li className="text-[10px] font-bold text-gray-500 uppercase">• Hasta {plan.limiteEstudiantes} alumnos</li>
                                            <li className="text-[10px] font-bold text-gray-500 uppercase">• {plan.limiteUsuarios} Instructores</li>
                                            <li className="text-[10px] font-bold text-gray-500 uppercase">• {plan.limiteSedes} Sedes</li>
                                        </ul>
                                    </div>
                                    {localConfigClub.plan !== plan.id ? (
                                        <button onClick={() => setItemAPagar({ item: plan, tipo: 'plan' })} className="mt-8 w-full bg-tkd-blue text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-800 transition-all">Migrar a este Plan</button>
                                    ) : (
                                        <div className="mt-8 text-center text-tkd-blue font-black uppercase text-[10px]">Tu Plan Actual</div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {itemAPagar && (
                <ModalPagoCheckout 
                    item={itemAPagar.item} 
                    tipo={itemAPagar.tipo}
                    tenantId={localConfigClub.tenantId} 
                    onCerrar={() => setItemAPagar(null)} 
                    onExito={handleExitoPago}
                />
            )}

            {usuarioParaContrato && (
                <ModalGenerarContrato 
                    usuario={usuarioParaContrato} 
                    sedes={sedes}
                    onCerrar={() => setUsuarioParaContrato(null)} 
                    onGenerar={handleGenerarContrato}
                />
            )}
            {modalUsuarioAbierto && <FormularioUsuario abierto={modalUsuarioAbierto} onCerrar={cerrarFormularioUsuario} onGuardar={guardarUsuarioHandler} usuarioActual={usuarioEnEdicion} cargando={cargandoAccion} />}
            {modalConfirmacionAbierto && usuarioAEliminar && <ModalConfirmacion abierto={modalConfirmacionAbierto} titulo="Revocar Acceso" mensaje={`¿Deseas deshabilitar a ${usuarioAEliminar.nombreUsuario}?`} onCerrar={cerrarConfirmacion} onConfirmar={confirmarEliminacion} cargando={cargandoAccion} />}
        </div>
    );
};

export default VistaConfiguracion;
