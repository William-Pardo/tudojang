
// context/DataContext.tsx
import React, { createContext, useState, useEffect, useCallback, useContext, ReactNode, useMemo } from 'react';
import type {
    Usuario, Estudiante, Evento, Implemento, SolicitudCompra,
    MovimientoFinanciero, Sede, ConfiguracionNotificaciones, ConfiguracionClub,
    Programa, BloqueHorario
} from '../tipos';
import { RolUsuario } from '../tipos';
import * as api from '../servicios/api';
import { useTenant } from '../components/BrandingProvider';
import { useAuth } from './AuthContext';
import { CONFIGURACION_CLUB_POR_DEFECTO } from '../constantes';
import { sanearSedes, getSedesVisibles, getTotalSedesActivas } from '../utils/dataIntegrity'; // Importar saneamiento y funciones de sedes

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
    agendaCompleta: BloqueHorario[];
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
    // SDD pricing-cupo-real (Bloque 4): conecta la UI a los writers de estadoMatricula ya
    // implementados y probados en el Bloque 1 (servicios/estudiantesApi.ts) -- retiro
    // explícito, sin borrado físico (matricula-estado-estudiante).
    retirarEstudiante: (id: string) => Promise<void>;
    reactivarEstudiante: (id: string) => Promise<void>;
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
    sedesVisibles: Sede[];  // Sede Principal + Sedes Adicionales activas
    totalSedesActivas: number;  // 1 (Principal) + N (Adicionales activas)
    cargando: boolean;
    error: string | null;
    cargarSedes: () => Promise<void>;
    agregarSede: (s: Omit<Sede, 'id'>) => Promise<Sede>;
    actualizarSede: (s: Sede) => Promise<Sede>;
    eliminarSede: (id: string) => Promise<void>;
}
const SedesContext = createContext<SedesContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { tenant, actualizarTenantLocal } = useTenant();
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

    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const cargarTodo = useCallback(async () => {
        // Si no hay tenant o es el temporal, marcamos cargando pero no ejecutamos sync aún
        // Esto permite que BrandingProvider termine su trabajo primero.
        if (!tenant || tenant.tenantId === 'PLATFORM_INIT_PENDING') {
            console.log("[DataContext] Esperando identificación de Tenant real...");
            setCargando(true);
            return;
        }

        // Fix tutor-role-end-to-end (2026-07-14): Tutor Y Estudiante son consultores — misma
        // carga acotada (sin colecciones instructor-only, evita permission-denied spam).
        const isTutor = usuario?.rol === RolUsuario.Tutor || usuario?.rol === RolUsuario.Estudiante;
        console.log("[DataContext] Iniciando sincronización para:", tenant.nombreClub, `(ID: ${tenant.tenantId}) | Rol: ${usuario?.rol || 'desconocido'}`);
        setCargando(true);
        setError(null);

        // Mecanismo de seguridad: Si la sincronización tarda más de 8 segundos, cancelamos para no colgar la UI
        const syncTimeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout de sincronización")), 8000)
        );

        try {
            // FASE 7: Bifurcación por rol. Tutor NO carga colecciones instructor-only
            const results = await Promise.race([
                Promise.allSettled(
                    isTutor
                        ? [
                            // Tutor (consultor): tenant data + Tienda (implementos) + Eventos,
                            // sin colecciones staff (usuarios/sedes/estudiantes).
                            api.obtenerConfiguracionNotificaciones(tenant.tenantId),
                            api.obtenerImplementos(),
                            api.obtenerSolicitudesCompra(tenant.tenantId),
                            api.obtenerMovimientos(tenant.tenantId),
                            api.obtenerProgramas(tenant.tenantId),
                            api.obtenerEventos(tenant.tenantId)
                        ]
                        : [
                            // Admin/Instructor/otros: cargar TODO (behavior anterior)
                            api.obtenerUsuarios(tenant.tenantId),
                            api.obtenerConfiguracionNotificaciones(tenant.tenantId),
                            api.obtenerSedes(tenant.tenantId).then(sanearSedes),
                            api.obtenerEstudiantes(tenant.tenantId),
                            api.obtenerEventos(tenant.tenantId),
                            api.obtenerImplementos(),
                            api.obtenerSolicitudesCompra(tenant.tenantId),
                            api.obtenerMovimientos(tenant.tenantId),
                            api.obtenerProgramas(tenant.tenantId)
                        ]
                ),
                syncTimeout
            ]);

            if (Array.isArray(results)) {
                const values = results.map((res: any, i) => {
                    if (res.status === 'fulfilled') return res.value;
                    console.error(`[DataContext] Error en API index ${i}:`, res.reason);
                    return null;
                });

                if (isTutor) {
                    // Tutor: índices son [cn, imp, sc, m, pr, ev]
                    const [cn, imp, sc, m, pr, ev] = values;
                    if (cn) setConfigNotificaciones(cn as ConfiguracionNotificaciones);
                    if (imp) setImplementos(imp as Implemento[]);
                    if (sc) setSolicitudesCompra(sc as SolicitudCompra[]);
                    if (m) setMovimientos(m as MovimientoFinanciero[]);
                    if (pr) setProgramas(pr as Programa[]);
                    if (ev) setEventos(ev as Evento[]);
                    console.log("[DataContext] Tutor: cargadas configuración, implementos, solicitudes, movimientos, programas y eventos.");
                } else {
                    // Otros: índices son [u, cn, s, e, ev, imp, sc, m, pr]
                    const [u, cn, s, e, ev, imp, sc, m, pr] = values;
                    if (u) setUsuarios(u as Usuario[]);
                    if (cn) setConfigNotificaciones(cn as ConfiguracionNotificaciones);
                    if (s) setSedes(s as Sede[]);
                    if (e) setEstudiantes(e as Estudiante[]);
                    if (ev) setEventos(ev as Evento[]);
                    if (imp) setImplementos(imp as Implemento[]);
                    if (sc) setSolicitudesCompra(sc as SolicitudCompra[]);
                    if (m) setMovimientos(m as MovimientoFinanciero[]);
                    if (pr) setProgramas(pr as Programa[]);
                }
            }

        } catch (err) {
            console.error("[DataContext] Error o Timeout en sincronización:", err);
            setError("La sincronización tardó demasiado. Es posible que existan bloqueos de red o de base de datos.");
        } finally {
            console.log("[DataContext] Sincronización finalizada satisfactoriamente o por timeout.");
            setCargando(false);
        }
    }, [tenant, usuario?.rol]);

    useEffect(() => {
        cargarTodo();
    }, [cargarTodo]);

    return (
        <ConfiguracionContext.Provider value={{
            usuarios, configNotificaciones, configClub: tenant || CONFIGURACION_CLUB_POR_DEFECTO as ConfiguracionClub, cargando, error,
            guardarConfiguraciones: async (cn, cc) => {
                await api.guardarConfiguracionNotificaciones(cn);
                await api.guardarConfiguracionClub(cc);
                setConfigNotificaciones(cn);
                // Fix (2026-08-31): antes esto llamaba a cargarTenant() completo (re-fetch a
                // Firestore) para que el logo/colores cambiaran inmediatamente. `cc` YA es el
                // objeto recién guardado -- pedirlo de nuevo por red no trae nada distinto, y
                // el cambio de identidad del objeto `tenant` reactivaba el useEffect de
                // sincronización de este mismo contexto (deps [tenant, usuario?.rol]) mientras
                // el estado todavía se estaba reacomodando, produciendo una ráfaga de
                // "Missing or insufficient permissions" transitorios en sedes/tienda que se
                // resolvían solos un instante después (bug reportado: "guarda pero al final
                // sale un error"). Actualizar localmente evita el round-trip Y el race.
                console.log("[DataContext] Configuración guardada, refrescando branding localmente...");
                actualizarTenantLocal(cc);
            },
            agregarUsuario: async (d) => {
                const currentTenant = tenant || CONFIGURACION_CLUB_POR_DEFECTO;
                d.tenantId = currentTenant.tenantId;
                const u = await api.agregarUsuario(d);
                setUsuarios(p => [...p, u]);
                return u;
            },
            actualizarUsuario: api.actualizarUsuario,
            eliminarUsuario: async (id) => { await api.eliminarUsuario(id); setUsuarios(prev => prev.filter(u => u.id !== id)); },
            cargarConfiguracion: cargarTodo
        }}>
            <ProgramasContext.Provider value={{
                programas,
                agendaCompleta: useMemo(() => {
                    return programas.flatMap(p => (p.bloquesHorarios || []).map(b => ({ ...b, nombrePrograma: p.nombre, programaId: p.id })));
                }, [programas]),
                cargando, error,
                cargarProgramas: cargarTodo,
                agregarPrograma: async (p) => {
                    if (!tenant) throw new Error("Acción bloqueada: Identificación de escuela pendiente.");
                    const res = await api.agregarPrograma({ ...p, tenantId: tenant.tenantId });
                    setProgramas(prev => [...prev, res]);
                    return res;
                },
                actualizarPrograma: async (p) => { const res = await api.actualizarPrograma(p); setProgramas(prev => prev.map(item => item.id === p.id ? res : item)); return res; },
                eliminarPrograma: async (id) => { await api.eliminarPrograma(id); setProgramas(prev => prev.filter(item => item.id !== id)); }
            }}>
                <SedesContext.Provider value={{
                    sedes,
                    sedesVisibles: getSedesVisibles(tenant || null, sedes),
                    totalSedesActivas: getTotalSedesActivas(tenant || null, sedes),
                    cargando, error, cargarSedes: cargarTodo,
                    agregarSede: async (s) => {
                        if (!tenant) throw new Error("Acción bloqueada: Identificación de escuela pendiente.");
                        const res = await api.agregarSede({ ...s, tenantId: tenant.tenantId });
                        setSedes(p => [...p, res]);
                        return res;
                    },
                    actualizarSede: async (s) => {
                        const res = await api.actualizarSede(s);
                        setSedes(prev => prev.map(item => item.id === res.id ? res : item));
                        return res;
                    },
                    eliminarSede: async (id) => { await api.eliminarSede(id); setSedes(prev => prev.filter(s => s.id !== id)); }
                }}>
                    <EstudiantesContext.Provider value={{
                        estudiantes, cargando, error, cargarEstudiantes: cargarTodo,
                        agregarEstudiante: async (datos) => {
                            if (!tenant || tenant.tenantId === 'platform-default') throw new Error("Acción bloqueada: Identificación de escuela pendiente.");
                            const res = await api.agregarEstudiante({ ...datos, tenantId: tenant.tenantId, carnetGenerado: false });
                            setEstudiantes(prev => [...prev, res]);
                            return res;
                        },
                        actualizarEstudiante: async (e) => { const res = await api.actualizarEstudiante(e); setEstudiantes(prev => prev.map(item => item.id === e.id ? res : item)); return res; },
                        eliminarEstudiante: async (id) => { await api.eliminarEstudiante(id); setEstudiantes(prev => prev.filter(e => e.id !== id)); },
                        retirarEstudiante: async (id) => {
                            await api.retirarEstudiante(id);
                            setEstudiantes(prev => prev.map(e => e.id === id ? { ...e, estadoMatricula: 'retirado', fechaRetiro: new Date().toISOString() } : e));
                        },
                        reactivarEstudiante: async (id) => {
                            await api.reactivarEstudiante(id);
                            setEstudiantes(prev => prev.map(e => e.id === id ? { ...e, estadoMatricula: 'activo', fechaReactivacion: new Date().toISOString() } : e));
                        }
                    }}>
                        <EventosContext.Provider value={{
                            eventos, cargando, error, cargarEventos: cargarTodo,
                            agregarEvento: async (e) => {
                                if (!tenant) throw new Error("Acción bloqueada: Identificación de escuela pendiente.");
                                const res = await api.agregarEvento({ ...e, tenantId: tenant.tenantId });
                                setEventos(p => [...p, res]);
                                return res;
                            },
                            actualizarEvento: api.actualizarEvento,
                            eliminarEvento: async (id) => { await api.eliminarEvento(id); setEventos(prev => prev.filter(e => e.id !== id)); }
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
                                    movimientos, cargando, error, cargarMovimientos: useCallback(async (sedeId?: string) => {
                                        setCargando(true);
                                        try {
                                            const m = await api.obtenerMovimientos(tenant?.tenantId, sedeId);
                                            setMovimientos(m);
                                        } catch (err) {
                                            console.error("Error al cargar movimientos:", err);
                                            setError("Error al cargar movimientos.");
                                        } finally {
                                            setCargando(false);
                                        }
                                    }, [tenant]),
                                    agregarMovimiento: async (m) => {
                                        if (!tenant) throw new Error("Acción bloqueada: Identificación de escuela pendiente.");
                                        const res = await api.agregarMovimiento({ ...m, tenantId: tenant.tenantId });
                                        setMovimientos(p => [res, ...p]);
                                        return res;
                                    },
                                    actualizarMovimiento: api.actualizarMovimiento,
                                    eliminarMovimiento: async (id) => { await api.eliminarMovimiento(id); setMovimientos(prev => prev.filter(m => m.id !== id)); }
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
