// vistas/BuzonNotificaciones.tsx
// Buzón de notificaciones para consultores (Tutor / Estudiante). Solo lectura + marcar leída.
// Fix tutor-role-end-to-end (2026-07-14): el consultor recibe en cola las notificaciones de
// su(s) estudiante(s) (pagos, avances, eventos, bienvenida...) y las lee acá.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { RolUsuario, TipoNotificacion, type NotificacionHistorial } from '../tipos';
import { formatearFecha } from '../utils/formatters';
import { resolveStudentsForConsultor } from '../servicios/academico/tutorStudentResolver';
import {
    obtenerNotificacionesPorEstudiantes,
    marcarNotificacionComoLeida,
} from '../servicios/notificacionesApi';
import { IconoCampana } from '../components/Iconos';
import { useConfiguracion } from '../context/DataContext';
import MediosPagoResumen from '../components/MediosPagoResumen';
import type { MarcadorSoporte } from '../shared/soporte/tipos';

// Marcador vivo del catalogo de soporte (openspec/changes/catalogo-soporte-marcadores-vivos):
// migrado 1:1 desde `shared/soporte/catalogo.v1.ts` (entry `buzon.consultor`). `introducedIn`
// lo estampa el generador desde `catalogVersion` -- ver `MarcadorSoporte` en shared/soporte/tipos.ts.
export const soporteMeta: MarcadorSoporte[] = [
    {
        id: 'buzon.consultor',
        inventoryId: 'buzon.consultor',
        module: 'buzon',
        label: 'Buzón de notificaciones (Tutor/Estudiante)',
        intent: 'Orientar sobre buzón de notificaciones (tutor/estudiante).',
        aliases: ['buzon de notificaciones', 'mis notificaciones', 'notificaciones de pago', 'marcar como leida'],
        actions: ['consultar', 'marcar'],
        negativeTerms: [],
        roles: ['Tutor', 'Estudiante'],
        steps: ['Abre el buzón desde el menú lateral.', 'Revisa notificaciones de pagos, avances y eventos.', 'Márcalas como leídas.'],
        route: '/buzon',
        sensitivity: 'internal',
        escalationReason: 'Escalar si la pantalla, los permisos o los datos no coinciden con estos pasos.',
        sourceFiles: ['vistas/BuzonNotificaciones.tsx'],
        authorizationRef: 'Visibilidad de UI inventariada; autorización backend/reglas no verificada.',
        owner: 'Producto y Soporte Tudojang',
        lastVerifiedAt: '2026-07-30',
        status: 'active',
    },
];

