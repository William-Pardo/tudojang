
// components/FormularioEstudiante.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import type { Estudiante } from '../tipos';
import { GrupoEdad, EstadoPago, GradoTKD, RolUsuario } from '../tipos';
import { IconoCerrar, IconoInformacion, IconoLogoOficial, IconoAprobar, IconoUsuario, IconoProrateo } from './Iconos';
import FormInputError from './FormInputError';
import ModalConfirmacion from './ModalConfirmacion';
import { useSedes, useProgramas, useConfiguracion } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { formatearPrecio } from '../utils/formatters';
import { calcularTarifaBaseEstudiante, calcularSumaProgramasRecurrentes, calcularMontoCobroJusto } from '../utils/calculations';
import { buscarEstudianteDuplicado } from '../servicios/estudiantesApi';
import { generarAlertasAsistenciales } from '../utils/validacionAsistencial';

interface Props {
    abierto: boolean;
    onCerrar: () => void;
    onGuardar: (estudiante: Estudiante) => Promise<void>;
    estudianteActual: Estudiante | null;
    cargando: boolean;
    /**
     * Datos pre-cargados de una solicitud pública pendiente (RegistroTemporal) que el
     * tenant está aprobando. A diferencia de estudianteActual, NO activa el modo edición:
     * sigue siendo un alta nueva (sede/método de pago/matrícula quedan visibles y editables)
     * pero con los campos ya rellenos para que el tenant solo revise y complete lo que falta.
     */
    borrador?: Partial<Estudiante> | null;
}

export const calcularEdadYGrupo = (fechaNacimiento: string): { edad: number, grupo: GrupoEdad } => {
    if (!fechaNacimiento) return { edad: 0, grupo: GrupoEdad.NoAsignado };
    const hoy = new Date();
    const [anio, mesNacimiento, dia] = fechaNacimiento.split('-').map(Number);
    const nacimiento = new Date(anio, mesNacimiento - 1, dia);
    if (isNaN(nacimiento.getTime())) return { edad: 0, grupo: GrupoEdad.NoAsignado };
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const mes = hoy.getMonth() - nacimiento.getMonth();
    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) edad--;
    if (edad >= 3 && edad <= 6) return { edad, grupo: GrupoEdad.Infantil };
    if (edad >= 7 && edad <= 12) return { edad, grupo: GrupoEdad.Precadetes };
    if (edad >= 13 && edad <= 17) return { edad, grupo: GrupoEdad.Cadetes };
    if (edad >= 18) return { edad, grupo: GrupoEdad.Adultos };
    return { edad, grupo: GrupoEdad.NoAsignado };
};

export const schemaEstudiante = yup.object({
    nombres: yup.string().trim().required('Los nombres son obligatorios.'),
    apellidos: yup.string().trim().required('Los apellidos son obligatorios.'),
    numeroIdentificacion: yup.string().trim().required('La identificación es obligatoria.'),
    fechaNacimiento: yup.string().required('La fecha de nacimiento es obligatoria.'),
    grado: yup.string().oneOf(Object.values(GradoTKD)).required('El grado es obligatorio.'),
    grupo: yup.string().oneOf(Object.values(GrupoEdad)).required(),
    horasAcumuladasGrado: yup.number().typeError('Debe ser un número.').min(0).required(),
    sedeId: yup.string().required('Debe seleccionar una sede.'),
    telefono: yup.string().trim().optional(),
    correo: yup.string().trim().email('Correo inválido.'),
    fechaIngreso: yup.string().required(),
    estadoPago: yup.string().oneOf(Object.values(EstadoPago)).required(),
    saldoDeudor: yup.number().default(0),
    consentimientoInformado: yup.boolean().default(false),
    contratoServiciosFirmado: yup.boolean().default(false),
    consentimientoImagenFirmado: yup.boolean().default(false),
    consentimientoFotosVideos: yup.boolean().default(false),
    alergias: yup.string().optional(),
    lesiones: yup.string().optional(),
    eps: yup.string().optional(),
    rh: yup.string().optional(),
    direccion: yup.string().optional(),
    barrio: yup.string().optional(),
    programasInscritos: yup.array().optional().default([]),
    tutor: yup.object().when('fechaNacimiento', {
        is: (fechaNacimiento: string) => {
            const { edad } = calcularEdadYGrupo(fechaNacimiento);
            return edad > 0 && edad < 18;
        },
        then: () => yup.object({
            nombres: yup.string().required('El nombre del tutor es obligatorio para menores.'),
            numeroIdentificacion: yup.string().required('La identificación del tutor es obligatoria.'),
            correo: yup.string().email('Correo inválido.').required('El correo del tutor es obligatorio.'),
            telefono: yup.string().required('El teléfono del tutor es obligatorio.')
        }),
        otherwise: () => yup.object().optional().nullable()
    }),
    cobrarInscripcion: yup.boolean().default(true),
    metodoPago: yup.string().oneOf(['efectivo', 'link']).default('efectivo'),
    cobrarMesSiguiente: yup.boolean().default(false),
    montoCobroJustoAlIngreso: yup.number().optional(),
    enviarInvitacionLoginEstudiante: yup.boolean().default(false),
    enviarInvitacionLoginTutor: yup.boolean().default(false)
}).required();

