
// vistas/Estudiantes.tsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGestionEstudiantes } from '../hooks/useGestionEstudiantes';
import { useAuth } from '../context/AuthContext';
import { RolUsuario, MisionKicho } from '../tipos';
import { obtenerMisionActivaTenant } from '../servicios/censoApi';

// Componentes
import { IconoAgregar, IconoEstudiantes, IconoExportar, IconoLogoOficial, IconoCertificado, IconoInformacion, IconoCampana } from '../components/Iconos';
import ModalConfirmacion from '../components/ModalConfirmacion';
import FormularioEstudiante from '../components/FormularioEstudiante';
import ModalVerFirma from '../components/ModalVerFirma';
import FiltrosEstudiantes from '../components/FiltrosEstudiantes';
import TablaEstudiantes from '../components/TablaEstudiantes';
import { TablaEstudiantesSkeleton } from '../components/skeletons/TablaEstudiantesSkeleton';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import ModalImportacionMasiva from '../components/ModalImportacionMasiva';

// Sub-vistas integradas
import VistaGestionClase from './GestionClase';
import VistaCarnetizacion from './Carnetizacion';
import VistaCertificaciones from './Certificaciones';
import VistaMisionKicho from './MisionKicho';

type TabId = 'directorio' | 'asistencia' | 'carnets' | 'certificados' | 'kicho';

