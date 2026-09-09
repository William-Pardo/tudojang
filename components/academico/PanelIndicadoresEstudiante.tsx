
// components/academico/PanelIndicadoresEstudiante.tsx
// UI de "Indicadores de Estudiante" (analítica determinística SIN IA, ver
// functions/academico/indicadoresEstudiante.js). Lista los hallazgos SIN resolver, agrupados
// por tipo (riesgo primero, luego fidelización): esta pantalla solo EXPONE datos ya calculados
// server-side -- nunca decide nada por el Admin, solo le da la info para que él decida.
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotificacion } from '../../context/NotificacionContext';
import { useEstudiantes } from '../../context/DataContext';
import { obtenerIndicadoresPendientes, resolverHallazgo } from '../../servicios/academico/indicadoresEstudianteApi';
import { HallazgoIndicador } from '../../tipos';
import { IconoAlertaTriangulo, IconoCertificado, IconoAprobar, IconoUsuario } from '../Iconos';

interface HallazgoConEstudiante extends HallazgoIndicador {
    estudianteId: string;
}

// Bug real (review-readability, 2026-09-08): `hallazgo.id` (formato tipo-fecha) es único
// SOLO dentro del documento de un estudiante -- cuando el cron detecta el mismo patrón el
// mismo día para dos estudiantes distintos (caso normal, no un borde raro), ambos hallazgos
// terminan con el mismo id en esta lista aplanada de TODOS los estudiantes del tenant.
// Resolver el de uno filtraba también el del otro de la vista, y ambos compartían la misma
// nota en el textarea. La clave real siempre es el PAR (estudianteId, hallazgo.id).
const claveCompuesta = (h: { estudianteId: string; id: string }) => `${h.estudianteId}::${h.id}`;

const ETIQUETA_TIPO: Record<HallazgoIndicador['tipo'], string> = {
    riesgo_desercion: 'Riesgo de Deserción',
    candidato_fidelizacion: 'Candidato a Fidelización',
};

// Colores por combinación tipo+severidad -- 'alta' en riesgo es una alerta (rojo), 'alta' en
// fidelización es una buena noticia (verde): la severidad sola no define el color, el tipo sí.
function estiloSeveridad(tipo: HallazgoIndicador['tipo'], severidad: HallazgoIndicador['severidad']): string {
    if (tipo === 'candidato_fidelizacion') {
        return severidad === 'alta'
            ? 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400'
            : 'bg-blue-100 text-tkd-blue dark:bg-blue-500/10 dark:text-blue-400';
    }
    return severidad === 'alta'
        ? 'bg-red-100 text-tkd-red dark:bg-red-500/10 dark:text-red-400'
        : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400';
}

// "hace N días" a partir de una fecha ISO -- sin librería extra, esta pantalla es la única que
// lo necesita hoy.
function formatearHaceTiempo(fechaIso: string): string {
    const dias = Math.floor((Date.now() - new Date(fechaIso).getTime()) / (1000 * 60 * 60 * 24));
    if (dias <= 0) return 'Hoy';
    if (dias === 1) return 'Ayer';
    if (dias < 30) return `Hace ${dias} días`;
    const meses = Math.floor(dias / 30);
    return meses === 1 ? 'Hace 1 mes' : `Hace ${meses} meses`;
}

