
// components/BrandingProvider.tsx
import React, { useEffect, useState, createContext, useContext } from 'react';
import { useSearchParams } from 'react-router-dom';
import { buscarTenantPorSlug, obtenerConfiguracionClub } from '../servicios/configuracionApi';
import type { ConfiguracionClub } from '../tipos';
import { CONFIGURACION_CLUB_POR_DEFECTO } from '../constantes';
import Loader from './Loader';
import { IconoAlertaTriangulo } from './Iconos';
import VistaPasarelaPagos from '../vistas/PasarelaPagos';
import { useAuth } from '../context/AuthContext';
import { usePwaInstallBranding } from '../hooks/usePwaInstallBranding';

interface TenantContextType {
    tenant: ConfiguracionClub | null;
    estaCargado: boolean;
    cargarTenant: () => Promise<void>;
    actualizarTenantLocal: (config: ConfiguracionClub) => void;
}

const TenantContext = createContext<TenantContextType>({
    tenant: null,
    estaCargado: false,
    cargarTenant: async () => { },
    actualizarTenantLocal: () => { }
});

const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { usuario } = useAuth();
    const [searchParams] = useSearchParams();
    const clubParam = searchParams.get('club');
    const [tenant, setTenant] = useState<ConfiguracionClub | null>(null);
    const [estado, setEstado] = useState<'cargando' | 'error' | 'vencido' | 'ok'>('cargando');
    const [bypassDev, setBypassDev] = useState(false);
    const [mensajeError, setMensajeError] = useState('');

    const cargarTenant = async () => {
        const fixtureCypress = typeof window !== 'undefined' && (window as any).Cypress
            ? (window as any).__TUDOJANG_E2E_TENANT__
            : null;

        if (fixtureCypress) {
            const config = {
                ...(CONFIGURACION_CLUB_POR_DEFECTO as ConfiguracionClub),
                ...fixtureCypress,
                onboardingStep: fixtureCypress.onboardingStep ?? 5,
            } as ConfiguracionClub;
            aplicarEstilos(config);
            setTenant(config);
            setEstado('ok');
            return;
        }

        // PRIORIDAD SAAS: Si hay un usuario autenticado, usamos SU configuración
        if (usuario?.tenantId) {
            try {
                const config = await obtenerConfiguracionClub(usuario.tenantId);
                aplicarEstilos(config);
                validarSuscripcion(config);
                return;
            } catch (err) {
                console.error("[BrandingProvider] Error cargando config por usuario:", err);
                // Si falla, seguimos con la lógica de slug como fallback
            }
        }

        // Fix de raiz (2026-08-10): un link publico (censo, evento, firma, inscripcion,
        // reportar-pago...) puede traer ?club=slug para identificar el tenant explicitamente,
        // sin depender de subdominio -- imprescindible porque un visitante anonimo que abre el
        // link desde el dominio raiz (tudojang.com, sin subdominio propio del club) no tiene
        // forma de que el host resuelva el tenant. Se evalua ANTES del atajo de "dominio raiz ->
        // tenant generico" de abajo, para que CUALQUIER ruta publica que agregue este parametro
        // quede resuelta correctamente sin necesitar su propia logica de bypass duplicada (antes
        // vivia solo en CensoPublico.tsx, arreglando un unico sintoma en vez de la causa).
        // No se llama a validarSuscripcion(): un aspirante anonimo llenando un formulario
        // publico no debe toparse con la pantalla de "Suscripción Vencida" del tenant -- ese
        // aviso es para el Admin logueado, no para quien apenas se esta registrando.
        if (clubParam) {
            try {
                const config = await buscarTenantPorSlug(clubParam);
                if (config) {
                    aplicarEstilos(config);
                    setTenant(config);
                    setEstado('ok');
                } else {
                    setEstado('error');
                    setMensajeError(`Academia "${clubParam}" no registrada.`);
                }
            } catch (e) {
                setEstado('error');
                setMensajeError("Error de conexión.");
            }
            return;
        }

        const host = window.location.hostname;
        let slug = host.split('.')[0];
        const isRoot = host.includes('tudojang.com') || host.includes('web.app') || host.includes('firebaseapp.com') || host === 'localhost' || host === '127.0.0.1';

        if (isRoot && (slug === 'tudojang' || slug === 'www' || slug === 'localhost' || slug === '127')) {
            setTenant(CONFIGURACION_CLUB_POR_DEFECTO as ConfiguracionClub);
            aplicarEstilos(CONFIGURACION_CLUB_POR_DEFECTO as ConfiguracionClub);
            setEstado('ok');
            return;
        }

        try {
            const config = await buscarTenantPorSlug(slug);
            if (!config) {
                setEstado('error');
                setMensajeError(`Academia "${slug}" no registrada.`);
                return;
            }
            aplicarEstilos(config);
            validarSuscripcion(config);
        } catch (e) {
            setEstado('error');
            setMensajeError("Error de conexión.");
        }
    };

    const aplicarEstilos = (config: ConfiguracionClub) => {
        if (!config) return;
        const p = (!config.colorPrimario || config.colorPrimario === '#000000') ? '#111111' : config.colorPrimario;
        const s = (!config.colorSecundario || config.colorSecundario === '#000000') ? '#0047A0' : config.colorSecundario;
        const a = (!config.colorAcento || config.colorAcento === '#000000') ? '#CD2E3A' : config.colorAcento;

        document.documentElement.style.setProperty('--color-primario', p);
        document.documentElement.style.setProperty('--color-secundario', s);
        document.documentElement.style.setProperty('--color-acento', a);
    };

    // Actualiza el tenant en memoria con datos que el cliente YA tiene (recién guardados por
    // guardarConfiguracionClub), sin volver a pegarle a Firestore. Antes, guardar el logo/
    // colores llamaba a cargarTenant() completo -- eso re-fetchea todo el tenant y cambia la
    // identidad del objeto `tenant`, lo que reactiva el useEffect de sincronización de
    // DataContext (deps [tenant, usuario?.rol]) mientras el estado todavía se está
    // reacomodando, produciendo una ráfaga de "Missing or insufficient permissions" transitorios
    // en sedes/tienda hasta que la sincronización se re-establece sola un instante después. No
    // hace falta red: guardarConfiguracionClub ya escribió exactamente este mismo objeto.
    // No se toca `estado` (cargando/error/vencido/ok) -- guardar branding no cambia la
    // suscripción, revalidarla acá sería trabajo de más sobre datos que no cambiaron.
    const actualizarTenantLocal = (config: ConfiguracionClub) => {
        aplicarEstilos(config);
        setTenant(config);
    };

    const validarSuscripcion = (config: ConfiguracionClub) => {
        const hoy = new Date();
        const vencimiento = new Date(config.fechaVencimiento);

        if (config.estadoSuscripcion === 'suspendido' || vencimiento < hoy) {
            setEstado('vencido');
            setMensajeError(`Suscripción expirada.`);
        } else {
            setEstado('ok');
        }
        setTenant(config);
    };

    useEffect(() => {
        cargarTenant();
    }, [usuario?.tenantId, clubParam]);

    // Mantiene el ícono/nombre que iOS y Chrome usan al instalar el PWA sincronizados con el
    // tenant resuelto arriba (post-login o vía ?club=slug). Debe llamarse sin condicionar en
    // `estado` para respetar las reglas de hooks (los early returns de abajo son posteriores).
    usePwaInstallBranding(tenant);

    if (estado === 'cargando') return <div className="h-screen flex items-center justify-center bg-tkd-dark"><Loader texto="Sincronizando..." /></div>;

    if (estado === 'error') return (
        <div className="h-screen flex flex-col items-center justify-center bg-tkd-dark p-6 text-center">
            <IconoAlertaTriangulo className="w-16 h-16 text-red-500 mb-4" />
            <h1 className="text-white font-black uppercase">Escuela No Encontrada</h1>
            <p className="text-gray-400">{mensajeError}</p>
        </div>
    );

    // MODO SUSCRIPCIÓN VENCIDA: Fondo Blanco Forzado
    if (estado === 'vencido' && !bypassDev) {
        return (
            <TenantContext.Provider value={{ tenant, estaCargado: true, cargarTenant, actualizarTenantLocal }}>
                <div className="min-h-screen bg-white dark:bg-tkd-dark flex flex-col">
                    <div className="bg-tkd-red text-white py-2 px-4 flex justify-between items-center z-[100] shadow-md">
                        <div className="flex items-center gap-2">
                            <IconoAlertaTriangulo className="w-4 h-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Aviso del Sistema: Suscripción Vencida o Cuenta Suspendida</span>
                        </div>
                        <button
                            onClick={() => setBypassDev(true)}
                            className="bg-white/20 hover:bg-white/40 px-3 py-1 rounded text-[9px] font-black uppercase transition-all"
                        >
                            Omitir para Desarrollo (Debug)
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        <VistaPasarelaPagos />
                    </div>
                </div>
            </TenantContext.Provider>
        );
    }

    return (
        <TenantContext.Provider value={{ tenant, estaCargado: true, cargarTenant, actualizarTenantLocal }}>
            {children}
            {bypassDev && (
                <div className="fixed bottom-4 left-4 z-[200] bg-orange-500 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase shadow-lg animate-bounce">
                    Development Bypass Active
                </div>
            )}
        </TenantContext.Provider>
    );
};

export const useTenant = () => useContext(TenantContext);
export default BrandingProvider;