const VistaBuzonNotificaciones: React.FC = () => {
    const { usuario } = useAuth();
    const { configClub } = useConfiguracion();
    const [notificaciones, setNotificaciones] = useState<NotificacionHistorial[]>([]);
    const [cargando, setCargando] = useState(true);

    const esTutor = usuario?.rol === RolUsuario.Tutor;

    const cargar = useCallback(async () => {
        if (!usuario?.tenantId || !usuario?.email) {
            setCargando(false);
            return;
        }
        setCargando(true);
        try {
            const estudiantes = await resolveStudentsForConsultor(usuario.tenantId, usuario.email, esTutor);
            const ids = estudiantes.map((e) => e.id);
            const notis = await obtenerNotificacionesPorEstudiantes(ids, usuario.tenantId);
            setNotificaciones(notis);
        } catch (err) {
            console.error('Error cargando buzón de notificaciones:', err);
        } finally {
            setCargando(false);
        }
    }, [usuario?.tenantId, usuario?.email, esTutor]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    const noLeidas = useMemo(() => notificaciones.filter((n) => !n.leida).length, [notificaciones]);

    const tienePagoPendiente = useMemo(
        () => notificaciones.some((n) => n.tipo === TipoNotificacion.RecordatorioPago || n.tipo === TipoNotificacion.AvisoVencimiento),
        [notificaciones]
    );

    const marcarLeida = async (id: string) => {
        // Optimista: marcamos en UI y persistimos.
        setNotificaciones((prev) => prev.map((n) => (n.id === id ? { ...n, leida: true } : n)));
        try {
            await marcarNotificacionComoLeida(id);
        } catch (err) {
            console.error('No se pudo marcar como leída:', err);
        }
    };

    return (
        <div className="p-4 sm:p-8 space-y-6 animate-fade-in pb-20">
            <header className="flex items-center gap-4">
                <div className="p-3 bg-tkd-blue/10 rounded-2xl text-tkd-blue">
                    <IconoCampana className="w-6 h-6" />
                </div>
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight leading-none">Notificaciones</h1>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mt-2">
                        {noLeidas > 0 ? `${noLeidas} sin leer` : 'Todo al día'}
                        {esTutor ? ' · avisos de tu hijo' : ' · tus avisos'}
                    </p>
                </div>
            </header>

            {tienePagoPendiente &&
                (configClub?.pagoNequi || configClub?.pagoDaviplata || configClub?.pagoBreB || configClub?.pagoBanco) && (
                <div className="rounded-[2rem] border border-amber-100 dark:border-amber-800/30 bg-amber-50 dark:bg-amber-900/10 p-6 space-y-3">
                    <p className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-400 tracking-widest">Medios de Pago Disponibles</p>
                    <MediosPagoResumen
                        pagoNequi={configClub?.pagoNequi}
                        pagoDaviplata={configClub?.pagoDaviplata}
                        pagoBreB={configClub?.pagoBreB}
                        pagoBanco={configClub?.pagoBanco}
                    />
                </div>
            )}

            {cargando ? (
                <div className="rounded-[2rem] border border-gray-100 dark:border-white/10 p-8 text-sm text-gray-400">Cargando notificaciones...</div>
            ) : notificaciones.length === 0 ? (
                <div className="rounded-[2rem] border border-dashed border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 p-10 text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-tkd-red">Buzón vacío</p>
                    <h3 className="mt-3 text-2xl font-black uppercase text-tkd-dark dark:text-white">No tienes notificaciones</h3>
                    <p className="mt-3 text-sm font-bold text-gray-400">
                        Acá aparecerán los avisos sobre pagos, avances y eventos del estudiante.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {notificaciones.map((n) => (
                        <div
                            key={n.id}
                            className={`rounded-2xl border p-5 flex items-start justify-between gap-4 transition-all ${
                                n.leida
                                    ? 'bg-white dark:bg-gray-900 border-gray-100 dark:border-white/10'
                                    : 'bg-blue-50/60 dark:bg-blue-900/10 border-tkd-blue/30'
                            }`}
                        >
                            <div className="min-w-0 space-y-1">
                                <div className="flex items-center gap-2">
                                    {!n.leida && <span className="w-2 h-2 rounded-full bg-tkd-blue shrink-0" />}
                                    <span className="text-[9px] font-black uppercase tracking-widest text-tkd-blue">{n.tipo}</span>
                                    <span className="text-[9px] font-bold text-gray-400">· {formatearFecha(n.fecha)}</span>
                                </div>
                                <p className={`text-sm ${n.leida ? 'font-medium text-gray-500 dark:text-gray-400' : 'font-bold text-gray-900 dark:text-white'}`}>
                                    {n.mensaje}
                                </p>
                                {n.estudianteNombre && (
                                    <p className="text-[9px] font-bold text-gray-400 uppercase">Estudiante: {n.estudianteNombre}</p>
                                )}
                            </div>
                            {!n.leida && (
                                <button
                                    onClick={() => marcarLeida(n.id)}
                                    className="shrink-0 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase text-tkd-blue border border-tkd-blue/30 hover:bg-tkd-blue/10 transition-colors"
                                >
                                    Marcar leída
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default VistaBuzonNotificaciones;
