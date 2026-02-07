import React, { useEffect } from 'react';
import { IconoLogoOficial, IconoAprobar, IconoWhatsApp, IconoFirma, IconoCampana, IconoCasa, IconoUsuario, IconoEstudiantes } from '../components/Iconos';
import { PLANES_SAAS } from '../constantes';
import { formatearPrecio } from '../utils/formatters';
import { guardarCookie } from '../utils/cookieUtils';

const PublicLanding: React.FC = () => {
    useEffect(() => {
        console.log("%c >>> TUDOJANG: VERSIÓN DE EMERGENCIA ACTIVA <<< ", "background: red; color: white; font-size: 24px; font-weight: bold;");
    }, []);

    return (
        <div className="min-h-screen bg-white text-tkd-dark font-sans selection:bg-tkd-blue selection:text-white overflow-x-hidden">
            <style>{`
                .btn-core {
                    position: relative !important;
                    z-index: 9999 !important;
                    pointer-events: auto !important;
                    cursor: pointer !important;
                }
                .btn-core:active {
                    transform: scale(0.95);
                }
            `}</style>

            {/* NAVBAR */}
            <nav className="fixed top-0 w-full z-[100] bg-white/90 backdrop-blur-md border-b border-gray-100 py-4 px-6 sm:px-12 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <IconoLogoOficial className="w-10 h-10 text-tkd-blue" />
                    <span className="font-black text-xl tracking-tighter uppercase italic">Tudojang</span>
                </div>
                <div className="hidden md:flex items-center gap-8 text-[10px] font-black uppercase tracking-widest text-gray-500">
                    <a href="#caracteristicas" className="hover:text-tkd-blue transition-colors">Características</a>
                    <a href="#tarifas" className="hover:text-tkd-blue transition-colors">Tarifas</a>
                    <a href="#kicho" className="hover:text-tkd-blue transition-colors">Misión Kicho</a>
                </div>
                <a
                    href="#/registro"
                    className="btn-core bg-tkd-dark text-white px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-tkd-blue transition-all inline-block"
                >
                    Registrar Academia
                </a>
            </nav>

            {/* HERO */}
            <section className="relative pt-32 pb-20 px-6 sm:px-12">
                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                    <div className="space-y-8">
                        <div className="inline-block bg-tkd-blue/10 text-tkd-blue px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">
                            Software de Gestión para Líderes de Artes Marciales
                        </div>
                        <h1 className="text-6xl md:text-7xl font-black uppercase tracking-tighter leading-[0.9]">
                            Automatice su Cobranza y <span className="text-tkd-blue">Proteja su Academia</span>
                        </h1>
                        <p className="text-lg text-gray-500 font-medium uppercase leading-relaxed max-w-md">
                            Delegue la gestión operativa y legal en Tudojang. La única plataforma en Colombia que automatiza sus cobros por WhatsApp y formaliza sus matrículas con firma digital válida.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <a
                                href="https://wa.me/573007654321?text=Deseo%20una%20consultoría%20para%20implementar%20Tudojang"
                                className="btn-core bg-tkd-red text-white px-10 py-5 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-[0_20px_40px_-10px_rgba(205,46,58,0.4)] hover:scale-105 transition-all text-center"
                            >
                                Ver Tudojang en Acción (Consultoría Gratuita)
                            </a>
                            <a
                                href="#/registro"
                                className="btn-core bg-white border-2 border-gray-100 text-tkd-dark px-10 py-5 rounded-2xl font-black uppercase text-xs tracking-widest hover:border-tkd-blue transition-all text-center"
                            >
                                Probar 7 días sin costo
                            </a>
                        </div>
                    </div>

                    <div className="relative">
                        <div className="bg-gray-100 rounded-[3rem] aspect-square lg:aspect-video flex items-center justify-center p-12 shadow-inner border border-gray-200">
                            <IconoLogoOficial className="w-64 h-64 opacity-10" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="mb-8 flex justify-center">
                                    <div className="bg-white/80 backdrop-blur-xl p-8 rounded-[3rem] shadow-2xl border-4 border-white/50">
                                        <IconoLogoOficial className="w-32 sm:w-40" />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="absolute -top-10 -right-10 bg-green-500 text-white p-6 rounded-3xl shadow-2xl">
                            <IconoWhatsApp className="w-8 h-8" />
                        </div>
                        <div className="absolute -bottom-5 -left-10 bg-tkd-dark text-white p-6 rounded-3xl shadow-2xl">
                            <IconoFirma className="w-8 h-8" />
                        </div>
                    </div>
                </div>
            </section>

            {/* SECCIÓN CARACTERÍSTICAS */}
            <section id="caracteristicas" className="py-24 bg-gray-50 px-6 sm:px-12">
                <div className="max-w-7xl mx-auto space-y-20">
                    <div className="text-center space-y-4">
                        <h2 className="text-4xl font-black uppercase tracking-tighter">Potencia tu Ecosistema</h2>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em]">3 Pilares de Crecimiento Técnico</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                        {[
                            { icon: IconoWhatsApp, title: "Cobranza sin Fricción", text: "Recupere su cartera sin llamadas incómodas." },
                            { icon: IconoFirma, title: "Certeza Jurídica", text: "Formalice matrículas con firma digital válida." },
                            { icon: IconoCampana, title: "Confianza Parental", text: "Notificaciones QR de asistencia en tiempo real." }
                        ].map((feat, i) => (
                            <div key={i} className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-gray-100 hover:shadow-xl transition-all space-y-6">
                                <div className="w-16 h-16 bg-tkd-blue/5 rounded-2xl flex items-center justify-center text-tkd-blue">
                                    <feat.icon className="w-8 h-8" />
                                </div>
                                <h3 className="text-xl font-black uppercase tracking-tight">{feat.title}</h3>
                                <p className="text-sm text-gray-500 font-medium leading-relaxed uppercase">{feat.text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* SECCIÓN TARIFAS */}
            <section id="tarifas" className="py-24 px-6 sm:px-12">
                <div className="max-w-6xl mx-auto space-y-16">
                    <div className="text-center">
                        <h2 className="text-4xl font-black uppercase tracking-tighter">Inversión para tu Academia</h2>
                        <p className="text-gray-400 font-bold uppercase text-xs tracking-widest mt-2">Planes escalables según el tamaño de tu escuela</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {Object.values(PLANES_SAAS).map((plan: any) => (
                            <div key={plan.id} className={`rounded-[3rem] p-10 border-4 flex flex-col justify-between transition-all ${plan.popular ? 'border-tkd-blue bg-white shadow-2xl scale-105 z-10' : 'border-gray-50 bg-gray-50 opacity-80'}`}>
                                <div className="space-y-6">
                                    {plan.popular && <span className="bg-tkd-blue text-white px-6 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest">Más Elegido</span>}
                                    <h4 className="text-2xl font-black uppercase tracking-tight">{plan.nombre}</h4>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-4xl font-black text-tkd-blue">{formatearPrecio(plan.precio)}</span>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase">/mes</span>
                                    </div>
                                    <ul className="space-y-4 pt-4 text-[10px] font-black uppercase text-gray-500">
                                        <li className="flex items-center gap-3"><IconoEstudiantes className="w-4 h-4" /> Hasta {plan.limiteEstudiantes} alumnos</li>
                                        <li className="flex items-center gap-3"><IconoUsuario className="w-4 h-4" /> {plan.limiteUsuarios} Instructores</li>
                                        <li className="flex items-center gap-3"><IconoCasa className="w-4 h-4" /> {plan.limiteSedes} Sedes</li>
                                    </ul>
                                </div>
                                <a
                                    href="#/registro"
                                    onClick={() => {
                                        console.log("%c >>> PLAN SELECCIONADO: " + plan.id, "background: #0047A0; color: white; font-size: 20px; font-weight: bold;");
                                        guardarCookie('plan_pendiente', plan.id);
                                        // Forzar hash por si el link nativo fallara en algún navegador
                                        window.location.hash = "/registro";
                                    }}
                                    className="btn-emergency"
                                >
                                    Elegir este Plan
                                </a>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <footer className="py-12 border-t border-gray-100 text-center">
                <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.5em]">Aliant • Tudojang SaaS Core 2026</p>
            </footer>
        </div>
    );
};

export default PublicLanding;