export const VistaEstudiantes: React.FC = () => {
    const { usuario } = useAuth();
    const {
        estudiantes,
        estudiantesFiltrados,
        estudiantesPaginados,
        cargando,
        error,
        cargarEstudiantes,
        filtroNombre,
        setFiltroNombre,
        filtroGrupo,
        setFiltroGrupo,
        filtroEstado,
        setFiltroEstado,
        modalFormularioAbierto,
        estudianteEnEdicion,
        abrirFormulario,
        cerrarFormulario,
        guardarEstudiante,
        cargandoAccion,
        modalConfirmacionAbierto,
        estudianteAEliminar,
        abrirConfirmacionEliminar,
        cerrarConfirmacion,
        confirmarEliminacion,
        modalFirmaAbierto,
        firmaParaVer,
        abrirModalFirma,
        cerrarModalFirma,
        handleShareLink,
        currentPage,
        totalPages,
        startIndex,
        endIndex,
        goToNextPage,
        goToPreviousPage,
        exportarCSV,
    } = useGestionEstudiantes();

    const [modalImportMasivaAbierto, setModalImportMasivaAbierto] = useState(false);
    const [misionActiva, setMisionActiva] = useState<MisionKicho | null>(null);
    const [countdown, setCountdown] = useState('');

    const esTutor = usuario?.rol === RolUsuario.Tutor;
    const [activeTab, setActiveTab] = useState<TabId>(esTutor ? 'asistencia' : 'directorio');

    // Cargar misión activa para el banner global
    useEffect(() => {
        if (usuario) {
            obtenerMisionActivaTenant(usuario.tenantId).then(setMisionActiva);
        }
    }, [usuario, activeTab]);

    // Timer para el banner global
    useEffect(() => {
        if (!misionActiva) return;
        const interval: NodeJS.Timeout = setInterval(() => {
            const diff = new Date(misionActiva.fechaExpiracion).getTime() - new Date().getTime();
            if (diff <= 0) { setCountdown('EXPIRADA'); clearInterval(interval); return; }
            const h = Math.floor(diff / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            setCountdown(`${h}h ${m}m restantes`);
        }, 60000);
        return () => clearInterval(interval);
    }, [misionActiva]);

    const renderDirectorio = () => {
        if (cargando) return <TablaEstudiantesSkeleton />;
        if (error) return <ErrorState mensaje={error} onReintentar={cargarEstudiantes} />;

        const tieneEstudiantes = estudiantes.length > 0;
        const filtrosSinResultados = tieneEstudiantes && estudiantesFiltrados.length === 0;

        if (filtrosSinResultados) {
            return <EmptyState Icono={IconoEstudiantes} titulo="Sin resultados" mensaje="Ningún estudiante coincide con los filtros actuales. Prueba a cambiarlos o limpiarlos." />;
        }
        if (tieneEstudiantes) {
            return (
                <div className="animate-fade-in space-y-4">
                    <FiltrosEstudiantes filtroNombre={filtroNombre} setFiltroNombre={setFiltroNombre} filtroGrupo={filtroGrupo} setFiltroGrupo={setFiltroGrupo} filtroEstado={filtroEstado} setFiltroEstado={setFiltroEstado} />

                    <div className="mb-4 text-[10px] font-black text-tkd-blue flex justify-between items-center uppercase tracking-widest px-1">
                        <div>
                            {estudiantesFiltrados.length > 0 ? (
                                <>Mostrando <span className="text-tkd-blue">{startIndex + 1}-{Math.min(endIndex, estudiantesFiltrados.length)}</span> de <span className="text-tkd-blue">{estudiantesFiltrados.length}</span></>
                            ) : (
                                <>Mostrando <span className="text-tkd-red">0</span> resultados</>
                            )}
                        </div>
                    </div>

                    <TablaEstudiantes estudiantes={estudiantesPaginados} onEditar={abrirFormulario} onEliminar={abrirConfirmacionEliminar} onVerFirma={abrirModalFirma} onCompartirLink={handleShareLink} />
                    {renderPaginacion()}
                </div>
            );
        }
        return (
            <EmptyState Icono={IconoEstudiantes} titulo="Aún no hay estudiantes" mensaje="Empieza a gestionar tu escuela agregando tu primer estudiante.">
                <div className="flex flex-col gap-4 max-w-xs mx-auto">
                    <button onClick={() => abrirFormulario()} className="bg-tkd-blue text-white px-6 py-3 rounded-xl font-black uppercase text-xs tracking-widest shadow-lg hover:bg-blue-800 transition-all active:scale-95 flex items-center justify-center gap-2">
                        <IconoAgregar className="w-5 h-5" /><span>Agregar Uno a Uno</span>
                    </button>
                    <button onClick={() => setModalImportMasivaAbierto(true)} className="bg-gray-100 text-gray-600 px-6 py-3 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-gray-200 transition-all flex items-center justify-center gap-2">
                        <IconoInformacion className="w-5 h-5" /><span>Carga Masiva (CSV)</span>
                    </button>
                </div>
            </EmptyState>
        );
    }

    const renderPaginacion = () => {
        if (totalPages <= 1) return null;
        return (
            <div className="flex items-center justify-between mt-6 bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <button onClick={goToPreviousPage} disabled={currentPage === 1} className="px-5 py-2 bg-gray-50 text-gray-500 font-black uppercase text-[10px] tracking-widest rounded-xl disabled:opacity-30 hover:bg-gray-100 dark:bg-gray-700">Anterior</button>
                <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Pág {currentPage} de {totalPages}</span>
                <button onClick={goToNextPage} disabled={currentPage >= totalPages} className="px-5 py-2 bg-gray-50 text-gray-500 font-black uppercase text-[10px] tracking-widest rounded-xl disabled:opacity-30 hover:bg-gray-100 dark:bg-gray-700">Siguiente</button>
            </div>
        );
    };

    const tabs = [
        { id: 'kicho', label: 'Misión KICHO', icono: IconoCampana, visible: usuario?.rol === RolUsuario.Admin || usuario?.rol === RolUsuario.Editor },
        { id: 'directorio', label: 'Directorio', icono: IconoEstudiantes, visible: !esTutor },
        { id: 'asistencia', label: 'Clase en Vivo', icono: IconoLogoOficial, visible: true },
        { id: 'certificados', label: 'Certificaciones', icono: IconoCertificado, visible: !esTutor },
        { id: 'carnets', label: 'Carnetización', icono: IconoExportar, visible: !esTutor && usuario?.rol !== RolUsuario.Asistente },
    ].filter(t => t.visible);

    return (
        <div className="p-4 sm:p-8 space-y-8">
            {/* BANNER GLOBAL DE MISIÓN KICHO ACTIVA */}
            <AnimatePresence>
                {misionActiva && activeTab !== 'kicho' && (
                    <motion.div
                        initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -50, opacity: 0 }}
                        className="bg-tkd-blue/10 border border-tkd-blue/20 p-4 rounded-[1.5rem] flex flex-col sm:flex-row justify-between items-center gap-4 shadow-sm"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-tkd-blue text-white rounded-xl flex items-center justify-center shadow-lg"><IconoCampana className="w-5 h-5 animate-bounce" /></div>
                            <div>
                                <p className="text-[10px] font-black uppercase text-tkd-blue tracking-widest">Protocolo de Onboarding Activo</p>
                                <p className="text-xs font-bold text-gray-600 dark:text-gray-300">Tus alumnos están enviando sus datos. Revisa la pestaña Misión KICHO.</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="bg-tkd-red/10 text-tkd-red px-4 py-1.5 rounded-full text-[10px] font-black uppercase border border-tkd-red/20">{countdown}</div>
                            <button onClick={() => setActiveTab('kicho')} className="text-xs font-black uppercase text-tkd-blue hover:underline">Gestionar Registro →</button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <header className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight leading-none">Hub de Estudiantes</h1>
                    <p className="text-[10px] font-black text-gray-500 dark:text-gray-400 mt-2 uppercase tracking-[0.2em]">Gestión centralizada de la base técnica</p>
                </div>

                {activeTab === 'directorio' && (
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <button onClick={exportarCSV} disabled={estudiantesFiltrados.length === 0} className="bg-green-600 text-white p-3 rounded-xl hover:bg-green-700 transition-all shadow-lg" title="Exportar CSV"><IconoExportar className="w-5 h-5" /></button>
                        <button onClick={() => setModalImportMasivaAbierto(true)} className="bg-white text-tkd-blue border-2 border-tkd-blue/20 px-4 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-50 transition-all flex items-center justify-center gap-2"><IconoInformacion className="w-4 h-4" /><span>Importar CSV</span></button>
                        <button onClick={() => abrirFormulario()} className="flex-1 md:flex-none bg-tkd-blue text-white px-8 py-3 rounded-xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-blue-800 transition-all flex items-center justify-center gap-3"><IconoAgregar className="w-5 h-5" /><span>Nuevo Alumno</span></button>
                    </div>
                )}
            </header>

            {/* BARRA DE NAVEGACIÓN: ICONOS EN MÓVIL (H/V), ICONO+TEXTO EN PC */}
            <div className="bg-white dark:bg-gray-800 p-1.5 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700 w-full md:w-fit overflow-hidden">
                <div className="flex flex-row overflow-x-auto no-scrollbar gap-1">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as TabId)}
                            className={`flex-shrink-0 flex items-center justify-center gap-3 px-6 py-4 md:py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-tkd-dark text-white shadow-xl scale-[1.01] md:scale-[1.02] z-10' : 'text-gray-400 hover:text-tkd-blue hover:bg-gray-50 dark:hover:bg-white/5'}`}
                            title={tab.label}
                        >
                            <tab.icono className={`w-5 h-5 md:w-4 md:h-4 ${activeTab === tab.id ? 'text-tkd-red' : ''}`} />
                            <span className="hidden md:inline">{tab.label}</span>
                            {tab.id === 'kicho' && <div className="w-2 h-2 bg-tkd-red rounded-full animate-pulse flex-shrink-0"></div>}
                        </button>
                    ))}
                </div>
            </div>

            <div className="min-h-[400px]">
                {activeTab === 'kicho' && <div className="animate-fade-in"><VistaMisionKicho /></div>}
                {activeTab === 'directorio' && renderDirectorio()}
                {activeTab === 'asistencia' && <div className="animate-fade-in"><VistaGestionClase /></div>}
                {activeTab === 'carnets' && <div className="animate-fade-in"><VistaCarnetizacion /></div>}
                {activeTab === 'certificados' && <div className="animate-fade-in"><VistaCertificaciones /></div>}
            </div>

            {modalFormularioAbierto && <FormularioEstudiante abierto={modalFormularioAbierto} onCerrar={cerrarFormulario} onGuardar={guardarEstudiante} estudianteActual={estudianteEnEdicion} cargando={cargandoAccion} />}
            {modalConfirmacionAbierto && estudianteAEliminar && <ModalConfirmacion abierto={modalConfirmacionAbierto} titulo="Baja de Estudiante" mensaje={`¿Confirmas dar de baja definitiva a ${estudianteAEliminar.nombres} ${estudianteAEliminar.apellidos}?`} onCerrar={cerrarConfirmacion} onConfirmar={confirmarEliminacion} cargando={cargandoAccion} />}
            {modalFirmaAbierto && firmaParaVer && <ModalVerFirma abierto={modalFirmaAbierto} onCerrar={cerrarModalFirma} firmaDigital={firmaParaVer.firma} nombreTutor={firmaParaVer.tutor} />}
            {modalImportMasivaAbierto && <ModalImportacionMasiva abierto={modalImportMasivaAbierto} onCerrar={() => setModalImportMasivaAbierto(false)} onExito={() => { setModalImportMasivaAbierto(false); cargarEstudiantes(); }} />}
        </div>
    );
};
