
// vistas/PasarelaPagos.tsx
import React, { useEffect, useState } from 'react';
import { useTenant } from '../components/BrandingProvider';
import { formatearPrecio } from '../utils/formatters';
import { IconoAprobar } from '../components/Iconos';
import LogoDinamico from '../components/LogoDinamico';
import { construirUrlCheckoutWompi } from '../servicios/wompiApi';
import { obtenerEstudiantes } from '../servicios/estudiantesApi';
import { calcularFacturacionMensual, esFacturable, type ResultadoFacturacion } from '../utils/facturacion';

// SDD pricing-cupo-real (Bloque 4b, tarea 4.11 -- "remove plan selection"): sin planes
// fijos, no hay un precio que seleccionar -- el monto a pagar para reactivar es EXACTAMENTE
// el que calcularía el cobro automático mensual para este tenant en este momento. Esta
// vista se renderiza DENTRO de BrandingProvider, ANTES de que monte DataProvider
// (components/BrandingProvider.tsx, estado==='vencido'), así que no puede reusar
// useEstudiantes()/useConfiguracion() vía contexto -- usa la misma
// obtenerEstudiantes(tenantId) standalone que ya expone servicios/estudiantesApi.ts,
// filtrada por esFacturable (D3) y alimentada a calcularFacturacionMensual (Bloque 2, misma
// función que usa functions/wompiCobroAutomatico.js -- spec precio-publico-calculadora:
// "Calculadora y cobro coinciden"). Cero fórmula de precios nueva.
const VistaPasarelaPagos: React.FC = () => {
    const { tenant } = useTenant();
    const [resultado, setResultado] = useState<ResultadoFacturacion | null>(null);
    const [cargandoMonto, setCargandoMonto] = useState(true);

    useEffect(() => {
        let cancelado = false;
        const calcularMontoActual = async () => {
            if (!tenant?.tenantId) {
                setCargandoMonto(false);
                return;
            }
            try {
                const estudiantes = await obtenerEstudiantes(tenant.tenantId);
                const estudiantesFacturables = estudiantes.filter(esFacturable).length;
                const calculado = calcularFacturacionMensual({
                    estudiantesFacturables,
                    sedesExtraContratadas: tenant.sedesExtraContratadas || 0,
                    equipoTecnicoExtraContratado: tenant.equipoTecnicoExtraContratado || 0,
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
    }, [tenant?.tenantId, tenant?.sedesExtraContratadas, tenant?.equipoTecnicoExtraContratado]);

    const irAWompi = async () => {
        if (!resultado) return;

        const urlWompi = await construirUrlCheckoutWompi({
            tenantId: tenant?.tenantId || 'TEST',
            itemType: 'alta',
            itemId: 'renovacion',
            periodo: 'mensual',
            montoEnPesos: resultado.totalPesos,
            redirectUrl: `${window.location.origin}/#/aliant-control`,
        });

        window.location.href = urlWompi;
    };

    return (
        <div className="min-h-screen bg-white text-tkd-dark font-sans selection:bg-tkd-blue selection:text-white">
            {/* HEADER TUDOJANG CON BRANDING */}
            <header className="py-12 text-center space-y-4">
                <div className="flex justify-center mb-2">
                    <div className="bg-gray-50 p-4 rounded-[2rem] shadow-inner border border-gray-100">
                        <LogoDinamico className="w-16 h-16" />
                    </div>
                </div>
                <div>
                    <h1 className="text-5xl font-black text-tkd-blue tracking-tighter mb-1">TUDOJANG</h1>
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-400">
                        {tenant?.nombreClub || 'Gestión Técnica Profesional'}
                    </p>
                </div>
            </header>

            <div className="max-w-2xl mx-auto px-6 pb-20 space-y-8">
                {/* MONTO EN VIVO Y ACCIÓN */}
                <div className="bg-tkd-dark text-white p-10 rounded-[3.5rem] shadow-2xl space-y-6">
                    <div className="flex justify-between items-end border-b border-white/10 pb-6">
                        <div className="text-left">
                            <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">Renovación de Suscripción:</p>
                            <h4 className="text-2xl font-black uppercase text-tkd-red tracking-tighter">
                                {tenant?.nombreClub || 'Tu Academia'}
                            </h4>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">Monto a Pagar (mes actual):</p>
                            <p data-testid="monto-renovacion" className="text-4xl font-black">
                                {cargandoMonto ? '...' : formatearPrecio(resultado?.totalPesos || 0)}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={irAWompi}
                        disabled={cargandoMonto}
                        className="w-full bg-tkd-red hover:bg-red-700 text-white py-6 rounded-[2rem] font-black uppercase tracking-[0.2em] text-sm shadow-xl transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-4 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <IconoAprobar className="w-6 h-6" />
                        Pagar y Activar Ahora
                    </button>

                    {/* MÉTODOS DE PAGO */}
                    <div className="space-y-4">
                        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-500">MÉTODOS DE PAGO SEGURO HABILITADOS</p>
                        <div className="flex flex-wrap justify-center items-center gap-6 opacity-60">
                            <span className="text-[10px] font-black bg-white/5 px-3 py-1 rounded-lg border border-white/10">NEQUI</span>
                            <span className="text-[10px] font-black bg-white/5 px-3 py-1 rounded-lg border border-white/10">DAVIPLATA</span>
                            <span className="text-[10px] font-black bg-white/5 px-3 py-1 rounded-lg border border-white/10">BRE-B</span>
                            <span className="text-[10px] font-black bg-white/5 px-3 py-1 rounded-lg border border-white/10">PSE / TODOS LOS BANCOS</span>
                            <span className="text-[10px] font-black bg-white/5 px-3 py-1 rounded-lg border border-white/10">TARJETAS CRÉDITO</span>
                        </div>
                    </div>
                </div>

                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-relaxed text-center">
                    Transacción procesada por Wompi Colombia. <br />
                    Tu cuenta será reactivada instantáneamente tras la confirmación del banco.
                </p>
            </div>

            <footer className="text-center pb-10">
                <div className="flex items-center justify-center gap-4 text-gray-300 opacity-50">
                    <div className="h-px w-12 bg-gray-200"></div>
                    <p className="text-[9px] font-black uppercase tracking-[0.5em]">Aliant • Tudojang SaaS Core</p>
                    <div className="h-px w-12 bg-gray-200"></div>
                </div>
            </footer>
        </div>
    );
};

export default VistaPasarelaPagos;