const PanelIndicadoresEstudiante: React.FC = () => {
    const { usuario } = useAuth();
    const { estudiantes } = useEstudiantes();
    const { mostrarNotificacion } = useNotificacion();
    const [hallazgos, setHallazgos] = useState<HallazgoConEstudiante[]>([]);
    const [cargando, setCargando] = useState(true);
    const [procesando, setProcesando] = useState<string | null>(null);
    const [notas, setNotas] = useState<Record<string, string>>({});

    const cargarIndicadores = async () => {
        if (!usuario) return;
        try {
            const indicadores = await obtenerIndicadoresPendientes(usuario.tenantId);
            const plano = indicadores.flatMap((indicador) =>
                indicador.hallazgos
                    .filter((h) => !h.resuelto)
                    .map((h) => ({ ...h, estudianteId: indicador.estudianteId }))
            );
            setHallazgos(plano);
        } catch (e) {
            console.error('[PanelIndicadoresEstudiante] Error al cargar indicadores:', e);
            mostrarNotificacion('Error al cargar los indicadores de estudiantes.', 'error');
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => { cargarIndicadores(); }, [usuario]);

    const nombreEstudiante = (estudianteId: string) => {
        const est = estudiantes.find((e) => e.id === estudianteId);
        return est ? `${est.nombres} ${est.apellidos}` : 'Estudiante';
    };

    // Riesgo primero, luego fidelización (punto 5 del diseño); dentro de cada grupo, el
    // detectado hace más tiempo primero -- es el que lleva más días esperando revisión.
    const hallazgosOrdenados = useMemo(() => {
        const orden: Record<HallazgoIndicador['tipo'], number> = { riesgo_desercion: 0, candidato_fidelizacion: 1 };
        return [...hallazgos].sort((a, b) => {
            if (orden[a.tipo] !== orden[b.tipo]) return orden[a.tipo] - orden[b.tipo];
            return new Date(a.fechaDeteccion).getTime() - new Date(b.fechaDeteccion).getTime();
        });
    }, [hallazgos]);

    const handleResolver = async (hallazgo: HallazgoConEstudiante) => {
        if (!usuario) return;
        const clave = claveCompuesta(hallazgo);
        setProcesando(clave);
        try {
            await resolverHallazgo(usuario.tenantId, hallazgo.estudianteId, hallazgo.id, notas[clave]);
            mostrarNotificacion('Hallazgo marcado como resuelto.', 'success');
            setHallazgos((prev) => prev.filter((h) => claveCompuesta(h) !== clave));
            setNotas((prev) => {
                const next = { ...prev };
                delete next[clave];
                return next;
            });
        } catch (e) {
            mostrarNotificacion('Error al resolver el hallazgo.', 'error');
        } finally {
            setProcesando(null);
        }
    };

    if (cargando) {
        return <div className="p-10 text-center text-gray-400 font-black uppercase text-xs animate-pulse">Analizando Indicadores...</div>;
    }

    if (hallazgosOrdenados.length === 0) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-[3rem] p-20 text-center space-y-4 border border-gray-100 dark:border-white/5 shadow-soft">
                <div className="w-16 h-16 bg-gray-50 dark:bg-gray-900 rounded-full flex items-center justify-center mx-auto opacity-40">
                    <IconoAprobar className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight text-gray-900 dark:text-white">Sin Hallazgos Pendientes</h3>
                <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">No hay patrones de riesgo ni candidatos a fidelización sin revisar.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {hallazgosOrdenados.map((hallazgo) => {
                    const esRiesgo = hallazgo.tipo === 'riesgo_desercion';
                    const claveHallazgo = claveCompuesta(hallazgo);
                    return (
                        <div
                            key={claveHallazgo}
                            className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-soft p-8 space-y-5"
                        >
                            <div className="flex justify-between items-start gap-4">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-full bg-gray-50 dark:bg-gray-900 flex items-center justify-center flex-shrink-0">
                                        <IconoUsuario className="w-5 h-5 text-gray-400" />
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="text-base font-black uppercase tracking-tight text-gray-900 dark:text-white truncate">
                                            {nombreEstudiante(hallazgo.estudianteId)}
                                        </h4>
                                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                                            {formatearHaceTiempo(hallazgo.fechaDeteccion)}
                                        </p>
                                    </div>
                                </div>
                                <span className={`flex-shrink-0 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full ${estiloSeveridad(hallazgo.tipo, hallazgo.severidad)}`}>
                                    {hallazgo.severidad}
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                {esRiesgo
                                    ? <IconoAlertaTriangulo className="w-4 h-4 text-tkd-red flex-shrink-0" />
                                    : <IconoCertificado className="w-4 h-4 text-tkd-blue flex-shrink-0" />}
                                <p className={`text-[10px] font-black uppercase tracking-widest ${esRiesgo ? 'text-tkd-red' : 'text-tkd-blue'}`}>
                                    {ETIQUETA_TIPO[hallazgo.tipo]}
                                </p>
                            </div>

                            {/* Métricas exactas que dispararon el hallazgo -- auditable, no una caja negra */}
                            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4 grid grid-cols-2 gap-3">
                                {Object.entries(hallazgo.metricas).map(([clave, valor]) => (
                                    <div key={clave} className="min-w-0">
                                        <p className="text-[8px] font-bold text-gray-400 uppercase truncate">{clave}</p>
                                        <p className="text-[11px] font-black dark:text-white">{valor}</p>
                                    </div>
                                ))}
                            </div>

                            <textarea
                                value={notas[claveHallazgo] || ''}
                                onChange={(e) => setNotas((prev) => ({ ...prev, [claveHallazgo]: e.target.value }))}
                                placeholder="Nota opcional (ej. qué se acordó con la familia)..."
                                className="w-full text-[11px] font-medium bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-white/5 rounded-2xl p-4 resize-none focus:outline-none focus:ring-2 focus:ring-tkd-blue/30 dark:text-white"
                                rows={2}
                            />

                            <button
                                onClick={() => handleResolver(hallazgo)}
                                disabled={!!procesando}
                                className="w-full py-4 bg-tkd-blue text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-blue-800 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {procesando === claveHallazgo
                                    ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    : <IconoAprobar className="w-4 h-4" />}
                                Marcar como resuelto
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default PanelIndicadoresEstudiante;