const FormularioEstudiante: React.FC<Props> = ({ abierto, onCerrar, onGuardar, estudianteActual, cargando, borrador }) => {
    const { sedesVisibles } = useSedes();
    const { programas } = useProgramas();
    const { configClub } = useConfiguracion();

    const crearDefaultsEstudiante = () => ({
        grado: GradoTKD.Blanco,
        grupo: GrupoEdad.NoAsignado,
        estadoPago: EstadoPago.AlDia,
        programasInscritos: [],
        fechaIngreso: new Date().toISOString().split('T')[0],
        horasAcumuladasGrado: 0,
        cobrarInscripcion: true,
        eps: '',
        rh: '',
        direccion: '',
        barrio: '',
        metodoPago: 'efectivo',
        cobrarMesSiguiente: false,
        enviarInvitacionLoginEstudiante: !!configClub.configuracionCuentasExternas?.invitarEstudianteAlCrear,
        // Fix tutor-role-end-to-end (2026-07-14): la invitación al TUTOR viene tildada por
        // defecto en registros nuevos (el padre = usuario real del sistema en un dojo de
        // menores). El club puede desactivarla poniendo invitarTutorAlCrear: false.
        enviarInvitacionLoginTutor: configClub.configuracionCuentasExternas?.invitarTutorAlCrear !== false,
        // Solicitud pública pendiente de aprobación: precarga lo que el aspirante ya envió,
        // el tenant revisa/completa (sede, identificación, método de pago) antes de guardar.
        ...(borrador || {})
    });

    const { register, handleSubmit, formState: { errors, isValid }, watch, setValue, reset } = useForm<any>({
        resolver: yupResolver(schemaEstudiante),
        mode: 'onChange',
        defaultValues: estudianteActual ? {
            ...estudianteActual,
            enviarInvitacionLoginEstudiante: false,
            enviarInvitacionLoginTutor: false
        } : crearDefaultsEstudiante()
    });

    // Fix 2026-07-21 (`npm run typecheck`): react-hook-form tipa un grupo ANIDADO como
    // `FieldError | Merge<FieldError, FieldErrorsImpl<any>>` -- un union que no expone las
    // claves hijas, asi que `errors.tutor?.nombres` no compilaba (los campos planos como
    // `errors.nombres` si, por eso solo fallaban los 4 del tutor). Se acota una sola vez
    // aca en vez de castear en cada uno de los 4 usos.
    const erroresTutor = errors.tutor as Record<string, { message?: string } | undefined> | undefined;

    const watchedSedeId = watch('sedeId');
    const watchedProgramas = watch('programasInscritos') || [];
    const watchedFechaNacimiento = watch('fechaNacimiento');
    const watchedMetodoPago = watch('metodoPago') || 'efectivo';
    const watchedCorreo = watch('correo') || '';
    const watchedTutorCorreo = watch('tutor.correo') || '';
    const watchedTelefono = watch('telefono') || '';
    const watchedNumeroIdentificacion = watch('numeroIdentificacion') || '';
    const watchedNombres = watch('nombres') || '';
    const watchedApellidos = watch('apellidos') || '';
    const watchedTutorNombres = watch('tutor.nombres') || '';
    // Firebase Auth exige 1 correo = 1 cuenta = 1 rol: si alumno y tutor comparten correo
    // (caso típico de menores sin correo propio), NO se puede invitar a ambos -- la segunda
    // invitación explota en el backend con "Ya existe un usuario con el email X"
    // (functions/academico/invitaciones.js). El acceso del Tutor ya alcanza el contenido del
    // hijo (Centro de Estudios/Agenda/Buzón resuelven por tutor.correo == correo del alumno),
    // así que la invitación al alumno queda bloqueada en este caso.
    const correoCoincideConTutor = !!watchedCorreo && !!watchedTutorCorreo
        && watchedCorreo.toLowerCase().trim() === watchedTutorCorreo.toLowerCase().trim();

    const { usuario } = useAuth();
    const esAdmin = usuario?.rol === RolUsuario.Admin || usuario?.rol === RolUsuario.SuperAdmin || usuario?.rol === RolUsuario.Editor;
    const diaHoy = new Date().getDate();
    const esFinDeMes = diaHoy >= 26;
    // "Cobro Justo" (evolución opt-in de la Regla de Fin de Mes): si el tenant la activó,
    // desde el día 10 se reemplaza el toggle "todo o nada" por el monto real prorrateado.
    const esCobroJustoActivo = !!configClub.cobroJustoActivo;
    const aplicaCobroJusto = esCobroJustoActivo && diaHoy >= 10;
    const edadCalculada = calcularEdadYGrupo(watchedFechaNacimiento).edad;
    const esMenor = edadCalculada > 0 && edadCalculada < 18;

    // Registro de los 3 campos que se chequean contra duplicados en blur -- se guarda la
    // referencia para poder envolver su `onBlur` (dispara handleBlurDuplicado) sin perder el
    // onBlur propio de react-hook-form (que dispara la validación de yup).
    const campoNumeroIdentificacion = register('numeroIdentificacion');
    const campoTelefono = register('telefono');
    const campoCorreo = register('correo');

    // Chequeo de duplicados en vivo (on-blur) contra `estudiantes` del propio tenant -- acá SÍ
    // hay sesión y permiso real (firestore.rules permite a Instructor leer estudiantes de su
    // tenant), así que se consulta Firestore directo sin pasar por Cloud Function, y se puede
    // mostrar el nombre del alumno encontrado (a diferencia del formulario público, sin auth).
    const [duplicadosEncontrados, setDuplicadosEncontrados] = useState<Partial<Record<'correo' | 'telefono' | 'numeroIdentificacion', string>>>({});

    // Alertas pendientes de confirmar (patrón "preguntar y confirmar", nunca rechazo
    // silencioso): edad implausible/inusual, nombre calcado del tutor, o un duplicado
    // detectado. Si hay alguna, se frena el guardado real hasta que el tenant confirme.
    const [alertasPendientes, setAlertasPendientes] = useState<string[]>([]);
    const [datosAConfirmar, setDatosAConfirmar] = useState<any | null>(null);
    const [confirmandoGuardado, setConfirmandoGuardado] = useState(false);

    const handleBlurDuplicado = async (campo: 'correo' | 'telefono' | 'numeroIdentificacion', valor: string) => {
        if (!usuario?.tenantId || !valor.trim()) {
            setDuplicadosEncontrados(prev => ({ ...prev, [campo]: undefined }));
            return;
        }
        try {
            const match = await buscarEstudianteDuplicado(usuario.tenantId, campo, valor, estudianteActual?.id);
            setDuplicadosEncontrados(prev => ({ ...prev, [campo]: match ? `${match.nombres} ${match.apellidos}` : undefined }));
        } catch (e) {
            // Silencioso -- es una ayuda no bloqueante, un fallo de red no debe frenar la carga.
            console.error(e);
        }
    };

    const construirAlertas = (): string[] => {
        const alertas = generarAlertasAsistenciales({
            edad: watchedFechaNacimiento ? edadCalculada : null,
            nombres: watchedNombres,
            apellidos: watchedApellidos,
            tutorNombres: watchedTutorNombres
        });
        if (duplicadosEncontrados.correo) alertas.push(`Ya existe un alumno con este correo: ${duplicadosEncontrados.correo}`);
        if (duplicadosEncontrados.telefono) alertas.push(`Ya existe un alumno con este teléfono: ${duplicadosEncontrados.telefono}`);
        if (duplicadosEncontrados.numeroIdentificacion) alertas.push(`Ya existe un alumno con esta identificación: ${duplicadosEncontrados.numeroIdentificacion}`);
        return alertas;
    };

    const handleConfirmarGuardado = async () => {
        if (!datosAConfirmar) return;
        setConfirmandoGuardado(true);
        try {
            await onGuardar(datosAConfirmar);
            onCerrar();
        } finally {
            setConfirmandoGuardado(false);
            setAlertasPendientes([]);
            setDatosAConfirmar(null);
        }
    };

    useEffect(() => {
        setValue('grupo', calcularEdadYGrupo(watchedFechaNacimiento).grupo, { shouldValidate: true });
    }, [watchedFechaNacimiento, setValue]);

    // Si el checkbox de invitación al alumno quedó marcado de antes y el usuario edita el
    // correo hasta que coincide con el del tutor, el input se deshabilita pero react-hook-form
    // no limpia solo su valor -- sin esto, el submit igual mandaría ambas invitaciones.
    useEffect(() => {
        if (correoCoincideConTutor) {
            setValue('enviarInvitacionLoginEstudiante', false);
        }
    }, [correoCoincideConTutor, setValue]);

    // Cálculos dinámicos de facturación para el resumen
    const resumenCobros = useMemo(() => {
        const base = calcularTarifaBaseEstudiante({ sedeId: watchedSedeId } as any, configClub, sedesVisibles);
        const extras = calcularSumaProgramasRecurrentes({ programasInscritos: watchedProgramas } as any, programas);
        return { base, extras, total: base + extras };
    }, [watchedSedeId, watchedProgramas, configClub, sedesVisibles, programas]);

    const montoCobroJusto = useMemo(
        () => calcularMontoCobroJusto(resumenCobros.base),
        [resumenCobros.base]
    );

    // Se persiste junto con el resto del estudiante (igual que cobrarMesSiguiente) solo cuando
    // realmente aplica -- es el mismo monto ya mostrado al staff en el bloque "Cobro Justo".
    useEffect(() => {
        setValue('montoCobroJustoAlIngreso', (!estudianteActual && aplicaCobroJusto) ? montoCobroJusto : undefined);
    }, [estudianteActual, aplicaCobroJusto, montoCobroJusto, setValue]);

    const togglePrograma = (prog: any) => {
        const yaInscrito = watchedProgramas.find((i: any) => i.idPrograma === prog.id);
        if (yaInscrito) {
            setValue('programasInscritos', watchedProgramas.filter((i: any) => i.idPrograma !== prog.id), { shouldValidate: true });
        } else {
            const nueva = { idPrograma: prog.id, nombrePrograma: prog.nombre, fechaInscripcion: new Date().toISOString().split('T')[0] };
            setValue('programasInscritos', [...watchedProgramas, nueva], { shouldValidate: true });
        }
    };

    useEffect(() => {
        if (abierto) reset(estudianteActual ? {
            ...estudianteActual,
            enviarInvitacionLoginEstudiante: false,
            enviarInvitacionLoginTutor: false
        } : crearDefaultsEstudiante());
    }, [abierto, estudianteActual, borrador, reset, configClub.configuracionCuentasExternas?.invitarEstudianteAlCrear, configClub.configuracionCuentasExternas?.invitarTutorAlCrear]);

    const onSubmit = async (data: any) => {
        // Cuando este formulario se abre desde "revisar y aprobar" (Misión Kicho, `borrador`
        // presente), MisionKicho.handleGuardarAprobacion YA vuelve a chequear con
        // detectarInconsistencias (más rico: también formato y duplicados contra el resto del
        // lote) antes de crear el estudiante -- confirmar acá también preguntaría lo mismo dos
        // veces seguidas. Se deja un solo punto de confirmación, el de MisionKicho, para ese caso.
        if (!borrador) {
            const alertas = construirAlertas();
            if (alertas.length > 0) {
                setAlertasPendientes(alertas);
                setDatosAConfirmar(data);
                return;
            }
        }
        await onGuardar(data);
        onCerrar();
    };

    if (!abierto) return null;

    return (
        <>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-tkd-dark/80 p-4 animate-fade-in backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-900 rounded-[3rem] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-white/10">
                <header className="p-8 border-b dark:border-gray-800 flex justify-between items-center">
                    <h2 className="text-2xl font-black uppercase text-tkd-dark dark:text-white tracking-tighter">{estudianteActual ? 'Editar Ficha' : borrador ? 'Aprobar Solicitud de Registro' : 'Nuevo Registro Técnico'}</h2>
                    <button onClick={onCerrar} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all"><IconoCerrar className="w-6 h-6 text-gray-400" /></button>
                </header>

                <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-8 grid grid-cols-1 lg:grid-cols-2 gap-10 no-scrollbar">
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label htmlFor="nombres" className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nombres</label>
                                <input id="nombres" {...register('nombres')} placeholder="NOMBRES" className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl p-4 text-sm font-black dark:text-white" />
                                <FormInputError mensaje={errors.nombres?.message as string} />
                            </div>
                            <div className="space-y-1">
                                <label htmlFor="apellidos" className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Apellidos</label>
                                <input id="apellidos" {...register('apellidos')} placeholder="APELLIDOS" className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl p-4 text-sm font-black dark:text-white" />
                                <FormInputError mensaje={errors.apellidos?.message as string} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label htmlFor="numeroIdentificacion" className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Identificación</label>
                                <input id="numeroIdentificacion" {...campoNumeroIdentificacion} onBlur={(e) => { campoNumeroIdentificacion.onBlur(e); handleBlurDuplicado('numeroIdentificacion', e.target.value); }} placeholder="ID / DOCUMENTO" className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl p-4 text-sm font-black dark:text-white" />
                                <FormInputError mensaje={errors.numeroIdentificacion?.message as string} />
                                {duplicadosEncontrados.numeroIdentificacion && (
                                    <p className="text-[10px] font-bold text-amber-600 uppercase mt-1">Ya existe un alumno con esta identificación: {duplicadosEncontrados.numeroIdentificacion}</p>
                                )}
                            </div>
                            <div className="space-y-1">
                                <label htmlFor="fechaNacimiento" className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nacimiento</label>
                                <input id="fechaNacimiento" type="date" {...register('fechaNacimiento')} className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl p-4 text-sm font-black dark:text-white uppercase" />
                                <FormInputError mensaje={errors.fechaNacimiento?.message as string} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label htmlFor="grado" className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Grado Actual</label>
                                <select id="grado" {...register('grado')} className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl p-4 text-sm font-black dark:text-white">
                                    {Object.values(GradoTKD).map(g => <option key={g} value={g}>{g}</option>)}
                                </select>
                                <FormInputError mensaje={errors.grado?.message as string} />
                            </div>
                            <div className="space-y-1">
                                <label htmlFor="grupo" className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Grupo Técnico</label>
                                <select id="grupo" {...register('grupo')} className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl p-4 text-sm font-black dark:text-white">
                                    {Object.values(GrupoEdad).map(g => <option key={g} value={g}>{g}</option>)}
                                </select>
                                <FormInputError mensaje={errors.grupo?.message as string} />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-1">
                                <label htmlFor="fechaIngreso" className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Ingreso</label>
                                <input id="fechaIngreso" type="date" {...register('fechaIngreso')} className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl p-4 text-sm font-black dark:text-white" />
                                <FormInputError mensaje={errors.fechaIngreso?.message as string} />
                            </div>
                            <div className="space-y-1">
                                <label htmlFor="horasAcumuladasGrado" className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Horas Acum.</label>
                                <input id="horasAcumuladasGrado" type="number" {...register('horasAcumuladasGrado')} className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl p-4 text-sm font-black dark:text-white" />
                                <FormInputError mensaje={errors.horasAcumuladasGrado?.message as string} />
                            </div>
                            <div className="space-y-1">
                                <label htmlFor="estadoPago" className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Estado</label>
                                <select id="estadoPago" {...register('estadoPago')} className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl p-4 text-sm font-black dark:text-white">
                                    {Object.values(EstadoPago).map(e => <option key={e} value={e}>{e}</option>)}
                                </select>
                                <FormInputError mensaje={errors.estadoPago?.message as string} />
                            </div>
                        </div>

                        {sedesVisibles.length > 0 ? (
                            <div className="p-6 bg-blue-50 dark:bg-blue-900/10 rounded-3xl border border-blue-100 dark:border-blue-900/30">
                                <label htmlFor="sedeId" className="text-[10px] font-black uppercase text-tkd-blue mb-2 block tracking-widest">Sede de Entrenamiento <span className="text-tkd-red">*</span></label>
                                <select id="sedeId" {...register('sedeId')} className="w-full bg-white dark:bg-gray-800 border-none rounded-xl p-4 text-sm font-black dark:text-white">
                                    <option value="">Seleccionar Sede...</option>
                                    {sedesVisibles.map(s => (
                                        <option key={s.id} value={s.id}>
                                            {`${s.nombre}${s.ciudad ? ` (${s.ciudad})` : ''}`}
                                        </option>
                                    ))}
                                </select>
                                <FormInputError mensaje={errors.sedeId?.message as string} />
                            </div>
                        ) : (
                            <div className="p-6 bg-red-50 dark:bg-red-900/10 rounded-3xl border border-red-100 dark:border-red-900/30">
                                <p className="text-[10px] font-black uppercase text-tkd-red tracking-widest">⚠️ Error Crítico</p>
                                <p className="text-xs font-bold text-gray-600 dark:text-gray-300 mt-2">No has configurado ninguna sede. Debes registrar al menos una sede en Configuración para poder agregar alumnos.</p>
                                <input type="hidden" {...register('sedeId')} value="" />
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label htmlFor="eps" className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">EPS / Salud</label>
                                <input id="eps" {...register('eps')} placeholder="EPS" className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl p-4 text-sm font-black dark:text-white" />
                            </div>
                            <div className="space-y-1">
                                <label htmlFor="rh" className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">RH / Sangre</label>
                                <select id="rh" {...register('rh')} className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl p-4 text-sm font-black dark:text-white">
                                    <option value="">Seleccionar...</option>
                                    {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <div className="space-y-1">
                                <label htmlFor="direccion" className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Dirección de Residencia</label>
                                <input id="direccion" {...register('direccion')} placeholder="DIRECCIÓN" className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl p-4 text-sm font-black dark:text-white" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label htmlFor="barrio" className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Barrio</label>
                                <input id="barrio" {...register('barrio')} placeholder="BARRIO" className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl p-4 text-sm font-black dark:text-white" />
                            </div>
                            <div className="space-y-1">
                                <label htmlFor="telefono" className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Teléfono</label>
                                <input id="telefono" {...campoTelefono} onBlur={(e) => { campoTelefono.onBlur(e); handleBlurDuplicado('telefono', e.target.value); }} placeholder="TELÉFONO" className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl p-4 text-sm font-black dark:text-white" />
                                <FormInputError mensaje={errors.telefono?.message as string} />
                                {duplicadosEncontrados.telefono && (
                                    <p className="text-[10px] font-bold text-amber-600 uppercase mt-1">Ya existe un alumno con este teléfono: {duplicadosEncontrados.telefono}</p>
                                )}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label htmlFor="correo" className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Email</label>
                            <input id="correo" {...campoCorreo} onBlur={(e) => { campoCorreo.onBlur(e); handleBlurDuplicado('correo', e.target.value); }} placeholder="EMAIL" className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl p-4 text-sm font-black dark:text-white" />
                            <FormInputError mensaje={errors.correo?.message as string} />
                            {duplicadosEncontrados.correo && (
                                <p className="text-[10px] font-bold text-amber-600 uppercase mt-1">Ya existe un alumno con este correo: {duplicadosEncontrados.correo}</p>
                            )}
                        </div>

                        {esMenor && (
                            <div className="pt-8 border-t dark:border-gray-800 animate-slide-in-right space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-tkd-red/10 rounded-2xl flex items-center justify-center">
                                        <IconoUsuario className="w-5 h-5 text-tkd-red" />
                                    </div>
                                    <h3 className="text-sm font-black uppercase text-tkd-dark dark:text-white tracking-widest">Acudiente Responsable</h3>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nombres Completos Tutor</label>
                                        <input {...register('tutor.nombres')} placeholder="NOMBRE DEL TUTOR" className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl p-4 text-sm font-black dark:text-white" />
                                        <FormInputError mensaje={erroresTutor?.nombres?.message} />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Cédula Tutor</label>
                                        <input {...register('tutor.numeroIdentificacion')} placeholder="CÉDULA" className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl p-4 text-sm font-black dark:text-white" />
                                        <FormInputError mensaje={erroresTutor?.numeroIdentificacion?.message} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Correo Tutor</label>
                                        <input type="email" {...register('tutor.correo')} placeholder="EMAIL TUTOR" className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl p-4 text-sm font-black dark:text-white" />
                                        <FormInputError mensaje={erroresTutor?.correo?.message} />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Teléfono / WhatsApp</label>
                                        <input {...register('tutor.telefono')} placeholder="TELÉFONO TUTOR" className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl p-4 text-sm font-black dark:text-white" />
                                        <FormInputError mensaje={erroresTutor?.telefono?.message} />
                                    </div>
                                </div>
                            </div>
                        )}


                        {/* Fix tutor-role-end-to-end (2026-07-14): en un dojo de menores quien
                            loguea es el PADRE/ACUDIENTE (rol Tutor), no el niño. El acceso digital
                            por defecto invita al TUTOR (rol=Tutor) a su correo — así cada registro,
                            uno a uno, deja al padre clasificado como Tutor sin asignación manual.
                            Se mantiene además la opción de login del propio alumno para dojos que la
                            usen (estudiantes mayores). */}
                        {configClub.configuracionCuentasExternas?.loginEstudiantesActivo && (
                            <div className="p-6 bg-blue-50 dark:bg-blue-900/10 rounded-3xl border border-blue-100 dark:border-blue-900/30 space-y-4">
                                <div>
                                    <p className="text-[10px] font-black uppercase text-tkd-blue tracking-[0.25em]">Acceso digital</p>
                                    <h4 className="text-sm font-black uppercase text-gray-900 dark:text-white mt-1">Login del padre / acudiente (Tutor)</h4>
                                    <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 mt-2 leading-relaxed uppercase">
                                        Envía una invitación oficial para que el padre/acudiente cree su contraseña y siga el progreso de su hijo. Queda con rol de Tutor automáticamente.
                                    </p>
                                </div>

                                <label className={`flex items-start gap-3 p-4 rounded-2xl border-2 transition-all ${watchedTutorCorreo ? 'bg-white dark:bg-gray-800 border-blue-100 dark:border-blue-900/40 cursor-pointer' : 'bg-gray-100 dark:bg-gray-800/50 border-gray-100 dark:border-white/5 opacity-60 cursor-not-allowed'}`}>
                                    <input
                                        type="checkbox"
                                        {...register('enviarInvitacionLoginTutor')}
                                        disabled={!watchedTutorCorreo}
                                        className="w-5 h-5 accent-tkd-blue mt-0.5"
                                    />
                                    <span>
                                        <span className="block text-xs font-black uppercase text-gray-900 dark:text-white">Enviar invitación de login al tutor</span>
                                        <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">
                                            {watchedTutorCorreo ? `Destino: ${watchedTutorCorreo}` : 'Primero registra el correo del tutor.'}
                                        </span>
                                    </span>
                                </label>

                                <label className={`flex items-start gap-3 p-4 rounded-2xl border-2 transition-all ${watchedCorreo && !correoCoincideConTutor ? 'bg-white dark:bg-gray-800 border-blue-100 dark:border-blue-900/40 cursor-pointer' : 'bg-gray-100 dark:bg-gray-800/50 border-gray-100 dark:border-white/5 opacity-60 cursor-not-allowed'}`}>
                                    <input
                                        type="checkbox"
                                        {...register('enviarInvitacionLoginEstudiante')}
                                        disabled={!watchedCorreo || correoCoincideConTutor}
                                        className="w-5 h-5 accent-tkd-blue mt-0.5"
                                    />
                                    <span>
                                        <span className="block text-xs font-black uppercase text-gray-900 dark:text-white">Enviar invitación de login al alumno (opcional)</span>
                                        <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">
                                            {correoCoincideConTutor
                                                ? 'Es el mismo correo del tutor: ya accede a este contenido con su login de Tutor.'
                                                : (watchedCorreo ? `Destino: ${watchedCorreo}` : 'Solo si el alumno tiene correo propio.')}
                                        </span>
                                    </span>
                                </label>
                            </div>
                        )}

                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase text-gray-400 mb-2 block tracking-widest">Programas Extra (Recurrentes)</label>
                            <div className="grid gap-3">
                                {programas.map(p => {
                                    const isSelected = watchedProgramas.some((i: any) => i.idPrograma === p.id);
                                    return (
                                        <div key={p.id} onClick={() => togglePrograma(p)} className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex justify-between items-center ${isSelected ? 'bg-tkd-blue/5 border-tkd-blue' : 'bg-gray-50 dark:bg-gray-800 border-transparent opacity-60'}`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${isSelected ? 'bg-tkd-blue text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-400'}`}><IconoLogoOficial className="w-4 h-4" /></div>
                                                <div>
                                                    <p className="text-[11px] font-black uppercase dark:text-white leading-none">{p.nombre}</p>
                                                    <p className="text-[9px] font-bold text-gray-400 mt-1">{p.tipoCobro}</p>
                                                </div>
                                            </div>
                                            <p className="text-xs font-black text-tkd-blue">+{formatearPrecio(p.valor)}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* RESUMEN DE COBROS TOTALIZADOS */}
                    <div className="space-y-8">
                        <div className="bg-tkd-dark text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden border border-white/5">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-tkd-red mb-6">Proyección Mensual de Facturación</h3>
                            <div className="space-y-4 relative z-10">
                                <div className="flex justify-between items-center text-gray-400">
                                    <span className="text-[10px] font-bold uppercase tracking-widest">Membresía Base (Sede)</span>
                                    <span className="font-black text-xs">{formatearPrecio(resumenCobros.base)}</span>
                                </div>
                                <div className="flex justify-between items-center text-gray-400">
                                    <span className="text-[10px] font-bold uppercase tracking-widest">Extras Programas</span>
                                    <span className="font-black text-xs">+{formatearPrecio(resumenCobros.extras)}</span>
                                </div>
                                <div className="h-px bg-white/10 my-4"></div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-black uppercase text-tkd-blue tracking-widest">Total Mensualidad</span>
                                    <span className="text-3xl font-black tracking-tighter text-white">{formatearPrecio(resumenCobros.total)}</span>
                                </div>
                            </div>
                            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-tkd-blue/10 rounded-full blur-3xl"></div>
                        </div>

                        <div className="p-8 bg-gray-50 dark:bg-gray-800/50 rounded-[2.5rem] space-y-6">
                            {/* Selector de Método de Pago */}
                            {!estudianteActual && (
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block ml-1">Método de Pago Inicial</label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div 
                                            onClick={() => setValue('metodoPago', 'efectivo', { shouldValidate: true })} 
                                            className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                                                watchedMetodoPago === 'efectivo' 
                                                    ? 'bg-tkd-blue/5 border-tkd-blue shadow-lg shadow-tkd-blue/5' 
                                                    : 'bg-white dark:bg-gray-700/30 border-gray-100 dark:border-gray-600 hover:border-gray-200 dark:hover:border-gray-500'
                                            }`}
                                        >
                                            <span className="text-2xl">💵</span>
                                            <span className="text-[10px] font-black uppercase tracking-wider dark:text-white">Pago en Efectivo</span>
                                        </div>
                                        <div 
                                            onClick={() => setValue('metodoPago', 'link', { shouldValidate: true })} 
                                            className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                                                watchedMetodoPago === 'link' 
                                                    ? 'bg-tkd-blue/5 border-tkd-blue shadow-lg shadow-tkd-blue/5' 
                                                    : 'bg-white dark:bg-gray-700/30 border-gray-100 dark:border-gray-600 hover:border-gray-200 dark:hover:border-gray-500'
                                            }`}
                                        >
                                            <span className="text-2xl">🔗</span>
                                            <span className="text-[10px] font-black uppercase tracking-wider dark:text-white">Link de Cobro</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Toggle Cobro Matrícula */}
                            {!estudianteActual && (
                                <div className="flex items-center justify-between bg-white dark:bg-gray-700/50 p-6 rounded-2xl border border-gray-100 dark:border-gray-600 shadow-sm relative overflow-hidden">
                                    <div className="z-10 relative">
                                        <p className="text-[10px] font-black uppercase text-tkd-blue tracking-[0.2em] mb-1">Pago Único Inicial</p>
                                        <h4 className="text-sm font-black uppercase text-gray-900 dark:text-white">Matrícula / Formulario</h4>
                                        <p className="text-[10px] font-bold text-gray-400 mt-2">
                                            Valor: <span className="text-tkd-dark dark:text-gray-200">{formatearPrecio(configClub.valorMatricula || 0)}</span>
                                            {configClub.activarMatriculaAnual && <span className="ml-2 text-tkd-red font-black"> (ANUAL)</span>}
                                        </p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer z-10">
                                        <input type="checkbox" {...register('cobrarInscripcion')} className="sr-only peer" />
                                        <div className="w-14 h-8 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 dark:peer-focus:ring-blue-900 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all dark:border-gray-500 peer-checked:bg-tkd-blue"></div>
                                    </label>
                                    <div className="absolute right-0 top-0 w-20 h-full bg-gradient-to-l from-white/80 dark:from-black/20 to-transparent pointer-events-none"></div>
                                </div>
                            )}

                            {/* Regla de Fin de Mes (a partir del día 26) -- solo si el tenant NO activó
                                Cobro Justo. Con Cobro Justo activo, el bloque de abajo la reemplaza. */}
                            {!estudianteActual && !esCobroJustoActivo && esFinDeMes && esAdmin && (
                                <div className="space-y-4 p-6 bg-amber-50 dark:bg-amber-900/10 rounded-3xl border border-amber-100 dark:border-amber-900/30">
                                    <div className="flex gap-3">
                                        <span className="text-2xl">⚠️</span>
                                        <div>
                                            <p className="text-[10px] font-black uppercase text-amber-800 dark:text-amber-400 tracking-wider">Gestión de Fin de Mes (Día 26+)</p>
                                            <p className="text-xs text-amber-700 dark:text-amber-300 font-bold mt-1 leading-relaxed">
                                                Los días restantes del mes actual deben gestionarse de manera interna en el club.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="h-px bg-amber-200/50 dark:bg-amber-900/50 my-1"></div>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs font-black uppercase text-gray-900 dark:text-white">Abonar a mes siguiente</p>
                                            <p className="text-[9px] font-bold text-gray-400 mt-0.5">Diferir cobro de la primera mensualidad al próximo mes.</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" {...register('cobrarMesSiguiente')} className="sr-only peer" />
                                            <div className="w-14 h-8 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-100 dark:peer-focus:ring-amber-900 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all dark:border-gray-500 peer-checked:bg-amber-500"></div>
                                        </label>
                                    </div>
                                </div>
                            )}

                            {/* Cobro Justo (a partir del día 10, opt-in por tenant): reemplaza el
                                toggle "todo o nada" por el monto real prorrateado, informativo. */}
                            {!estudianteActual && aplicaCobroJusto && esAdmin && (
                                <div className="space-y-4 p-6 bg-blue-50 dark:bg-blue-900/10 rounded-3xl border border-blue-100 dark:border-blue-900/30">
                                    <div className="flex gap-3">
                                        <IconoProrateo className="w-8 h-8 text-tkd-blue flex-shrink-0" />
                                        <div>
                                            <p className="text-[10px] font-black uppercase text-tkd-blue tracking-wider">Cobro Justo (Día 10+)</p>
                                            <p className="text-xs text-blue-900 dark:text-blue-200 font-bold mt-1 leading-relaxed">
                                                Como el ingreso es del día 10 en adelante, solo se cobra lo que queda del mes.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="h-px bg-blue-200/50 dark:bg-blue-900/50 my-1"></div>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs font-black uppercase text-gray-900 dark:text-white">Primera mensualidad prorrateada</p>
                                            <p className="text-[9px] font-bold text-gray-400 mt-0.5">En vez de {formatearPrecio(resumenCobros.base)} del mes completo.</p>
                                        </div>
                                        <p className="text-lg font-black text-tkd-blue">{formatearPrecio(montoCobroJusto)}</p>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center gap-3">
                                <IconoInformacion className="w-5 h-5 text-gray-400" />
                                <p className="text-[10px] font-bold text-gray-500 uppercase leading-relaxed">Este valor se generará como cobro recurrente cada día {Math.round(configClub.diasSuspension / 6) || 5} de mes.</p>
                            </div>
                            <button type="submit" disabled={!isValid || cargando} className="w-full bg-tkd-red text-white py-6 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-red-700 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 disabled:scale-100">
                                {cargando ? <div className="w-5 h-5 border-4 border-white border-t-transparent rounded-full animate-spin"></div> : <IconoAprobar className="w-6 h-6" />}
                                Finalizar y Registrar
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
        <ModalConfirmacion
            abierto={alertasPendientes.length > 0}
            titulo="Revisa antes de guardar"
            mensaje={alertasPendientes.join(' · ')}
            onCerrar={() => { setAlertasPendientes([]); setDatosAConfirmar(null); }}
            onConfirmar={handleConfirmarGuardado}
            cargando={confirmandoGuardado}
            textoBotonConfirmar="Guardar de todas formas"
        />
        </>
    );
};

export default FormularioEstudiante;
