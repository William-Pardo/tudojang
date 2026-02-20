
// vistas/MasterAccess.tsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { IconoLogoOficial, IconoLogin } from '../components/Iconos';

const MasterAccess: React.FC = () => {
    const { login } = useAuth();
    const [pass, setPass] = useState('');
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!pass) return;

        setCargando(true);
        setError('');
        try {
            await login('aliantlab@gmail.com', pass);
            // La redirección ocurrirá automáticamente por el estado del AuthContext en App.tsx
        } catch (err: any) {
            setError(err.message || 'Acceso Denegado. Credenciales Maestro Inválidas.');
        } finally {
            setCargando(false);
        }
    };

    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-6 font-poppins">
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="max-w-md w-full bg-gray-900/40 backdrop-blur-3xl border border-white/10 p-12 rounded-[4rem] shadow-[0_0_100px_rgba(31,62,144,0.15)] text-center relative overflow-hidden"
            >
                {/* Efectos de luz de fondo */}
                <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-600/10 rounded-full blur-[80px]"></div>
                <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-red-600/10 rounded-full blur-[80px]"></div>

                <div className="relative z-10">
                    <div className="w-20 h-20 bg-gradient-to-br from-gray-800 to-gray-900 rounded-[2rem] flex items-center justify-center mx-auto mb-10 border border-white/10 shadow-2xl">
                        <IconoLogoOficial className="w-12 h-12 grayscale opacity-40 hover:opacity-100 transition-opacity duration-700" title="Aliant Master Key" />
                    </div>

                    <h1 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Vault Door</h1>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] mb-12">Nivel de Acceso: Master Control</p>

                    <form onSubmit={handleSubmit} className="space-y-8">
                        <div className="space-y-3 text-left">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-6">Acceso Biométrico / Clave Maestra</label>
                            <div className="relative">
                                <input
                                    type="password"
                                    value={pass}
                                    onChange={(e) => setPass(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-white/5 border border-white/10 rounded-[2rem] p-6 text-white font-black tracking-[0.6em] focus:outline-none focus:border-blue-500/50 focus:bg-white/10 transition-all text-center placeholder:text-gray-700 placeholder:tracking-normal"
                                    autoFocus
                                />
                                <div className="absolute inset-0 rounded-[2rem] pointer-events-none border border-white/5"></div>
                            </div>
                        </div>

                        <button
                            disabled={cargando || !pass}
                            className="w-full bg-white text-black py-6 rounded-[2rem] font-black uppercase text-xs tracking-[0.3em] hover:bg-tkd-blue hover:text-white transition-all duration-500 flex items-center justify-center gap-4 shadow-xl active:scale-95 disabled:opacity-20 disabled:grayscale disabled:scale-100"
                        >
                            {cargando ? (
                                <div className="w-5 h-5 border-4 border-current border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <IconoLogin className="w-5 h-5" />
                                    <span>Ingreso Maestro</span>
                                </>
                            )}
                        </button>

                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl"
                            >
                                <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">{error}</p>
                            </motion.div>
                        )}
                    </form>

                    <div className="mt-12 pt-8 border-t border-white/5">
                        <p className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">
                            &copy; 2026 Core v4.5 • Aliant Lab Architecture
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default MasterAccess;
