
// vistas/AyudaPqrs.tsx
import React, { useState } from 'react';
import { BASE_CONOCIMIENTO_PQRS, ADMIN_WHATSAPP } from '../constantes';
import { IconoLogoOficial, IconoBuscar, IconoWhatsApp, IconoInformacion } from '../components/Iconos';

const VistaAyudaPqrs: React.FC = () => {
    const [busqueda, setBusqueda] = useState('');
    
    const faqsFiltradas = BASE_CONOCIMIENTO_PQRS.filter(f => 
        f.pregunta.toLowerCase().includes(busqueda.toLowerCase()) || 
        f.respuesta.toLowerCase().includes(busqueda.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-tkd-gray dark:bg-tkd-dark p-4 sm:p-8">
            <div className="max-w-3xl mx-auto space-y-8">
                <header className="text-center">
                    <IconoLogoOficial className="w-20 h-20 mx-auto mb-4" />
                    <h1 className="text-3xl font-black text-tkd-blue uppercase">Centro de Ayuda</h1>
                    <p className="text-gray-500">¿Tienes dudas? Encuentra respuestas rápidas aquí.</p>
                </header>

                <div className="relative">
                    <input 
                        type="text"
                        placeholder="Busca por palabra clave (pago, uniforme, sede...)"
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white dark:bg-gray-800 border-none shadow-lg focus:ring-2 focus:ring-tkd-red font-medium"
                    />
                    <IconoBuscar className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
                </div>

                <div className="space-y-4">
                    {faqsFiltradas.length > 0 ? faqsFiltradas.map(faq => (
                        <div key={faq.id} className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 animate-fade-in">
                            <h3 className="font-black text-tkd-blue mb-2 text-lg">¿{faq.pregunta}</h3>
                            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{faq.respuesta}</p>
                        </div>
                    )) : (
                        <div className="text-center py-12">
                            <p className="text-gray-400">No encontramos respuestas para esa búsqueda.</p>
                        </div>
                    )}
                </div>

                <div className="bg-tkd-blue text-white p-8 rounded-3xl shadow-xl flex flex-col items-center text-center">
                    <IconoWhatsApp className="w-12 h-12 mb-4" />
                    <h2 className="text-xl font-black uppercase mb-2">¿Aún necesitas ayuda?</h2>
                    <p className="text-blue-100 text-sm mb-6">Si no encontraste lo que buscabas o quieres radicar una PQRS formal, habla directamente con nuestra administración.</p>
                    <a 
                        href={`https://wa.me/57${ADMIN_WHATSAPP}?text=Hola,%20tengo%20una%20duda/solicitud%20para%20TaekwondoGa%20Jog:`}
                        target="_blank"
                        className="bg-tkd-red text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg"
                    >
                        Chatear por WhatsApp
                    </a>
                </div>

                <footer className="text-center text-[10px] text-gray-400 uppercase font-bold tracking-widest">
                    TaekwondoGa Jog • Gestión Transparente • 2024
                </footer>
            </div>
        </div>
    );
};

export default VistaAyudaPqrs;
