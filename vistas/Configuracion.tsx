
// vistas/Configuracion.tsx
import React, { useState } from 'react';
import { Usuario, TipoVinculacionColaborador, RolUsuario, Programa, TipoCobroPrograma, Sede } from '../tipos';
import { generarUrlAbsoluta, formatearPrecio } from '../utils/formatters';
import {
    IconoCerrar, IconoContrato, IconoWhatsApp, IconoCopiar, IconoAprobar,
    IconoAgregar, IconoImagen, IconoCampana, IconoUsuario, IconoGuardar,
    IconoLogoOficial, IconoInformacion, IconoEditar, IconoEliminar,
    IconoCasa, IconoEstudiantes, IconoEnviar, IconoExitoAnimado,
    IconoHistorial, IconoEmail
} from '../components/Iconos';
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
                                <option value={TipoCobroPrograma.Recurrente}>MembresÍA</option>
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
        usuarios, cargando, cargarConfiguracion,
        localConfigClub, localConfigNotificaciones, cargandoAccion,
        modalUsuarioAbierto, usuarioEnEdicion, abrirFormularioUsuario, cerrarFormularioUsuario, guardarUsuarioHandler,
        modalConfirmacionAbierto, usuarioAEliminar, abrirConfirmacionEliminar, cerrarConfirmacion, confirmarEliminacion,
        handleConfigChange, guardarConfiguracionesHandler, setLocalConfigClub, setLocalConfigNotificaciones
    } = useGestionConfiguracion();

    const { programas, agregarPrograma, actualizarPrograma, eliminarPrograma } = useProgramas();
    const { sedes, agregarSede, actualizarSede, eliminarSede } = useSedes();
    const { mostrarNotificacion } = useNotificacion();

    const [activeTab, setActiveTab] = useState<'branding' | 'equipo' | 'sedes' | 'programas' | 'alertas' | 'licencia'>('branding');
    const [itemAPagar, setItemAPagar] = useState<{ item: any, tipo: 'addon' | 'plan' } | null>(null);
    const [programaEdit, setProgramaEdit] = useState<Partial<Programa> | null>(null);
    const [modalProgramaAbierto, setModalProgramaAbierto] = useState(false);
    const [sedeEdit, setSedeEdit] = useState<Sede | null>(null);
    const [modalSedeAbierto, setModalSedeAbierto] = useState(false);

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
                <button onClick={guardarConfiguracionesHandler} disabled={cargandoAccion} className="w-full md:w-auto bg-tkd-blue text-white px-10 py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all">
                    <IconoGuardar className="w-5 h-5" /> Guardar Cambios
                </button>
            </header>

            {/* BARRA DE NAVEGACIÓN */}
            <div className="bg-white dark:bg-gray-800/50 p-1.5 rounded-[2rem] shadow-soft border border-gray-100 dark:border-white/5 w-full md:w-fit overflow-x-auto no-scrollbar">
                <div className="flex flex-row gap-1">
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
                            className={`flex-shrink-0 flex items-center justify-center gap-3 px-8 py-4 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-tkd-dark text-white shadow-xl scale-[1.03] z-10' : 'text-gray-400 hover:text-tkd-blue hover:bg-gray-50 dark:hover:bg-white/5'}`}
                        >
                            <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-tkd-red' : ''}`} />
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* CONTENIDO DE PESTAÑAS */}
            <div className="min-h-[500px]">
                {activeTab === 'branding' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 animate-fade-in">
                        <section className="bg-white dark:bg-white/5 p-10 rounded-[3rem] border border-gray-100 dark:border-white/10 space-y-8">
                            <h3 className="text-xl font-black uppercase tracking-tight text-tkd-blue">Información Institucional</h3>
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
                                    <label className="text-[10px] font-black uppercase text-gray-400 block mb-2 ml-1 tracking-widest">Representante Legal</label>
                                    <input type="text" name="representanteLegal" value={localConfigClub.representanteLegal} onChange={(e) => handleConfigChange(e as any, setLocalConfigClub)} className={inputClasses} />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-800">
                                        <label className="text-[9px] font-black uppercase text-tkd-blue block mb-2 ml-1 tracking-widest">Inscripción Inicial (COP)</label>
                                        <input type="number" name="valorInscripcion" value={localConfigClub.valorInscripcion} onChange={(e) => handleConfigChange(e as any, setLocalConfigClub)} className={inputClasses} />
                                    </div>
                                    <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-2xl border border-red-100 dark:border-red-800">
                                        <label className="text-[9px] font-black uppercase text-tkd-red block mb-2 ml-1 tracking-widest">Mora Mensual (%)</label>
                                        <input type="number" name="moraPorcentaje" value={localConfigClub.moraPorcentaje} onChange={(e) => handleConfigChange(e as any, setLocalConfigClub)} className={inputClasses} />
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section className="bg-white dark:bg-white/5 p-10 rounded-[3rem] border border-gray-100 dark:border-white/10 space-y-8">
                            <h3 className="text-xl font-black uppercase tracking-tight text-tkd-blue">Branding & Logo</h3>
                            <div className="flex flex-col items-center justify-center border-4 border-dashed border-gray-100 dark:border-white/5 rounded-[3rem] p-12 text-center space-y-6">
                                <div className="w-40 h-40 bg-gray-50 dark:bg-black/20 rounded-full flex items-center justify-center overflow-hidden border-4 border-white dark:border-gray-800 shadow-xl">
                                    {localConfigClub.logoUrl ? <img src={localConfigClub.logoUrl} className="w-full h-full object-contain" /> : <IconoLogoOficial className="w-20 h-20 opacity-20" />}
                                </div>
                                <button className="px-8 py-3 bg-tkd-dark text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all">Cambiar Logo Oficial</button>
                                <p className="text-[9px] text-gray-400 font-bold uppercase">Formato recomendado: PNG Transparente 512x512px</p>
                            </div>
                        </section>
                    </div>
                )}

                {activeTab === 'equipo' && (
                    <div className="space-y-8 animate-fade-in">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-black uppercase tracking-tight text-tkd-blue">Nómina Técnica y Personal</h3>
                            <button onClick={() => abrirFormularioUsuario()} className="bg-tkd-blue text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg flex items-center gap-2 active:scale-95 transition-all">
                                <IconoAgregar className="w-4 h-4" /> Vincular Miembro
                            </button>
                        </div>
                        <div className="tkd-card p-0">
                            <TablaUsuarios
                                usuarios={usuarios}
                                onEditar={abrirFormularioUsuario}
                                onEliminar={abrirConfirmacionEliminar}
                                onGestionarContrato={() => mostrarNotificacion("Módulo legal en actualización.", "info")}
                            />
                        </div>
                    </div>
                )}

                {activeTab === 'sedes' && (
                    <div className="space-y-8 animate-fade-in">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-black uppercase tracking-tight text-tkd-blue">Gestión de Sedes / Dojangs</h3>
                            <button onClick={() => setModalSedeAbierto(true)} className="bg-tkd-blue text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg flex items-center gap-2 active:scale-95 transition-all">
                                <IconoAgregar className="w-4 h-4" /> Registrar Sede
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
                            <button onClick={() => { setProgramaEdit(null); setModalProgramaAbierto(true); }} className="bg-tkd-blue text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg flex items-center gap-2 active:scale-95 transition-all">
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
                        <div className="bg-tkd-dark text-white p-10 rounded-[3rem] shadow-2xl flex flex-col md:flex-row justify-between items-center gap-8 border border-white/5 relative overflow-hidden">
                            <div className="relative z-10">
                                <p className="text-[10px] font-black text-tkd-red uppercase tracking-[0.4em] mb-2">Estado de Suscripción</p>
                                <h3 className="text-4xl font-black uppercase tracking-tighter">Plan <span className="text-tkd-blue">{localConfigClub.plan}</span></h3>
                                <p className="text-gray-400 text-xs mt-4 font-bold uppercase tracking-widest">Vence el: {localConfigClub.fechaVencimiento}</p>
                            </div>
                            <div className="flex gap-4 relative z-10">
                                <button className="bg-white text-tkd-dark px-10 py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-gray-100 transition-all active:scale-95">Renovar Licencia</button>
                            </div>
                            <div className="absolute -right-20 -bottom-20 opacity-5 rotate-12"><IconoLogoOficial className="w-80 h-80" /></div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {Object.values(COSTOS_ADICIONALES).map(addon => (
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
        </div>
    );
};

export default VistaConfiguracion;
