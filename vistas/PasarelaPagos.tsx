
// vistas/PasarelaPagos.tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTenant } from '../components/BrandingProvider';
import { PLANES_SAAS } from '../constantes';
import { formatearPrecio } from '../utils/formatters';
import { IconoAprobar, IconoEstudiantes, IconoUsuario, IconoCasa } from '../components/Iconos';
import LogoDinamico from '../components/LogoDinamico';
import { abrirCheckoutWompi } from '../servicios/wompiService';

const VistaPasarelaPagos: React.FC = () => {
    const { tenant } = useTenant();
    const [periodoAnual, setPeriodoAnual] = useState(true);
    const [planSeleccionado, setPlanSeleccionado] = useState<'starter' | 'growth' | 'pro'>(tenant?.plan as any || 'growth');

    const irAWompi = async () => {
        const planObj = (PLANES_SAAS as any)[planSeleccionado];
        const mesesACobrar = periodoAnual ? 10 : 1;
        const montoBase = planObj.precio * mesesACobrar;
        const montoEnCentavos = montoBase * 100;

        const periodoStr = periodoAnual ? 'ANUAL' : 'MENSUAL';
        const referenciaTecnica = `SUSC_${planSeleccionado.toUpperCase()}_${periodoStr}_${tenant?.tenantId}_${Date.now()}`;

        await abrirCheckoutWompi({
            referencia: referenciaTecnica,
            montoEnCentavos: montoEnCentavos,
            email: tenant?.emailClub || '',
            nombreCompleto: tenant?.nombreClub || '',
            telefono: tenant?.pagoNequi || '', // Usamos el cel de contacto si no hay otro
            redirectUrl: `${window.location.origin}/#/aliant-control`
        });
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

            <div className="max-w-6xl mx-auto px-6 pb-20 space-y-12">
                {/* SELECTOR DE PERIODO */}
                <div className="flex flex-col items-center gap-4">
                    <div className="bg-gray-100 p-1.5 rounded-2xl flex items-center shadow-inner">
                        <button
                            onClick={() => setPeriodoAnual(false)}
                            className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!periodoAnual ? 'bg-white text-tkd-blue shadow-md scale-105' : 'text-gray-400'}`}
                        >
                            Mensual
                        </button>
                        <button
                            onClick={() => setPeriodoAnual(true)}
                            className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${periodoAnual ? 'bg-white text-tkd-blue shadow-md scale-105' : 'text-gray-400'}`}
                        >
                            Anual (Ahorra 2 Meses)
                        </button>
                    </div>
                    <AnimatePresence>
                        {periodoAnual && (
                            <motion.span
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest"
                            >
                                ¡Bonificación por pago anual activada!
                            </motion.span>
                        )}
                    </AnimatePresence>
                </div>

                {/* GRID DE PLANES */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Added comment above fix: explicitly cast plan as any to fix 'unknown' property access errors. */}
                    {Object.values(PLANES_SAAS).map((plan: any) => (
                        <motion.div
                            key={plan.id}
                            whileHover={{ y: -10 }}
                            onClick={() => setPlanSeleccionado(plan.id as any)}
                            className={`cursor-pointer rounded-[3rem] p-8 border-4 transition-all relative flex flex-col ${planSeleccionado === plan.id
                                    ? 'border-tkd-blue bg-white shadow-2xl z-10'
                                    : 'border-gray-50 bg-gray-50 opacity-60 hover:opacity-100'
                                }`}
                        >
                            {plan.popular && (
                                <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-tkd-red text-white px-6 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg">
                                    Recomendado
                                </span>
                            )}

                            <div className="mb-8">
                                <h3 className="text-xl font-black uppercase tracking-tight mb-2">{plan.nombre}</h3>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-3xl font-black text-tkd-blue">
                                        {formatearPrecio(periodoAnual ? plan.precio * 10 : plan.precio)}
                                    </span>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase">
                                        /{periodoAnual ? 'año' : 'mes'}
                                    </span>
                                </div>
                            </div>

                            <ul className="space-y-4 flex-grow mb-10 text-[11px] font-bold uppercase text-gray-600">
                                <li className="flex items-center gap-3">
                                    <IconoEstudiantes className="w-4 h-4 text-tkd-blue" /> Hasta {plan.limiteEstudiantes} Alumnos
                                </li>
                                <li className="flex items-center gap-3">
                                    <IconoUsuario className="w-4 h-4 text-tkd-blue" /> {plan.limiteUsuarios} Miembros Equipo
                                </li>
                                <li className="flex items-center gap-3">
                                    <IconoCasa className="w-4 h-4 text-tkd-blue" /> {plan.limiteSedes} Sedes / Dojangs
                                </li>
                                <div className="h-px bg-gray-200/50 my-2"></div>
                                {plan.caracteristicas.slice(3).map((c: string, i: number) => (
                                    <li key={i} className="flex items-center gap-3 text-[9px] text-gray-400">
                                        <IconoAprobar className="w-3.5 h-3.5 text-green-500" /> {c}
                                    </li>
                                ))}
                            </ul>

                            <div className={`mt-auto w-8 h-8 rounded-full border-2 mx-auto flex items-center justify-center transition-all ${planSeleccionado === plan.id ? 'border-tkd-blue bg-tkd-blue shadow-lg' : 'border-gray-300'
                                }`}>
                                {planSeleccionado === plan.id && <IconoAprobar className="w-5 h-5 text-white" />}
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* BOTÓN DE ACCIÓN Y TRUST BADGES */}
                <div className="max-w-2xl mx-auto pt-10 text-center space-y-8">
                    <div className="bg-tkd-dark text-white p-10 rounded-[3.5rem] shadow-2xl space-y-6">
                        <div className="flex justify-between items-end border-b border-white/10 pb-6">
                            <div className="text-left">
                                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">Activación de Licencia:</p>
                                <h4 className="text-2xl font-black uppercase text-tkd-red tracking-tighter">
                                    {planSeleccionado} {periodoAnual ? '(Plan Anual)' : '(Mes Individual)'}
                                </h4>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">Total a Pagar:</p>
                                <AnimatePresence mode="wait">
                                    <motion.p
                                        key={planSeleccionado + periodoAnual}
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="text-4xl font-black"
                                    >
                                        {formatearPrecio((PLANES_SAAS as any)[planSeleccionado].precio * (periodoAnual ? 10 : 1))}
                                    </motion.p>
                                </AnimatePresence>
                            </div>
                        </div>

                        <button
                            onClick={irAWompi}
                            className="w-full bg-tkd-red hover:bg-red-700 text-white py-6 rounded-[2rem] font-black uppercase tracking-[0.2em] text-sm shadow-xl transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-4"
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

                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-relaxed">
                        Transacción procesada por Wompi Colombia. <br />
                        Tu cuenta será reactivada instantáneamente tras la confirmación del banco.
                    </p>
                </div>
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
