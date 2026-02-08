
// context/DataContext.tsx
import React, { createContext, useState, useEffect, useCallback, useContext, ReactNode } from 'react';
import type {
    Usuario, Estudiante, Evento, Implemento, SolicitudCompra,
    MovimientoFinanciero, Sede, ConfiguracionNotificaciones, ConfiguracionClub,
    Programa
} from '../tipos';
import * as api from '../servicios/api';
import { useTenant } from '../components/BrandingProvider';

// --- CONFIGURACIÓN ---
interface ConfiguracionContextType {
    usuarios: Usuario[];
    configNotificaciones: ConfiguracionNotificaciones;
    configClub: ConfiguracionClub;
    cargando: boolean;
    error: string | null;
    guardarConfiguraciones: (confNotif: ConfiguracionNotificaciones, confClub: ConfiguracionClub) => Promise<void>;
    agregarUsuario: (datos: any) => Promise<void>;
    actualizarUsuario: (datos: any, id: string) => Promise<void>;
    eliminarUsuario: (id: string) => Promise<void>;
    cargarConfiguracion: () => Promise<void>;
}
const ConfiguracionContext = createContext<ConfiguracionContextType | undefined>(undefined);

// --- PROGRAMAS ---
interface ProgramasContextType {
    programas: Programa[];
    cargando: boolean;
    error: string | null;
    cargarProgramas: () => Promise<void>;
    agregarPrograma: (p: Omit<Programa, 'id'>) => Promise<Programa>;
    actualizarPrograma: (p: Programa) => Promise<Programa>;
    eliminarPrograma: (id: string) => Promise<void>;
}
const ProgramasContext = createContext<ProgramasContextType | undefined>(undefined);

// --- ESTUDIANTES ---
interface EstudiantesContextType {
    estudiantes: Estudiante[];
    cargando: boolean;
    error: string | null;
    cargarEstudiantes: () => Promise<void>;
    agregarEstudiante: (e: Omit<Estudiante, 'id' | 'historialPagos' | 'carnetGenerado'>) => Promise<Estudiante>;
    actualizarEstudiante: (e: Estudiante) => Promise<Estudiante>;
    eliminarEstudiante: (id: string) => Promise<void>;
}
const EstudiantesContext = createContext<EstudiantesContextType | undefined>(undefined);

// --- EVENTOS ---
interface EventosContextType {
    eventos: Evento[];
    cargando: boolean;
    error: string | null;
    cargarEventos: () => Promise<void>;
    agregarEvento: (e: Omit<Evento, 'id'>) => Promise<Evento>;
    actualizarEvento: (e: Evento) => Promise<Evento>;
    eliminarEvento: (id: string) => Promise<void>;
}
const EventosContext = createContext<EventosContextType | undefined>(undefined);

// --- TIENDA ---
interface TiendaContextType {
    implementos: Implemento[];
    solicitudesCompra: SolicitudCompra[];
    cargando: boolean;
    error: string | null;
    cargarDatosTienda: () => Promise<void>;
    registrarCompra: (idEstudiante: string, implemento: Implemento, variacion: any) => Promise<Estudiante>;
    gestionarSolicitudCompra: (idSolicitud: string, nuevoEstado: any) => Promise<Estudiante | null>;
}
const TiendaContext = createContext<TiendaContextType | undefined>(undefined);

// --- FINANZAS ---
interface FinanzasContextType {
    movimientos: MovimientoFinanciero[];
    cargando: boolean;
    error: string | null;
    cargarMovimientos: (sedeId?: string) => Promise<void>;
    agregarMovimiento: (m: Omit<MovimientoFinanciero, 'id'>) => Promise<MovimientoFinanciero>;
    actualizarMovimiento: (m: MovimientoFinanciero) => Promise<MovimientoFinanciero>;
    eliminarMovimiento: (id: string) => Promise<void>;
}
const FinanzasContext = createContext<FinanzasContextType | undefined>(undefined);

