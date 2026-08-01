// vistas/LicenciaSuspendida.tsx
import React, { useEffect, useState } from 'react';
import { useEstadoLicencia } from '../hooks/useEstadoLicencia';
import { IconoLogoOficial, IconoGuardar, IconoInformacion, IconoWhatsApp } from '../components/Iconos';
import { formatearPrecio } from '../utils/formatters';
import { construirUrlCheckoutWompi } from '../servicios/wompiApi';
import { obtenerEstudiantes } from '../servicios/estudiantesApi';
import { calcularFacturacionMensual, esFacturable, type ResultadoFacturacion } from '../utils/facturacion';

// SDD pricing-cupo-real (Bloque 4b, tarea 4.11 -- "remove plan selection"): mismo criterio
// que vistas/PasarelaPagos.tsx -- sin planes fijos, el monto a pagar para reactivar es
// EXACTAMENTE el que calcularía el cobro automático mensual para este tenant en este
// momento, calculado EN VIVO con calcularFacturacionMensual (Bloque 2) alimentada por el
// conteo real de estudiantes facturables (obtenerEstudiantes + esFacturable, D3). Cero
// fórmula de precios nueva -- ver PasarelaPagos.tsx para el razonamiento completo.
const LicenciaSuspendida: React.FC = () => {
    const { diasRestantes, fechaVencimiento, diasGracia, configClub } = useEstadoLicencia();
    const [resultado, setResultado] = useState<ResultadoFacturacion | null>(null);
    const [cargandoMonto, setCargandoMonto] = useState(true);

    useEffect(() => {
        let cancelado = false;
        const calcularMontoActual = async () => {
            if (!configClub?.tenantId) {
                setCargandoMonto(false);
                return;
            }
            try {
                const estudiantes = await obtenerEstudiantes(configClub.tenantId);
                const estudiantesFacturables = estudiantes.filter(esFacturable).length;
                const calculado = calcularFacturacionMensual({
                    estudiantesFacturables,
                    sedesExtraContratadas: configClub.sedesExtraContratadas || 0,
                    equipoTecnicoExtraContratado: configClub.equipoTecnicoExtraContratado || 0,
                });
                if (!cancelado) setResultado(calculado);
            } catch (error) {
                console.error("Error al calcular el monto de renovación:", error);
            } finally {
                if (!cancelado) setCargandoMonto(false);
            }
        };
        calcularMontoActual();
        return () => { cancelado = true; };
    }, [configClub?.tenantId, configClub?.sedesExtraContratadas, configClub?.equipoTecnicoExtraContratado]);

    const handlePagarConWompi = async () => {
        if (!resultado) return;
        try {
            const urlRetorno = `${window.location.origin}/#/`;
            const urlWompi = await construirUrlCheckoutWompi({
                tenantId: configClub?.tenantId || 'TEST',
                itemType: 'alta',
                itemId: 'renovacion',
                periodo: 'mensual',
                montoEnPesos: resultado.totalPesos,
                redirectUrl: urlRetorno,
            });

            window.location.assign(urlWompi);
        } catch (error) {
            console.error("Error al iniciar pago:", error);
            alert("No se pudo iniciar el proceso de pago. Por favor intenta de nuevo.");
        }
    };

    return (
        <div className="fixed inset-0 z-[200] bg-tkd-dark flex items-center justify-center p-4 sm:p-8">
            {/* Fondo decorativo */}
            <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden">
                <IconoLogoOficial className="w-[1000px] h-[1000px] absolute -top-40 -left-40 rotate-12" />
            </div>

            <main className="relative z-10 w-full max-w-4xl bg-white dark:bg-gray-900 rounded-[3rem] shadow-2xl overflow-hidden border border-white/5 flex flex-col md:flex-row">
                {/* Sección Lateral: Detalles del Estado */}
                <div className="md:w-1/3 bg-tkd-red p-10 text-white flex flex-col justify-between">
                    <div>
                        <IconoInformacion className="w-12 h-12 mb-6" />
                        <h1 className="text-3xl font-black uppercase tracking-tighter leading-none">Acceso<br />Restringido</h1>
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] mt-4 opacity-70">Licencia de Uso Expirada</p>
                    </div>

                    <div className="space-y-6 mt-12 md:mt-0">
                        <div className="bg-black/20 p-4 rounded-2xl border border-white/10">
                            <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Fecha de Vencimiento</p>
                            <p className="text-xl font-black">{fechaVencimiento || '---'}</p>
                        </div>
                        <div className="bg-black/20 p-4 rounded-2xl border border-white/10">
                            <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Días de Mora</p>
                            <p className="text-xl font-black">{Math.abs(diasRestantes || 0)} días</p>
                        </div>
                    </div>

                    <div className="mt-8 pt-8 border-t border-white/10">
                        <p className="text-[10px] font-bold uppercase leading-relaxed text-white/80">
                            Para proteger la integridad de tus datos y la seguridad del Dojang, el acceso se suspende automáticamente tras {diasGracia} días de gracia sin registrar el pago.
                        </p>
                    </div>
                </div>

                {/* Sección Principal: Acción de Pago */}
                <div className="flex-1 p-10 md:p-16 flex flex-col justify-center space-y-10">
                    <div className="space-y-2">
                        <h2 className="text-4xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Renueva tu Suscripción</h2>
                        <p className="text-gray-400 font-bold uppercase text-[11px] tracking-widest">Activa instantáneamente el acceso a tu academia</p>
                    </div>

                    <div className="tkd-card dark:bg-white/5 border-2 border-tkd-blue/20 p-8 space-y-6 relative overflow-hidden group">
                        <div className="flex justify-between items-start relative z-10">
                            <div>
                                <p className="text-[10px] font-black text-tkd-blue uppercase tracking-widest mb-1">Monto a Pagar</p>
                                <h3 className="text-3xl font-black uppercase tracking-tighter">{configClub?.nombreClub || 'Tu Academia'}</h3>
                            </div>
                            <div className="text-right">
                                <p data-testid="monto-renovacion" className="text-3xl font-black text-tkd-blue">
                                    {cargandoMonto ? '...' : formatearPrecio(resultado?.totalPesos || 0)}
                                </p>
                                <p className="text-[9px] font-black text-gray-400 uppercase">Mensualidad recurrente</p>
                            </div>
                        </div>

                        <div className="absolute -right-10 -bottom-10 opacity-5 group-hover:scale-110 transition-transform">
                            <IconoLogoOficial className="w-40 h-40" />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <button
                            onClick={handlePagarConWompi}
                            disabled={cargandoMonto}
                            className="w-full bg-tkd-blue text-white py-6 rounded-3xl font-black uppercase text-sm tracking-[0.2em] shadow-2xl flex items-center justify-center gap-4 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <IconoGuardar className="w-6 h-6" /> Pagar & Activar Ahora
                        </button>

                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 pt-4">
                            <a
                                href="https://wa.me/573214567890"
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-2 text-[10px] font-black uppercase text-gray-400 hover:text-green-500 transition-colors"
                            >
                                <IconoWhatsApp className="w-4 h-4" /> Hablar con soporte técnico
                            </a>
                            <button
                                onClick={() => window.location.reload()}
                                className="text-[10px] font-black uppercase text-gray-400 hover:text-tkd-blue"
                            >
                                Ya realicé el pago, verificar de nuevo
                            </button>
                        </div>
                    </div>

                    <div className="pt-8 border-t dark:border-white/5">
                        <div className="flex items-center gap-4 grayscale opacity-30">
                            <img src="/img/wompi-logo.png" alt="Wompi" className="h-4" onError={(e) => { e.currentTarget.src = "https://wompi.com/assets/img/logos/wompi-logo-full.png"; }} />
                            <p className="text-[9px] font-bold text-gray-400 uppercase">Pagos seguros procesados por Wompi Colombia</p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default LicenciaSuspendida;
