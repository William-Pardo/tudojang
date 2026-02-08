
// vistas/PublicLanding.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
// Added comment above fix: Included IconoDashboard in the imports from Iconos.tsx
import { IconoLogoOficial, IconoAprobar, IconoWhatsApp, IconoFirma, IconoCampana, IconoCasa, IconoUsuario, IconoEstudiantes, IconoDashboard } from '../components/Iconos';
import { PLANES_SAAS } from '../constantes';
import { formatearPrecio } from '../utils/formatters';

const PublicLanding: React.FC = () => {
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
                <Link 
                    to="/registro-escuela" 
                    className="bg-tkd-dark text-white px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-tkd-blue transition-all active:scale-95"
                >
                    Registrar Academia
                </Link>
            </nav>

            {/* HERO SECTION: PUNTO DE CIERRE 1 */}
            <section className="relative pt-32 pb-20 px-6 sm:px-12 overflow-hidden">
                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                    <motion.div 
                        initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }}
                        className="space-y-8"
                    >
                        <div className="inline-block bg-tkd-blue/10 text-tkd-blue px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">
                            El Futuro de la Gestión Marcial
                        </div>
                        <h1 className="text-6xl md:text-7xl font-black uppercase tracking-tighter leading-[0.9]">
                            Transforma <br/> tu <span className="text-tkd-blue">Dojang</span>
                        </h1>
                        <p className="text-lg text-gray-500 font-medium uppercase leading-relaxed max-w-md">
                            La plataforma SaaS diseñada por Sabonims para automatizar tus cobros, legalizar tus alumnos y controlar tus clases en tiempo real.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <Link 
                                to="/registro-escuela" 
                                className="bg-tkd-red text-white px-10 py-5 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-[0_20px_40px_-10px_rgba(205,46,58,0.4)] hover:scale-105 active:scale-95 transition-all text-center"
                            >
                                Empezar Gratis Hoy
                            </Link>
                            <a 
                                href="#tarifas" 
                                className="bg-white border-2 border-gray-100 text-tkd-dark px-10 py-5 rounded-2xl font-black uppercase text-xs tracking-widest hover:border-tkd-blue transition-all text-center"
                            >
                                Ver Planes
                            </a>
                        </div>
                    </motion.div>

                    <motion.div 
                        initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                        className="relative"
                    >
                        <div className="bg-gray-100 rounded-[3rem] aspect-square lg:aspect-video flex items-center justify-center p-12 shadow-inner border border-gray-200">
                             <IconoLogoOficial className="w-64 h-64 opacity-10" />
                             <div className="absolute inset-0 flex items-center justify-center">
                                 <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl shadow-2xl border border-gray-100 animate-bounce-slow">
                                     <IconoDashboard className="w-16 h-16 text-tkd-blue" />
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
                                title: "Cobranza Pro", 
                                text: "Recordatorios automáticos por WhatsApp con IA Gemini. Reduce el retraso en mensualidades en un 40%." 
                            },
                            { 
                                icon: IconoFirma, 
                                title: "Legal Tech", 
                                text: "Contratos de matrícula y consentimientos de riesgos con firma digital oficial. Cero papeles en el dojang." 
                            },
                            { 
                                icon: IconoCampana, 
                                title: "Monitor Real-Time", 
                                text: "Carnets con QR para alumnos. Control de asistencia y salida sincronizado con el móvil de los padres." 
                            }
                        ].map((feat, i) => (
                            <div key={i} className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-2 transition-all space-y-6">
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

            {/* TARIFAS: PUNTO DE CIERRE 2 */}
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
                                        {plan.caracteristicas.slice(3).map((c: string, idx: number) => (
                                            <li key={idx} className="flex items-center gap-3 opacity-60"><IconoAprobar className="w-3.5 h-3.5 text-green-500" /> {c}</li>
                                        ))}
                                    </ul>
                                </div>
                                <Link 
                                    to="/registro-escuela" 
                                    className={`mt-10 w-full py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest text-center transition-all ${plan.popular ? 'bg-tkd-blue text-white shadow-xl hover:bg-blue-800' : 'bg-tkd-dark text-white hover:bg-tkd-blue'}`}
                                >
                                    Elegir este Plan
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* MISIÓN KICHO: REFUERZO DE COMPRA */}
            <section id="kicho" className="py-24 bg-tkd-dark text-white px-6 sm:px-12 relative overflow-hidden">
                <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-20 items-center relative z-10">
                    <div className="space-y-8">
                        <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20">
                            <IconoCampana className="w-8 h-8 text-tkd-red" />
                        </div>
                        <h2 className="text-5xl font-black uppercase tracking-tighter">Misión Kicho: <br/> Onboarding 72h</h2>
                        <p className="text-gray-400 text-lg font-medium leading-relaxed uppercase tracking-tight">
                            ¿Tienes muchos alumnos por registrar? Activa el protocolo Kicho. Generamos un QR masivo, tus alumnos ingresan sus datos y tú solo auditas. <br/> **Subimos a toda tu escuela en un solo fin de semana.**
                        </p>
                    </div>
                    <div className="bg-white/5 p-12 rounded-[4rem] border border-white/10 backdrop-blur-sm text-center">
                         <div className="text-6xl font-black text-tkd-red mb-2">0h</div>
                         <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Digitación Requerida</p>
                         <div className="h-px bg-white/10 my-8"></div>
                         <Link to="/registro-escuela" className="text-tkd-blue font-black uppercase tracking-widest text-sm hover:underline">Activar mi Onboarding →</Link>
                    </div>
                </div>
                <div className="absolute top-0 right-0 w-96 h-96 bg-tkd-blue/20 rounded-full blur-[150px]"></div>
            </section>

            {/* FINAL CTA: PUNTO DE CIERRE 3 */}
            <section className="py-32 px-6 text-center space-y-10">
                <div className="max-w-2xl mx-auto space-y-6">
                    <h2 className="text-5xl font-black uppercase tracking-tighter">¿Aún tienes dudas, Sabonim?</h2>
                    <p className="text-gray-500 font-bold uppercase text-xs tracking-widest leading-loose">
                        Sabemos que cada escuela es un mundo. Habla con un consultor técnico <br/> experto en Taekwondo para configurar tu entorno ideal.
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row justify-center gap-6">
                    <a 
                        href="https://wa.me/573007654321?text=Hola!%20Deseo%20conocer%20más%20sobre%20Tudojang%20para%20mi%20academia"
                        target="_blank"
                        className="bg-green-600 text-white px-12 py-5 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl hover:bg-green-700 transition-all flex items-center justify-center gap-4"
                    >
                        <IconoWhatsApp className="w-6 h-6" />
                        Hablar con Soporte
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
