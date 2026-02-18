
// components/ModalImportacionMasiva.tsx
import React, { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
    IconoCerrar, IconoExportar, IconoAprobar, 
    IconoInformacion, IconoAlertaTriangulo, 
    IconoEliminar, IconoUsuario, IconoLogoOficial 
} from './Iconos';
import { useNotificacion } from '../context/NotificacionContext';
import { useEstudiantes, useSedes } from '../context/DataContext';
import { GradoTKD, EstadoPago } from '../tipos';
import Loader from './Loader';

interface Props {
    abierto: boolean;
    onCerrar: () => void;
    onExito: () => void;
}

// Estructura oficial del sistema
const COLUMNAS_OFICIALES = [
    "Nombres", 
    "Apellidos", 
    "Identificacion", 
    "Fecha_Nacimiento_AAAA_MM_DD", 
    "Telefono", 
    "Correo", 
    "Grado_Actual", 
    "Tutor_Nombre_Completo", 
    "Tutor_Identificacion",
    "Tutor_Telefono",
    "Alergias",
    "Lesiones",
    "Personas_Autorizadas"
];

const ModalImportacionMasiva: React.FC<Props> = ({ abierto, onCerrar, onExito }) => {
    const [paso, setPaso] = useState<'inicio' | 'previa' | 'procesando'>('inicio');
    const [datosRaw, setDatosRaw] = useState<any[]>([]);
    const [procesandoImport, setProcesandoImport] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const { sedesVisibles } = useSedes();
    const { agregarEstudiante } = useEstudiantes();
    const { mostrarNotificacion } = useNotificacion();

    const calcularEdad = (fecha: any): number => {
        if (!fecha) return 0;
        const fechaNac = fecha instanceof Date ? fecha : new Date(fecha);
        if (isNaN(fechaNac.getTime())) return 0;
        const hoy = new Date();
        let edad = hoy.getFullYear() - fechaNac.getFullYear();
        const m = hoy.getMonth() - fechaNac.getMonth();
        if (m < 0 || (m === 0 && hoy.getDate() < fechaNac.getDate())) edad--;
        return edad;
    };

    const descargarPlantilla = () => {
        const wb = XLSX.utils.book_new();
        
        // --- HOJA 1: ÁREA DE TRABAJO ---
        const wsData = [
            COLUMNAS_OFICIALES.map(c => c.toUpperCase()), 
            ["JUAN CAMILO", "PEREZ", "10203040", "2015-05-10", "3001234567", "alumno@email.com", "Blanco", "MARIA PEREZ", "52888999", "3109876543", "Ninguna", "Ninguna", "Padre"]
        ];
        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // Anchos de columna para la hoja principal
        ws['!cols'] = [
            { wch: 25 }, { wch: 25 }, { wch: 18 }, { wch: 28 }, { wch: 18 }, 
            { wch: 28 }, { wch: 22 }, { wch: 28 }, { wch: 18 }, { wch: 18 }, 
            { wch: 25 }, { wch: 25 }, { wch: 25 }
        ];

        XLSX.utils.book_append_sheet(wb, ws, "DATOS_A_IMPORTAR");

        // --- HOJA 2: REGLAS Y DICCIONARIO (UX MEJORADA) ---
        const reglasData = [
            ["MANUAL DE REGLAS PARA LA CARGA MASIVA DE DATOS"],
            ["SISTEMA TUDOJANG v4.0 - PROTOCOLO DE INTEGRIDAD"],
            [""],
            ["COLUMNA", "REGLA TÉCNICA OBLIGATORIA", "VALOR DE EJEMPLO"],
            ["-------------------", "--------------------------------------------------------------------------------", "-------------------"],
            ["IDENTIFICACION", "SOLO NÚMEROS. Sin puntos, espacios ni guiones. Es la llave única del sistema.", "1020304050"],
            ["FECHA_NACIMIENTO", "FORMATO ISO: AAAA-MM-DD (Año-Mes-Día). Crucial para seguros y grupos.", "2012-05-24"],
            ["GRADO_ACTUAL", "Debe ser igual a uno de la lista oficial que se encuentra abajo.", "Verde Punta Azul"],
            ["TUTOR (3 CAMPOS)", "OBLIGATORIOS si el alumno es menor de 18 años. El sistema bloqueará la carga si faltan.", "Nombre completo"],
            ["CORREO", "Obligatorio para mayores de 18 años (para su propia firma digital).", "juan@ejemplo.com"],
            ["TELEFONO", "Número de 10 dígitos para notificaciones de WhatsApp automáticas.", "3001234567"],
            ["ALERGIAS / LESIONES", "Si no tiene, escriba 'NINGUNA'. No deje la celda vacía para el expediente médico.", "Asma / N/A"],
            [""],
            ["--------------------------------------------------------------------------------"],
            ["LISTA OFICIAL DE GRADOS (Copie y pegue exactamente el texto deseado):"],
            ["--------------------------------------------------------------------------------"],
            ...Object.values(GradoTKD).map(g => [g, "Grado oficial del currículo WT", "SISTEMA"])
        ];

        const wsRef = XLSX.utils.aoa_to_sheet(reglasData);

        // Ajuste de anchos para la hoja de reglas (Columna B muy ancha para lectura)
        wsRef['!cols'] = [
            { wch: 25 }, // Columna A
            { wch: 85 }, // Columna B (Reglas - Ancho para facilitar lectura)
            { wch: 30 }  // Columna C
        ];

        XLSX.utils.book_append_sheet(wb, wsRef, "REGLAS_Y_CATALOGOS");

        XLSX.writeFile(wb, 'Plantilla_Oficial_Tudojang_SaaS.xlsx');
        mostrarNotificacion("Plantilla generada con Manual de Reglas.", "info");
    };

    const auditarFila = (row: any) => {
        const errores: string[] = [];
        const advertencias: string[] = [];
        
        const fechaNacRaw = row["Fecha_Nacimiento_AAAA_MM_DD"];
        const edad = calcularEdad(fechaNacRaw);
        const nombres = String(row["Nombres"] || "").trim();
        const id = String(row["Identificacion"] || "").trim();

        if (!nombres) errores.push("Falta Nombre");
        if (!id || isNaN(Number(id))) errores.push("ID Inválido");
        
        if (edad > 0 && edad < 18) {
            if (!row["Tutor_Nombre_Completo"] || !row["Tutor_Identificacion"] || !row["Tutor_Telefono"]) {
                errores.push("Menor sin datos de Tutor");
            }
        } else if (edad >= 18) {
            if (!row["Correo"]) errores.push("Adulto requiere Correo");
        } else {
            errores.push("Formato Fecha Error");
        }

        const gradosValidos = Object.values(GradoTKD) as string[];
        if (row["Grado_Actual"] && !gradosValidos.includes(row["Grado_Actual"])) {
            errores.push(`Grado '${row["Grado_Actual"]}' no reconocido`);
        }

        if (String(row["Alergias"] || "").trim() === "") advertencias.push("Ficha médica vacía");

        return { 
            valido: errores.length === 0, 
            errores, 
            advertencias,
            edad,
            identidad: `${nombres} ${row["Apellidos"] || ""}`.trim() || "Fila sin Identidad"
        };
    };

    const manejarArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = new Uint8Array(event.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

                if (jsonData.length === 0) {
                    mostrarNotificacion("El archivo no contiene registros.", "error");
                    return;
                }

                // Normalización de llaves de Excel (ignorar mayúsculas del usuario)
                const llavesDetectadas = Object.keys(jsonData[0]).map(k => k.toUpperCase());
                const estructuraCorrecta = COLUMNAS_OFICIALES.every(col => llavesDetectadas.includes(col.toUpperCase()));

                if (!estructuraCorrecta) {
                    mostrarNotificacion("Estructura inválida. Por favor usa la plantilla original.", "error");
                    return;
                }

                const datosMapeados = jsonData.map(row => {
                    const obj: any = {};
                    Object.keys(row).forEach(key => {
                        const oficial = COLUMNAS_OFICIALES.find(c => c.toUpperCase() === key.toUpperCase());
                        if (oficial) obj[oficial] = row[key];
                    });
                    return obj;
                });

                setDatosRaw(datosMapeados);
                setPaso('previa');
            } catch (err) {
                mostrarNotificacion("Error crítico al leer el archivo.", "error");
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const ejecutarInyeccion = async () => {
        setProcesandoImport(true);
        setPaso('procesando');
        
        let exitos = 0;
        for (const row of datosRaw) {
            try {
                let fNac = row["Fecha_Nacimiento_AAAA_MM_DD"];
                if (fNac instanceof Date) fNac = fNac.toISOString().split('T')[0];

                const payload = {
                    nombres: String(row["Nombres"]).toUpperCase(),
                    apellidos: String(row["Apellidos"]).toUpperCase(),
                    numeroIdentificacion: String(row["Identificacion"]),
                    fechaNacimiento: fNac,
                    telefono: String(row["Telefono"] || ''),
                    correo: String(row["Correo"] || '').toLowerCase(),
                    grado: row["Grado_Actual"] || GradoTKD.Blanco,
                    sedeId: sedesVisibles[0]?.id || 'principal',
                    fechaIngreso: new Date().toISOString().split('T')[0],
                    estadoPago: EstadoPago.AlDia,
                    alergias: String(row["Alergias"] || 'NINGUNA'),
                    lesiones: String(row["Lesiones"] || 'NINGUNA'),
                    personasAutorizadas: String(row["Personas_Autorizadas"] || ''),
                    tutor: row["Tutor_Nombre_Completo"] ? {
                        nombres: String(row["Tutor_Nombre_Completo"]).toUpperCase(),
                        apellidos: '',
                        numeroIdentificacion: String(row["Tutor_Identificacion"]),
                        telefono: String(row["Tutor_Telefono"]),
                        correo: String(row["Correo"] || '')
                    } : undefined
                };
                await agregarEstudiante(payload as any);
                exitos++;
            } catch (e) { console.error("Error en fila:", e); }
        }

        mostrarNotificacion(`Importación Exitosa: ${exitos} alumnos registrados.`, "success");
        onExito();
    };

    const auditoria = useMemo(() => {
        return datosRaw.map((row, i) => ({ ...auditarFila(row), _fila: i + 2 }));
    }, [datosRaw]);

    const tieneErroresCriticos = auditoria.some(a => !a.valido);

    if (!abierto) return null;

    return (
        <div className="fixed inset-0 z-[150] bg-tkd-dark/95 flex items-center justify-center p-4 animate-fade-in backdrop-blur-md">
            <div className="bg-white dark:bg-gray-900 w-full max-w-5xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <header className="p-8 border-b dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
                    <div>
                        <h2 className="text-2xl font-black uppercase text-gray-900 dark:text-white tracking-tighter">Auditor de Carga Masiva</h2>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Escuela de Taekwondo • Validador de Integridad</p>
                    </div>
                    <button onClick={onCerrar} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"><IconoCerrar className="w-6 h-6 text-gray-400" /></button>
                </header>

                <div className="flex-1 overflow-y-auto p-8">
                    {paso === 'inicio' && (
                        <div className="max-w-4xl mx-auto space-y-12">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="p-10 bg-gray-50 dark:bg-gray-800 rounded-[3rem] border-2 border-dashed border-gray-200 dark:border-gray-700 text-center space-y-6">
                                    <div className="w-16 h-16 bg-tkd-blue/10 rounded-2xl flex items-center justify-center mx-auto">
                                        <IconoExportar className="w-8 h-8 text-tkd-blue rotate-180" />
                                    </div>
                                    <h3 className="font-black uppercase text-xs dark:text-white">Paso 1: Preparar Excel</h3>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase leading-relaxed px-4">Descarga el formato maestro con anchos de columna ajustados y pestaña de reglas.</p>
                                    <button onClick={descargarPlantilla} className="w-full bg-white text-tkd-blue border-2 border-tkd-blue/20 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-50 shadow-sm transition-all">Obtener Plantilla Inteligente</button>
                                </div>

                                <div className="p-10 bg-blue-50 dark:bg-blue-900/10 rounded-[3rem] border-2 border-tkd-blue/20 text-center space-y-6">
                                    <div className="w-16 h-16 bg-tkd-red/10 rounded-2xl flex items-center justify-center mx-auto">
                                        <IconoLogoOficial className="w-8 h-8 text-tkd-red" />
                                    </div>
                                    <h3 className="font-black uppercase text-xs dark:text-white">Paso 2: Inyectar Datos</h3>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase leading-relaxed px-4">Sube el archivo lleno. El motor de Aliant auditará cada fila buscando errores humanos.</p>
                                    <input type="file" ref={fileInputRef} onChange={manejarArchivo} accept=".xlsx, .xls" className="hidden" />
                                    <button onClick={() => fileInputRef.current?.click()} className="w-full bg-tkd-blue text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-blue-800 transition-all">Seleccionar Archivo Lleno</button>
                                </div>
                            </div>

                            <div className="bg-orange-50 dark:bg-orange-900/10 p-6 rounded-[2rem] border border-orange-100 dark:border-orange-800">
                                <div className="flex gap-4">
                                    <IconoInformacion className="w-5 h-5 text-orange-600 flex-shrink-0" />
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-orange-800 dark:text-orange-400 uppercase tracking-widest">Aviso de Seguridad Técnica:</p>
                                        <p className="text-[9px] font-bold text-orange-700 dark:text-orange-500 uppercase leading-relaxed">
                                            No borres los encabezados de la fila 1. Si un alumno es menor de 18 años, el sistema requiere obligatoriamente los campos del tutor para generar los consentimientos digitales.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {paso === 'previa' && (
                        <div className="space-y-6 animate-slide-in-right">
                            <div className="flex flex-col md:flex-row justify-between items-center bg-gray-50 dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 gap-6">
                                <div className="flex gap-8">
                                    <div className="text-center">
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Filas Cargadas</p>
                                        <p className="text-2xl font-black dark:text-white">{datosRaw.length}</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Inconsistencias</p>
                                        <p className={`text-2xl font-black ${tieneErroresCriticos ? 'text-tkd-red' : 'text-green-500'}`}>{auditoria.filter(a => !a.valido).length}</p>
                                    </div>
                                </div>
                                <div className="flex gap-3 w-full sm:w-auto">
                                    <button onClick={() => setPaso('inicio')} className="flex-1 sm:flex-none px-6 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-[10px] font-black uppercase text-gray-400 hover:text-tkd-red">Cancelar</button>
                                    <button 
                                        onClick={ejecutarInyeccion}
                                        disabled={tieneErroresCriticos}
                                        className="flex-1 sm:flex-none px-10 py-3 bg-tkd-red text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg disabled:bg-gray-300 transition-all active:scale-95"
                                    >
                                        {tieneErroresCriticos ? 'Corregir Errores' : 'Confirmar e Inyectar'}
                                    </button>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 overflow-hidden shadow-inner">
                                <table className="w-full text-left text-[10px]">
                                    <thead className="bg-[#BACBFF] font-black uppercase text-tkd-blue sticky top-0 z-10">
                                        <tr>
                                            <th className="px-6 py-5">Fila</th>
                                            <th className="px-6 py-5">Deportista</th>
                                            <th className="px-6 py-5">Edad Calculada</th>
                                            <th className="px-6 py-5">Auditoría Técnica</th>
                                            <th className="px-6 py-5 text-center">Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y dark:divide-gray-800">
                                        {auditoria.map((a, i) => (
                                            <tr key={i} className={`${!a.valido ? 'bg-red-50/40 dark:bg-red-900/10' : 'hover:bg-gray-50/50 dark:hover:bg-gray-700/30'}`}>
                                                <td className="px-6 py-4 font-black text-gray-400">{a._fila}</td>
                                                <td className="px-6 py-4">
                                                    <p className="font-black uppercase dark:text-white leading-tight">{a.identidad}</p>
                                                    <p className="text-[8px] text-gray-400 font-bold uppercase mt-1">Auditado por Sistema</p>
                                                </td>
                                                <td className="px-6 py-4 font-black uppercase dark:text-gray-300">{a.edad} Años</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {a.errores.map((e, idx) => <span key={idx} className="bg-red-100 text-red-700 px-2.5 py-1 rounded-lg font-black uppercase text-[8px] border border-red-200">{e}</span>)}
                                                        {a.advertencias.map((w, idx) => <span key={idx} className="bg-yellow-100 text-yellow-700 px-2.5 py-1 rounded-lg font-black uppercase text-[8px] border border-yellow-200">{w}</span>)}
                                                        {a.valido && a.advertencias.length === 0 && <span className="text-green-500 font-black uppercase text-[8px] tracking-widest">REGISTRO ÓPTIMO</span>}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {a.valido ? <IconoAprobar className="w-5 h-5 text-green-500 mx-auto" /> : <IconoAlertaTriangulo className="w-5 h-5 text-tkd-red mx-auto" />}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {paso === 'procesando' && (
                        <div className="py-24 text-center space-y-10 animate-pulse">
                            <Loader texto="Sincronizando expedientes masivos..." />
                            <div className="space-y-2">
                                <p className="text-[11px] font-black text-tkd-blue uppercase tracking-[0.3em]">Protocolo Aliant Bulk Sync Activo</p>
                                <p className="text-[9px] font-bold text-gray-400 uppercase">Creando perfiles técnicos y vinculando sedes</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ModalImportacionMasiva;
