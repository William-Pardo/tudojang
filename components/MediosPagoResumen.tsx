import React from 'react';

interface MediosPagoResumenProps {
    pagoNequi?: string;
    pagoDaviplata?: string;
    pagoBreB?: string;
    pagoBanco?: string;
}

const MediosPagoResumen: React.FC<MediosPagoResumenProps> = ({ pagoNequi, pagoDaviplata, pagoBreB, pagoBanco }) => {
    if (!pagoNequi && !pagoDaviplata && !pagoBreB && !pagoBanco) return null;
    return (
        <>
            {pagoNequi && (
                <div className="flex justify-between items-center text-gray-500">
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#E71D73]">Nequi</span>
                    <span className="font-bold text-tkd-dark dark:text-white">{pagoNequi}</span>
                </div>
            )}
            {pagoDaviplata && (
                <div className="flex justify-between items-center text-gray-500">
                    <span className="text-[10px] font-black uppercase tracking-widest text-red-600">Daviplata</span>
                    <span className="font-bold text-tkd-dark dark:text-white">{pagoDaviplata}</span>
                </div>
            )}
            {pagoBreB && (
                <div className="flex justify-between items-center text-gray-500">
                    <span className="text-[10px] font-black uppercase tracking-widest text-tkd-dark dark:text-gray-300">Bre-B</span>
                    <span className="font-bold text-tkd-dark dark:text-white">{pagoBreB}</span>
                </div>
            )}
            {pagoBanco && (
                <div className="flex flex-col gap-1 text-gray-500">
                    <span className="text-[10px] font-black uppercase tracking-widest text-tkd-blue">Banco / Transferencia</span>
                    <span className="font-bold text-tkd-dark dark:text-white text-xs leading-relaxed">{pagoBanco}</span>
                </div>
            )}
        </>
    );
};

export default MediosPagoResumen;
