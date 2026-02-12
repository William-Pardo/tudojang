
// context/DataContext.tsx
import React, { createContext, useState, useEffect, useCallback, useContext, ReactNode } from 'react';
import type {
    Usuario, Estudiante, Evento, Implemento, SolicitudCompra,
    MovimientoFinanciero, Sede, ConfiguracionNotificaciones, ConfiguracionClub,
    Programa
} from '../tipos';
import * as api from '../servicios/api';
import { useTenant } from '../components/BrandingProvider';
import { useAuth } from './AuthContext';
import { CONFIGURACION_CLUB_POR_DEFECTO } from '../constantes';

// --- CONFIGURACIÓN ---
interface ConfiguracionContextType {
    usuarios: Usuario[];
    configNotificaciones: ConfiguracionNotificaciones;
    configClub: ConfiguracionClub;
    cargando: boolean;
    error: string | null;
    guardarConfiguraciones: (confNotif: ConfiguracionNotificaciones, confClub: ConfiguracionClub) => Promise<void>;
    agregarUsuario: (datos: any) => Promise<Usuario | void>;
    actualizarUsuario: (datos: any, id: string) => Promise<Usuario | void>;
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
    agregarImplemento: (i: Omit<Implemento, 'id'>) => Promise<Implemento>;
    actualizarImplemento: (i: Implemento) => Promise<Implemento>;
    eliminarImplemento: (id: string) => Promise<void>;
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
    const { tenant, cargarTenant } = useTenant();
    const { usuario } = useAuth();

    const [usuarios, setUsuarios] = useState<Usuario[]>([]);
    const [configNotificaciones, setConfigNotificaciones] = useState<ConfiguracionNotificaciones>({
        tenantId: tenant?.tenantId || '',
        diaCobroMensual: 1,
        diasAnticipoRecordatorio: 5,
        diasGraciaSuspension: 10,
        frecuenciaSyncHoras: 24,
        frecuenciaQueryApiDias: 8
    });
    const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
    const [eventos, setEventos] = useState<Evento[]>([]);
    const [implementos, setImplementos] = useState<Implemento[]>([]);
    const [solicitudesCompra, setSolicitudesCompra] = useState<SolicitudCompra[]>([]);
    const [movimientos, setMovimientos] = useState<MovimientoFinanciero[]>([]);
    const [sedes, setSedes] = useState<Sede[]>([]);
    const [programas, setProgramas] = useState<Programa[]>([]);
    const [configClub, setConfigClub] = useState<ConfiguracionClub>(CONFIGURACION_CLUB_POR_DEFECTO);

    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // El ID de tenant prioritario es el del usuario logueado, sino el del branding (subdominio)
    const effectiveTenantId = usuario?.tenantId || tenant?.tenantId || '';

