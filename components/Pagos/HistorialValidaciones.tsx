
// components/Pagos/HistorialValidaciones.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useEstudiantes } from '../../context/DataContext';
import { useNotificacion } from '../../context/NotificacionContext';
import { obtenerHistorialReportes } from '../../servicios/pagosEstudiantesApi';
import { ReportePagoEstudiante, EstadoValidacion } from '../../tipos';
import { IconoExportar, IconoHistorial } from '../Iconos';
import { formatearPrecio } from '../../utils/formatters';

// Mismo patrón de escape que hooks/useGestionEstudiantes.ts::exportarCSV, replicado aquí
// porque es una exportación de un dominio distinto (reportes de pago, no estudiantes).
const escapeCSV = (value: any): string => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
};

const HistorialValidaciones: React.FC = () => {
    const { usuario } = useAuth();
    const { estudiantes } = useEstudiantes();
    const { mostrarNotificacion } = useNotificacion();
    const [reportes, setReportes] = useState<ReportePagoEstudiante[]>([]);
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        const cargar = async () => {
            if (!usuario) return;
            try {
                const data = await obtenerHistorialReportes(usuario.tenantId);
                setReportes(data);
            } catch (e) {
                mostrarNotificacion("Error al cargar el historial de validaciones.", "error");
            } finally {
                setCargando(false);
            }
        };
        cargar();
    }, [usuario]);

    const resolverTutor = (estudianteId: string): string => {
        const tutor = estudiantes.find(e => e.id === estudianteId)?.tutor;
        if (!tutor) return '—';
        return `${tutor.nombres} ${tutor.apellidos}`.trim() || '—';
    };

    const exportarCSV = () => {
        if (reportes.length === 0) {
            mostrarNotificacion("No hay registros para exportar.", "info");
            return;
        }

        const headers = ['Estudiante', 'Tutor', 'Monto', 'Canal', 'FechaReportada', 'FechaValidada', 'Estado', 'ValidadoPor'];
        const csvRows = [
            headers.join(','),
            ...reportes.map(r => ([
                escapeCSV(r.estudianteNombre),
                escapeCSV(resolverTutor(r.estudianteId)),
                r.montoInformado,
                escapeCSV(r.datosIA?.entidad || ''),
                escapeCSV(r.fechaReporte),
                escapeCSV(r.fechaValidacion || ''),
                escapeCSV(r.estado),
                escapeCSV(r.validadoPor || ''),
            ].join(',')))
        ];

        const csvContent = csvRows.join('\n');
        const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        const timestamp = new Date().toISOString().slice(0, 10);
        link.setAttribute('download', `historial_validaciones_${timestamp}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    if (cargando) return <div className="p-10 text-center text-gray-400 font-black uppercase text-xs animate-pulse">Cargando Historial...</div>;

    if (reportes.length === 0) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-[3rem] p-20 text-center space-y-4 border border-gray-100 dark:border-white/5 shadow-soft">
                <div className="w-16 h-16 bg-gray-50 dark:bg-gray-900 rounded-full flex items-center justify-center mx-auto opacity-40">
                    <IconoHistorial className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight text-gray-900 dark:text-white">Sin Historial</h3>
                <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">Todavía no hay pagos aprobados o rechazados.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <button
                    onClick={exportarCSV}
                    className="bg-green-600 text-white px-4 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-green-700 transition-all flex items-center gap-2"
                >
                    <IconoExportar className="w-4 h-4" /> Exportar CSV
                </button>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-soft overflow-x-auto">
                <table className="w-full text-left text-xs">
                    <thead>
                        <tr className="border-b border-gray-100 dark:border-white/5 text-[9px] font-black uppercase text-gray-400 tracking-widest">
                            <th className="p-4">Estudiante</th>
                            <th className="p-4">Tutor</th>
                            <th className="p-4">Monto</th>
                            <th className="p-4">Canal</th>
                            <th className="p-4">Reportado</th>
                            <th className="p-4">Validado</th>
                            <th className="p-4">Estado</th>
                            <th className="p-4">Validado por</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reportes.map(r => (
                            <tr key={r.id} className="border-b border-gray-50 dark:border-white/5 last:border-0">
                                <td className="p-4 font-black uppercase text-gray-900 dark:text-white">{r.estudianteNombre}</td>
                                <td className="p-4 text-gray-500 dark:text-gray-400">{resolverTutor(r.estudianteId)}</td>
                                <td className="p-4 font-black text-tkd-blue">{formatearPrecio(r.montoInformado)}</td>
                                <td className="p-4 text-gray-500 dark:text-gray-400">{r.datosIA?.entidad || '—'}</td>
                                <td className="p-4 text-gray-500 dark:text-gray-400">{new Date(r.fechaReporte).toLocaleDateString('es-CO')}</td>
                                <td className="p-4 text-gray-500 dark:text-gray-400">{r.fechaValidacion ? new Date(r.fechaValidacion).toLocaleDateString('es-CO') : '—'}</td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${r.estado === EstadoValidacion.Aprobado ? 'bg-green-100 text-green-700' : 'bg-tkd-red/10 text-tkd-red'}`}>
                                        {r.estado}
                                    </span>
                                </td>
                                <td className="p-4 text-gray-400 font-mono text-[10px]">{r.validadoPor ? r.validadoPor.slice(-8) : '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default HistorialValidaciones;
