
// vistas/PublicLanding.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
// Added comment above fix: Included IconoDashboard in the imports from Iconos.tsx
import { IconoLogoOficial, IconoAprobar, IconoWhatsApp, IconoFirma, IconoCampana, IconoCasa, IconoUsuario, IconoEstudiantes, IconoDashboard } from '../components/Iconos';
import { useAuth } from '../context/AuthContext';
import { PLANES_SAAS } from '../constantes';
import { formatearPrecio } from '../utils/formatters';

const PublicLanding: React.FC = () => {
    const { usuario } = useAuth();

    return (
        <div className="min-h-screen bg-white text-tkd-dark font-sans selection:bg-tkd-blue selection:text-white overflow-x-hidden">
            {/* NAVBAR ESTRATÉGICO */}
            <nav className="fixed top-0 w-full z-[100] bg-white/80 backdrop-blur-md border-b border-gray-100 py-4 px-6 sm:px-12 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <IconoLogoOficial className="w-10 h-10 text-tkd-blue" />
                    <span className="font-black text-xl tracking-tighter uppercase italic">Tudojang</span>
                </div>
                <div className="hidden md:flex items-center gap-8 text-[10px] font-black uppercase tracking-widest text-gray-500">
                    <a href="#caracteristicas" className="hover:text-tkd-blue transition-colors">Características</a>
                    <a href="#tarifas" className="hover:text-tkd-blue transition-colors">Tarifas</a>
                    <a href="#kicho" className="hover:text-tkd-blue transition-colors">Misión Kicho</a>
                </div>
                <div className="flex items-center gap-4">
                    {!usuario ? (
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                        >
                            <Link
                                to="/login"
                                className="bg-blue-600 text-white px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-blue-700 transition-all active:scale-95 flex items-center gap-2"
                            >
                                <IconoDashboard className="w-4 h-4" />
                                Iniciar Sesión
                            </Link>
                        </motion.div>
                    ) : (
                        <Link
                            to="/"
                            className="bg-blue-600 text-white px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-blue-700 transition-all active:scale-95 flex items-center gap-2"
                        >
                            <IconoDashboard className="w-4 h-4" />
                            Mi Academia
                        </Link>
                    )}
                </div>
            </nav>

            {/* HERO SECTION: PUNTO DE CIERRE 1 */}
            <section className="relative pt-32 pb-20 px-6 sm:px-12 overflow-hidden">
                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                    <motion.div
                        initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }}
                        className="space-y-8"
                    >
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
                                className="bg-tkd-red text-white px-10 py-5 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-[0_20px_40px_-10px_rgba(205,46,58,0.4)] hover:scale-105 active:scale-95 transition-all text-center"
                            >
                                Ver Tudojang en Acción (Consultoría Gratuita)
                            </a>
                            <Link
                                to="/login"
                                className="bg-blue-600 text-white px-10 py-5 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-blue-700 shadow-xl transition-all text-center"
                            >
                                Iniciar Sesión Ahora
                            </Link>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                        className="relative"
                    >
                        <div className="bg-gray-100 rounded-[3rem] aspect-square lg:aspect-video flex items-center justify-center p-12 shadow-inner border border-gray-200">
                            <IconoLogoOficial className="w-64 h-64 opacity-10" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="mb-8 flex justify-center">
                                    <div className="bg-white/80 backdrop-blur-xl p-8 rounded-[3rem] shadow-2xl border-4 border-white/50 animate-bounce-soft">
                                        <IconoLogoOficial className="w-32 sm:w-40" />
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* Flotantes de UI */}
                        <div className="absolute -top-10 -right-10 bg-green-500 text-white p-6 rounded-3xl shadow-2xl animate-pulse">
                            <IconoWhatsApp className="w-8 h-8" />
                        </div>
                        <div className="absolute -bottom-5 -left-10 bg-tkd-dark text-white p-6 rounded-3xl shadow-2xl">
                            <IconoFirma className="w-8 h-8" />
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* CARACTERÍSTICAS CORE */}
            <section id="caracteristicas" className="py-24 bg-gray-50 px-6 sm:px-12">
                <div className="max-w-7xl mx-auto space-y-20">
                    <div className="text-center space-y-4">
                        <h2 className="text-4xl font-black uppercase tracking-tighter">Potencia tu Ecosistema</h2>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em]">3 Pilares de Crecimiento Técnico</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                        {[
                            {
                                icon: IconoWhatsApp,
                                title: "Cobranza sin Fricción",
                                text: "Recupere su cartera sin llamadas incómodas. IA Gemini gestiona recordatorios automáticos por WhatsApp con un tono respetuoso y firme."
                            },
                            {
                                icon: IconoFirma,
                                title: "Certeza Jurídica",
                                text: "Formalice matrículas y exoneraciones de responsabilidad con firmas digitales válidas en Colombia. Trazabilidad total de cada documento."
                            },
                            {
                                icon: IconoCampana,
                                title: "Confianza Parental",
                                text: "Notificaciones QR de asistencia en tiempo real. Genere tranquilidad absoluta reportando ingresos y salidas de sus alumnos menores de edad."
                            }
                        ].map((feat, i) => (
                            <div key={i} className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-2 transition-all space-y-6">
                                <div className="w-16 h-16 bg-tkd-blue/5 rounded-2xl flex items-center justify-center text-tkd-blue">
                                    <feat.icon className="w-8 h-8" />
                                </div>
                                <h3 className="text-xl font-black uppercase tracking-tight">{feat.title}</h3>
                                <p className="text-sm text-gray-500 font-medium leading-relaxed uppercase">{feat.text}</p>
                                {feat.title === "Certeza Jurídica" && <p className="text-[8px] font-bold text-tkd-blue opacity-50 uppercase tracking-widest">Cumplimiento Normativo Colombia</p>}
                                {feat.title === "Cobranza sin Fricción" && <p className="text-[8px] font-bold text-tkd-blue opacity-50 uppercase tracking-widest">Integración Segura Wompi</p>}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* TARIFAS: PUNTO DE CIERRE 2 */}
            <section id="tarifas" className="py-24 px-6 sm:px-12">
                <div className="max-w-6xl mx-auto space-y-16">
                    <div className="text-center">
                        <h2 className="text-4xl font-black uppercase tracking-tighter">Inversión para tu Academia</h2>
                        <p className="text-gray-400 font-bold uppercase text-xs tracking-widest mt-2">Planes escalables según el tamaño de tu escuela</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {Object.values(PLANES_SAAS).map((plan: any, i: number) => (
                            <motion.div
                                key={plan.id}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                whileHover={{ y: -15, scale: plan.popular ? 1.05 : 1.02 }}
                                className={`rounded-[3rem] p-10 border-4 flex flex-col justify-between transition-shadow duration-300 relative
                                    ${plan.popular
                                        ? 'border-blue-600 bg-white shadow-2xl z-10'
                                        : 'border-gray-100 bg-white shadow-xl hover:border-blue-200'
                                    }`}
                            >
                                <div className="space-y-6">
                                    {plan.popular && (
                                        <div className="flex justify-between items-center">
                                            <span className="bg-blue-600 text-white px-6 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest animate-pulse">
                                                Más Popular
                                            </span>
                                            <div className="w-3 h-3 bg-blue-600 rounded-full animate-ping"></div>
                                        </div>
                                    )}
                                    <h4 className="text-2xl font-black uppercase tracking-tight">{plan.nombre}</h4>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-4xl font-black text-blue-600">{formatearPrecio(plan.precio)}</span>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase">/mes</span>
                                    </div>
                                    <ul className="space-y-4 pt-4 text-[10px] font-black uppercase text-gray-500">
                                        <li className="flex items-center gap-3"><IconoEstudiantes className="w-4 h-4 text-blue-600" /> Hasta {plan.limiteEstudiantes} alumnos</li>
                                        <li className="flex items-center gap-3"><IconoUsuario className="w-4 h-4 text-blue-600" /> {plan.limiteUsuarios} Instructores</li>
                                        <li className="flex items-center gap-3"><IconoCasa className="w-4 h-4 text-blue-600" /> {plan.limiteSedes} Sedes</li>
                                        {plan.caracteristicas.slice(3).map((c: string, idx: number) => (
                                            <li key={idx} className="flex items-center gap-3 opacity-60"><IconoAprobar className="w-3.5 h-3.5 text-blue-500" /> {c}</li>
                                        ))}
                                    </ul>
                                </div>
                                <Link
                                    to="/login"
                                    className="mt-10 w-full py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest text-center transition-all bg-blue-600 text-white shadow-xl hover:bg-blue-700 active:scale-95"
                                >
                                    Iniciar Sesión
                                </Link>
                            </motion.div>
                        ))}
                    </div>
                    <div className="text-center pt-10">
                        <p className="text-sm font-black uppercase tracking-widest text-tkd-blue">
                            Con solo 1–2 mensualidades recuperadas, Tudojang se paga solo. <br />
                            <span className="text-gray-400">Es una inversión directa en la profesionalización de su Dojang.</span>
                        </p>
                    </div>
                </div>
            </section>

            {/* MISIÓN KICHO: REFUERZO DE COMPRA */}
            <section id="kicho" className="py-24 bg-tkd-blue text-white px-6 sm:px-12 relative overflow-hidden">
                <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-20 items-center relative z-10">
                    <div className="space-y-8">
                        <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20">
                            <IconoCampana className="w-8 h-8 text-tkd-red" />
                        </div>
                        <h2 className="text-5xl font-black uppercase tracking-tighter">Protocolo Kicho: <br /> Onboarding 72h</h2>
                        <p className="text-gray-400 text-lg font-medium leading-relaxed uppercase tracking-tight">
                            ¿Múltiples sedes o cientos de alumnos? Nuestro protocolo de inyección rápida asegura cero interrupción de sus clases. Usted autorice, nosotros automatizamos el registro masivo por QR.
                        </p>
                    </div>
                    <div className="bg-white/5 p-12 rounded-[4rem] border border-white/10 backdrop-blur-sm text-center">
                        <div className="text-6xl font-black text-tkd-red mb-2">3 Días</div>
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Migración Total Aliant</p>
                        <div className="h-px bg-white/10 my-8"></div>
                        <a
                            href="https://wa.me/573007654321?text=Deseo%20activar%20una%20Misión%20Kicho%20para%20mi%20escuela"
                            className="inline-block bg-white text-tkd-blue px-10 py-5 rounded-[2rem] font-black uppercase tracking-widest text-[10px] hover:bg-gray-100 shadow-2xl transition-all hover:scale-[1.02] active:scale-95 whitespace-nowrap"
                        >
                            Agendar Protocolo Kicho (72h)
                        </a>
                    </div>
                </div>
                <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-[150px]"></div>
            </section>

            {/* FINAL CTA: PUNTO DE CIERRE 3 */}
            <section className="py-32 px-6 text-center space-y-10">
                <div className="max-w-2xl mx-auto space-y-6">
                    <h2 className="text-5xl font-black uppercase tracking-tighter">¿Aún tiene inquietudes, Sabonim?</h2>
                    <p className="text-gray-500 font-bold uppercase text-xs tracking-widest leading-loose">
                        Sabemos que cada escuela es una institución única. Hable con un consultor técnico <br /> experto en Taekwondo para configurar su entorno ideal.
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row justify-center gap-6">
                    <a
                        href="https://wa.me/573007654321?text=Hola!%20Deseo%20hablar%20con%20un%20consultor%20técnico%20sobre%20Tudojang"
                        target="_blank"
                        className="bg-green-600 text-white px-12 py-5 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl hover:bg-green-700 transition-all flex items-center justify-center gap-4"
                    >
                        <IconoWhatsApp className="w-6 h-6" />
                        Hablar con un Consultor Técnico Sabonim
                    </a>
                </div>
            </section>

            <footer className="py-12 border-t border-gray-100 text-center">
                <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.5em]">Aliant • Tudojang SaaS Core 2026</p>
            </footer>
        </div>
    );
};

export default PublicLanding;