    const cargarTodo = useCallback(async () => {
        if (!effectiveTenantId) {
            // Silencioso si es la carga inicial sin identidad aún
            return;
        }

        console.log("[DataContext] Sincronizando datos para:", usuario?.tenantId ? `Usuario (${usuario.nombreUsuario})` : `Branding (${tenant?.nombreClub})`, `ID: ${effectiveTenantId}`);
        setCargando(true);
        setError(null);

        // Mecanismo de seguridad: Si la sincronización tarda más de 8 segundos, cancelamos para no colgar la UI
        const syncTimeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout de sincronización")), 8000)
        );

        try {
            const results = await Promise.race([
                Promise.allSettled([
                    api.obtenerUsuarios(effectiveTenantId),
                    api.obtenerConfiguracionNotificaciones(effectiveTenantId),
                    api.obtenerSedes(effectiveTenantId),
                    api.obtenerEstudiantes(effectiveTenantId),
                    api.obtenerEventos(effectiveTenantId),
                    api.obtenerImplementos(),
                    api.obtenerSolicitudesCompra(effectiveTenantId),
                    api.obtenerMovimientos(effectiveTenantId),
                    api.obtenerProgramas(effectiveTenantId),
                    api.obtenerConfiguracionClub(effectiveTenantId)
                ]),
                syncTimeout
            ]);

            if (Array.isArray(results)) {
                const values = results.map((res: any, i) => {
                    if (res.status === 'fulfilled') return res.value;
                    console.error(`[DataContext] Error en API index ${i}:`, res.reason);
                    return null;
                });

                const [u, cn, s, e, ev, imp, sc, m, pr, cc] = values;

                if (u) setUsuarios(u as Usuario[]);
                if (cn) setConfigNotificaciones(cn as ConfiguracionNotificaciones);
                if (s) setSedes(s as Sede[]);
                if (e) setEstudiantes(e as Estudiante[]);
                if (ev) setEventos(ev as Evento[]);
                if (imp) setImplementos(imp as Implemento[]);
                if (sc) setSolicitudesCompra(sc as SolicitudCompra[]);
                if (m) setMovimientos(m as MovimientoFinanciero[]);
                if (pr) setProgramas(pr as Programa[]);
                if (cc) setConfigClub(cc as ConfiguracionClub);
            }

        } catch (err) {
            console.error("[DataContext] Error o Timeout en sincronización:", err);
            setError("La sincronización tardó demasiado. Es posible que existan bloqueos de red o de base de datos.");
        } finally {
            console.log("[DataContext] Sincronización finalizada satisfactoriamente.");
            setCargando(false);
        }
    }, [tenant, usuario]);

    useEffect(() => {
        if (effectiveTenantId) {
            setUsuarios([]);
            setEstudiantes([]);
            setSedes([]);
            setEventos([]);
            setProgramas([]);
            setMovimientos([]);
            setSolicitudesCompra([]);
            cargarTodo();
        }
    }, [effectiveTenantId, cargarTodo]);

    return (
        <ConfiguracionContext.Provider value={{
            usuarios, configNotificaciones, configClub, cargando, error,
            guardarConfiguraciones: async (cn, cc) => {
                await api.guardarConfiguracionNotificaciones(cn);
                await api.guardarConfiguracionClub(cc);
                setConfigNotificaciones(cn);
                setConfigClub(cc);
                await cargarTenant(cc.tenantId); // Sincronizar el provider de marca con el ID real
            },
            agregarUsuario: async (d) => {
                // Validación SaaS: Límite de instructores/equipo técnico
                if (usuarios.length >= (configClub.limiteUsuarios || 0)) {
                    throw new Error(`Ha alcanzado el límite de personal (${configClub.limiteUsuarios}) para su plan actual.`);
                }
                d.tenantId = effectiveTenantId;
                const u = await api.agregarUsuario(d);
                setUsuarios(p => [...p, u]);
                return u;
            },
            actualizarUsuario: async (datos, id) => {
                const res = await api.actualizarUsuario(datos, id);
                if (res) setUsuarios(p => p.map(u => u.id === id ? res : u));
                return res;
            },
            eliminarUsuario: async (id) => {
                await api.eliminarUsuario(id);
                setUsuarios(p => p.filter(u => u.id !== id));
            },
            cargarConfiguracion: cargarTodo
        }}>
            <ProgramasContext.Provider value={{
                programas, cargando, error,
                cargarProgramas: cargarTodo,
                agregarPrograma: async (p) => { const res = await api.agregarPrograma({ ...p, tenantId: effectiveTenantId }); setProgramas(prev => [...prev, res]); return res; },
                actualizarPrograma: async (p) => { const res = await api.actualizarPrograma(p); setProgramas(prev => prev.map(item => item.id === p.id ? res : item)); return res; },
                eliminarPrograma: async (id) => { await api.eliminarPrograma(id); setProgramas(prev => prev.filter(item => item.id !== id)); }
            }}>
                <SedesContext.Provider value={{
                    sedes, cargando, error,
                    cargarSedes: cargarTodo,
                    agregarSede: async (s) => {
                        // Validación SaaS: Límite de sedes
                        if (sedes.length >= (configClub.limiteSedes || 0)) {
                            throw new Error(`Límite de Sedes alcanzado (${configClub.limiteSedes}).`);
                        }
                        const res = await api.agregarSede({ ...s, tenantId: effectiveTenantId });
                        setSedes(p => [...p, res]);
                        return res;
                    },
                    actualizarSede: async (s) => {
                        const res = await api.actualizarSede(s);
                        setSedes(p => p.map(item => item.id === s.id ? res : item));
                        return res;
                    },
                    eliminarSede: async (id) => {
                        await api.eliminarSede(id);
                        setSedes(p => p.filter(item => item.id !== id));
                    }
                }}>
                    <EstudiantesContext.Provider value={{
                        estudiantes, cargando, error, cargarEstudiantes: cargarTodo,
                        agregarEstudiante: async (datos) => {
                            // Validación SaaS: Límite de estudiantes
                            if (estudiantes.length >= (tenant?.limiteEstudiantes || 0)) {
                                throw new Error(`Ha alcanzado el límite de estudiantes (${tenant?.limiteEstudiantes}) para su plan actual.`);
                            }
                            const res = await api.agregarEstudiante({ ...datos, tenantId: tenant!.tenantId, carnetGenerado: false });
                            setEstudiantes(prev => [...prev, res]);
                            return res;
                        },
                        actualizarEstudiante: async (e) => {
                            const res = await api.actualizarEstudiante(e);
                            setEstudiantes(prev => prev.map(item => item.id === e.id ? res : item));
                            return res;
                        },
                        eliminarEstudiante: async (id) => {
                            await api.eliminarEstudiante(id);
                            setEstudiantes(p => p.filter(e => e.id !== id));
                        }
                    }}>
                        <EventosContext.Provider value={{
                            eventos, cargando, error, cargarEventos: cargarTodo, agregarEvento: async (e) => { const res = await api.agregarEvento({ ...e, tenantId: tenant!.tenantId }); setEventos(p => [...p, res]); return res; },
                            actualizarEvento: async (e) => {
                                const res = await api.actualizarEvento(e);
                                setEventos(prev => prev.map(item => item.id === e.id ? res : item));
                                return res;
                            },
                            eliminarEvento: async (id) => {
                                await api.eliminarEvento(id);
                                setEventos(p => p.filter(e => e.id !== id));
                            }
                        }}>
                            <TiendaContext.Provider value={{
                                implementos, solicitudesCompra, cargando, error,
                                cargarDatosTienda: cargarTodo,
                                registrarCompra: api.registrarCompra,
                                gestionarSolicitudCompra: api.gestionarSolicitudCompra,
                                agregarImplemento: async (i) => { const res = await api.agregarImplemento(i); setImplementos(p => [...p, res]); return res; },
                                actualizarImplemento: async (i) => { const res = await api.actualizarImplemento(i); setImplementos(p => p.map(item => item.id === i.id ? res : item)); return res; },
                                eliminarImplemento: async (id) => { await api.eliminarImplemento(id); setImplementos(p => p.filter(item => item.id !== id)); }
                            }}>
                                <FinanzasContext.Provider value={{
                                    movimientos, cargando, error, cargarMovimientos: cargarTodo,
                                    agregarMovimiento: async (m) => {
                                        const res = await api.agregarMovimiento({ ...m, tenantId: tenant!.tenantId });
                                        setMovimientos(p => [res, ...p]);
                                        return res;
                                    },
                                    actualizarMovimiento: async (m) => {
                                        const res = await api.actualizarMovimiento(m);
                                        setMovimientos(p => p.map(item => item.id === m.id ? res : item));
                                        return res;
                                    },
                                    eliminarMovimiento: async (id) => {
                                        await api.eliminarMovimiento(id);
                                        setMovimientos(p => p.filter(m => m.id !== id));
                                    }
                                }}>
                                    {children}
                                </FinanzasContext.Provider>
                            </TiendaContext.Provider>
                        </EventosContext.Provider>
                    </EstudiantesContext.Provider>
                </SedesContext.Provider>
            </ProgramasContext.Provider>
        </ConfiguracionContext.Provider>
    );
};

export const useConfiguracion = () => { const context = useContext(ConfiguracionContext); if (!context) throw new Error('useConfiguracion debe usarse dentro de DataProvider'); return context; };
export const useProgramas = () => { const context = useContext(ProgramasContext); if (!context) throw new Error('useProgramas debe usarse dentro de DataProvider'); return context; };
export const useEstudiantes = () => { const context = useContext(EstudiantesContext); if (!context) throw new Error('useEstudiantes debe usarse dentro de DataProvider'); return context; };
export const useEventos = () => { const context = useContext(EventosContext); if (!context) throw new Error('useEventos debe usarse dentro de DataProvider'); return context; };
export const useTienda = () => { const context = useContext(TiendaContext); if (!context) throw new Error('useTienda debe usarse dentro de DataProvider'); return context; };
export const useFinanzas = () => { const context = useContext(FinanzasContext); if (!context) throw new Error('useFinanzas debe usarse dentro de DataProvider'); return context; };
export const useSedes = () => { const context = useContext(SedesContext); if (!context) throw new Error('useSedes debe usarse dentro de DataProvider'); return context; };