// --- SEDES ---
interface SedesContextType {
    sedes: Sede[];
    cargando: boolean;
    error: string | null;
    cargarSedes: () => Promise<void>;
    agregarSede: (s: Omit<Sede, 'id'>) => Promise<Sede>;
    actualizarSede: (s: Sede) => Promise<Sede>;
    eliminarSede: (id: string) => Promise<void>;
}
const SedesContext = createContext<SedesContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { tenant } = useTenant();

    const [usuarios, setUsuarios] = useState<Usuario[]>([]);
    const [configNotificaciones, setConfigNotificaciones] = useState<ConfiguracionNotificaciones>({} as any);
    const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
    const [eventos, setEventos] = useState<Evento[]>([]);
    const [implementos, setImplementos] = useState<Implemento[]>([]);
    const [solicitudesCompra, setSolicitudesCompra] = useState<SolicitudCompra[]>([]);
    const [movimientos, setMovimientos] = useState<MovimientoFinanciero[]>([]);
    const [sedes, setSedes] = useState<Sede[]>([]);
    const [programas, setProgramas] = useState<Programa[]>([]);

    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const cargarTodo = useCallback(async () => {
        if (!tenant) return;
        setCargando(true);
        try {
            const [u, cn, s, e, ev, imp, sc, m, pr] = await Promise.all([
                api.obtenerUsuarios(tenant.tenantId),
                api.obtenerConfiguracionNotificaciones(tenant.tenantId),
                api.obtenerSedes(tenant.tenantId),
                api.obtenerEstudiantes(tenant.tenantId),
                api.obtenerEventos(tenant.tenantId),
                api.obtenerImplementos(tenant.tenantId),
                api.obtenerSolicitudesCompra(tenant.tenantId),
                api.obtenerMovimientos(tenant.tenantId),
                api.obtenerProgramas(tenant.tenantId)
            ]);
            setUsuarios(u);
            setConfigNotificaciones(cn);
            setSedes(s);
            setEstudiantes(e);
            setEventos(ev);
            setImplementos(imp);
            setSolicitudesCompra(sc);
            setMovimientos(m);
            setProgramas(pr);
        } catch (err) {
            console.error("Error al sincronizar datos:", err);
            setError("Error al sincronizar datos de la academia.");
        } finally {
            setCargando(false);
        }
    }, [tenant]);

    useEffect(() => {
        cargarTodo();
    }, [cargarTodo]);

    const cargarMovimientos = useCallback(async (sedeId?: string) => {
        if (!tenant) return;
        setCargando(true);
        try {
            const m = await api.obtenerMovimientos(tenant.tenantId, sedeId);
            setMovimientos(m);
        } catch (e) {
            setError("Error cargando finanzas");
        } finally {
            setCargando(false);
        }
    }, [tenant]);

    return (
        <ConfiguracionContext.Provider value={{
            usuarios, configNotificaciones, configClub: tenant!, cargando, error,
            guardarConfiguraciones: useCallback(async (cn: any, cc: any) => {
                await api.guardarConfiguracionNotificaciones(cn);
                await api.guardarConfiguracionClub(cc);
                setConfigNotificaciones(cn);
            }, []),
            agregarUsuario: useCallback(async (d: any) => { d.tenantId = tenant!.tenantId; const u = await api.agregarUsuario(d); setUsuarios(p => [...p, u]); }, [tenant]),
            actualizarUsuario: useCallback(async (d: any, id: string) => { await api.actualizarUsuario(d, id); setUsuarios(p => p.map(u => u.id === id ? { ...u, ...d } : u)); }, []),
            eliminarUsuario: useCallback(async (id: string) => { await api.eliminarUsuario(id); setUsuarios(p => p.filter(u => u.id !== id)); }, []),
            cargarConfiguracion: cargarTodo
        }}>
            <ProgramasContext.Provider value={{
                programas, cargando, error,
                cargarProgramas: cargarTodo,
                agregarPrograma: useCallback(async (p: any) => { const res = await api.agregarPrograma({ ...p, tenantId: tenant!.tenantId }); setProgramas(prev => [...prev, res]); return res; }, [tenant]),
                actualizarPrograma: useCallback(async (p: any) => { const res = await api.actualizarPrograma(p); setProgramas(prev => prev.map(item => item.id === p.id ? res : item)); return res; }, []),
                eliminarPrograma: useCallback(async (id: string) => { await api.eliminarPrograma(id); setProgramas(prev => prev.filter(item => item.id !== id)); }, [])
            }}>
                <SedesContext.Provider value={{ sedes, cargando, error, cargarSedes: cargarTodo, agregarSede: useCallback(async (s: any) => { const res = await api.agregarSede({ ...s, tenantId: tenant!.tenantId }); setSedes(p => [...p, res]); return res; }, [tenant]), actualizarSede: api.actualizarSede, eliminarSede: api.eliminarSede }}>
                    <EstudiantesContext.Provider value={{ estudiantes, cargando, error, cargarEstudiantes: cargarTodo, agregarEstudiante: useCallback(async (datos: any) => { const res = await api.agregarEstudiante({ ...datos, tenantId: tenant!.tenantId, carnetGenerado: false }); setEstudiantes(prev => [...prev, res]); return res; }, [tenant]), actualizarEstudiante: useCallback(async (e: any) => { const res = await api.actualizarEstudiante(e); setEstudiantes(prev => prev.map(item => item.id === e.id ? res : item)); return res; }, []), eliminarEstudiante: api.eliminarEstudiante }}>
                        <EventosContext.Provider value={{ eventos, cargando, error, cargarEventos: cargarTodo, agregarEvento: useCallback(async (e: any) => { const res = await api.agregarEvento({ ...e, tenantId: tenant!.tenantId }); setEventos(p => [...p, res]); return res; }, [tenant]), actualizarEvento: api.actualizarEvento, eliminarEvento: api.eliminarEvento }}>
                            <TiendaContext.Provider value={{ implementos, solicitudesCompra, cargando, error, cargarDatosTienda: cargarTodo, registrarCompra: api.registrarCompra, gestionarSolicitudCompra: api.gestionarSolicitudCompra }}>
                                <FinanzasContext.Provider value={{ movimientos, cargando, error, cargarMovimientos, agregarMovimiento: useCallback(async (m: any) => { const res = await api.agregarMovimiento({ ...m, tenantId: tenant!.tenantId }); setMovimientos(p => [res, ...p]); return res; }, [tenant]), actualizarMovimiento: api.actualizarMovimiento, eliminarMovimiento: api.eliminarMovimiento }}>
                                    {children}
                                </FinanzasContext.Provider>
                            </TiendaContext.Provider>
                        </EventosContext.Provider>
                    </EstudiantesContext.Provider>
                </SedesContext.Provider>
            </ProgramasContext.Provider>
        </ConfiguracionContext.Provider >
    );
};

export const useConfiguracion = () => { const context = useContext(ConfiguracionContext); if (!context) throw new Error('useConfiguracion debe usarse dentro de DataProvider'); return context; };
export const useProgramas = () => { const context = useContext(ProgramasContext); if (!context) throw new Error('useProgramas debe usarse dentro de DataProvider'); return context; };
export const useEstudiantes = () => { const context = useContext(EstudiantesContext); if (!context) throw new Error('useEstudiantes debe usarse dentro de DataProvider'); return context; };
export const useEventos = () => { const context = useContext(EventosContext); if (!context) throw new Error('useEventos debe usarse dentro de DataProvider'); return context; };
export const useTienda = () => { const context = useContext(TiendaContext); if (!context) throw new Error('useTienda debe usarse dentro de DataProvider'); return context; };
export const useFinanzas = () => { const context = useContext(FinanzasContext); if (!context) throw new Error('useFinanzas debe usarse dentro de DataProvider'); return context; };
export const useSedes = () => { const context = useContext(SedesContext); if (!context) throw new Error('useSedes debe usarse dentro de DataProvider'); return context; };
