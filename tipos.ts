
// tipos.ts 

export enum RolUsuario {
    Admin = 'Admin',
    Editor = 'Editor',
    Asistente = 'Asistente',
    Estudiante = 'Estudiante',
    Tutor = 'Tutor',
    SuperAdmin = 'SuperAdmin'
}

export enum EtapaSoporte {
    Recibido = 1,
    Diagnostico = 2,
    Resolucion = 3,
    Verificado = 4
}

export interface TicketSoporte {
    id: string;
    tenantId: string;
    userId: string;
    userNombre: string;
    userEmail: string;
    asunto: string;
    resumenIA: string;
    estado: 'abierto' | 'proceso' | 'resuelto';
    etapa: EtapaSoporte;
    fechaCreacion: string;
    salaVideoUrl?: string | null;
    mensajesInternos?: string[];
}

export interface PuntoCalor {
    x: number;
    y: number;
    tipo: 'click' | 'move';
    rol?: string;
    ruta?: string;
    hora?: number;
    dia?: string;
    elemento?: string;
    intensidad: number;
}

export enum GradoTKD {
    Blanco = 'Blanco',
    BlancoPuntaAmarilla = 'Blanco Punta Amarilla',
    Amarillo = 'Amarillo',
    AmarilloPuntaVerde = 'Amarillo Punta Verde',
    Verde = 'Verde',
    VerdePuntaAzul = 'Verde Punta Azul',
    Azul = 'Azul',
    AzulPuntaRoja = 'Azul Punta Roja',
    Rojo = 'Rojo',
    RojoPuntaNegra = 'Rojo Punta Negra',
    Negro1Dan = 'Negro 1er Dan',
    Negro2Dan = 'Negro 2do Dan',
    Negro3Dan = 'Negro 3er Dan'
}

export enum GrupoEdad {
    Infantil = 'Infantil',
    Precadetes = 'Precadetes',
    Cadetes = 'Cadetes',
    Adultos = 'Adultos',
    NoAsignado = 'No Asignado'
}

export enum EstadoPago {
    AlDia = 'Al día',
    Pendiente = 'Pendiente',
    Vencido = 'Vencido'
}

export enum TipoCobroPrograma {
    Recurrente = 'Recurrente',
    Unico = 'Unico'
}

export interface BloqueHorario {
    id: string; // ID único para el bloque
    dia: 'Lunes' | 'Martes' | 'Miércoles' | 'Jueves' | 'Viernes' | 'Sábado' | 'Domingo';
    horaInicio: string;
    horaFin: string;
    sedeId: string;
    instructorId: string;
    grupo: GrupoEdad;
    nombrePrograma?: string; // Para facilitar la visualización sin joins costosos
    programaId?: string; // Referencia al programa padre
}

export interface Programa {
    id: string;
    tenantId: string;
    nombre: string;
    descripcion: string;
    tipoCobro: TipoCobroPrograma;
    valor: number;
    horario: string; // Descriptivo legacy
    bloquesHorarios?: BloqueHorario[]; // Estructurado nuevo
    activo: boolean;
}

export interface ConfiguracionClub {
    tenantId: string;
    slug: string;
    nombreClub: string;
    nit: string;
    representanteLegal: string;
    ccRepresentante: string;
    lugarFirma: string;
    duracionContratoMeses: number;
    valorMensualidad: number;
    valorInscripcion: number;
    moraPorcentaje: number;
    valorMatricula: number;   // Nuevo: Valor del formulario de matrícula
    activarMatriculaAnual: boolean; // Nuevo: Opción de activar cobro anual
    metodoPago: string;
    pagoNequi: string;
    pagoDaviplata: string;
    pagoBreB: string;
    pagoBanco: string;
    diasSuspension: number;
    direccionClub: string;
    colorPrimario: string;
    colorSecundario: string;
    colorAcento: string;
    emailClub?: string;
    estadoSuscripcion: 'activo' | 'suspendido' | 'demo';
    fechaVencimiento: string;
    plan: string;
    limiteEstudiantes: number;
    limiteUsuarios: number;
    limiteSedes: number;
    logoUrl?: string;
    logoOriginalUrl?: string; // Para backups
    passwordTemporal?: string;
    onboardingStep?: number; // 0: Inicio, 1: Info, 2: Branding (Opc), 3: Sede, 4: Equipo, 5: Completo
    activarFormularioInscripcion?: boolean; // Nuevo: Toggle para el formulario público
    configuracionCuentasExternas?: {
        loginEstudiantesActivo?: boolean;
        invitarEstudianteAlCrear?: boolean;
        invitarTutorAlCrear?: boolean;
    };
    features?: {
        centroEstudios?: boolean; // Módulo de estudio académico — activación por tenant
    };
}

export interface Estudiante {
    id: string;
    tenantId: string;
    nombres: string;
    apellidos: string;
    numeroIdentificacion: string;
    fechaNacimiento: string;
    grado: GradoTKD;
    grupo: GrupoEdad;
    horasAcumuladasGrado: number;
    sedeId: string;
    telefono: string;
    correo: string;
    fechaIngreso: string;
    estadoPago: EstadoPago;
    saldoDeudor: number;
    historialPagos: any[];
    consentimientoInformado: boolean;
    contratoServiciosFirmado: boolean;
    consentimientoImagenFirmado: boolean;
    consentimientoFotosVideos: boolean;
    carnetGenerado: boolean;
    alergias?: string;
    lesiones?: string;
    personasAutorizadas?: string;
    programasInscritos?: InscripcionPrograma[];
    eps?: string;
    rh?: string;
    direccion?: string;
    barrio?: string;
    tutor?: {
        nombres: string;
        apellidos: string;
        numeroIdentificacion: string;
        telefono: string;
        correo: string;
        firmaDigital?: string;
        firmaContratoDigital?: string;
        firmaImagenDigital?: string;
    };
    metodoPago?: 'efectivo' | 'link';
    cobrarMesSiguiente?: boolean;
}

export interface InscripcionPrograma {
    idPrograma: string;
    nombrePrograma: string;
    fechaInscripcion: string;
}

export enum EstadoSolicitud {
    Pendiente = 'Pendiente',
    Aprobada = 'Aprobada',
    Rechazada = 'Rechazada'
}

export enum CategoriaImplemento {
    Uniformes = 'Uniformes',
    ProteccionTorso = 'Protección Torso',
    ProteccionCabeza = 'Protección Cabeza',
    ProteccionExtremidades = 'Protección Extremidades',
    Accesorios = 'Accesorios'
}

export enum EstadoSolicitudCompra {
    Pendiente = 'Pendiente',
    Aprobada = 'Aprobada',
    Rechazada = 'Rechazada'
}

export enum TipoMovimiento {
    Ingreso = 'Ingreso',
    Egreso = 'Egreso'
}

export enum CategoriaFinanciera {
    Mensualidad = 'Mensualidad',
    Implementos = 'Implementos',
    Eventos = 'Eventos',
    Arriendo = 'Arriendo',
    Servicios = 'Servicios',
    Nomina = 'Nomina',
    Otros = 'Otros',
    Mora = 'Recargo por Mora',
    Inscripcion = 'Inscripción Nuevo Alumno'
}

export interface MovimientoFinanciero {
    id: string;
    tenantId: string;
    tipo: TipoMovimiento;
    categoria: string | CategoriaFinanciera;
    monto: number;
    descripcion: string;
    fecha: string;
    sedeId: string;
}

export interface TransaccionPago {
    id: string;
    tenantId: string;
    estudianteId: string;
    reciboId: string;
    montoTotal: number;
    fecha: string;
    estado: 'Completado' | 'Anulado';
    itemsPagados: {
        id: string;
        tipo: 'Tienda' | 'Evento' | 'Mensualidad' | 'Mora' | 'Matricula';
        monto: number;
    }[];
}

export interface Sede {
    id: string;
    tenantId: string;
    nombre: string;
    direccion: string;
    ciudad: string;
    telefono: string;
    valorMensualidad?: number;
    deletedAt?: string; // Para soft delete
}

export interface ConfiguracionNotificaciones {
    tenantId: string;
    diaCobroMensual: number;
    diasAnticipoRecordatorio: number;
    diasGraciaSuspension: number;
    frecuenciaSyncHoras: number;
    frecuenciaQueryApiDias: number;
}

export interface NotificacionHistorial {
    id: string;
    fecha: string;
    estudianteId: string;
    estudianteNombre: string;
    tutorNombre: string;
    destinatario: string;
    canal: 'WhatsApp' | 'Email';
    tipo: TipoNotificacion;
    mensaje: string;
    leida: boolean;
}

export enum TipoNotificacion {
    Bienvenida = 'Bienvenida',
    RecordatorioPago = 'RecordatorioPago',
    TalonPagoDisponible = 'TalonPagoDisponible',
    AvisoVencimiento = 'AvisoVencimiento',
    ConfirmacionCompra = 'ConfirmacionCompra',
    ConfirmacionInscripcionEvento = 'ConfirmacionInscripcionEvento',
    SolicitudCompraAdmin = 'SolicitudCompraAdmin'
}

export enum EstadoEntrega {
    EnClase = 'En Clase',
    Listo = 'Listo',
    Entregado = 'Entregado'
}

export interface Asistencia {
    id: string;
    estudianteId: string;
    sedeId: string;
    fecha: string;
    horaEntrada: string;
    horaSalida?: string;
    estadoEntrega: EstadoEntrega;
    recogidoPor?: string;
}

export interface MisionKicho {
    id: string;
    tenantId: string;
    nombreMision: string;
    fechaExpiracion: string;
    activa: boolean;
    registrosRecibidos: number;
    estadoLote: 'captura' | 'legalizado' | 'procesado';
    firmaLegalizacion?: string;
    fechaLegalizacion?: string;
    sedeId?: string; // Nuevo: Sede asignada a esta generación de Misión Kicho
}

export interface RegistroTemporal {
    id: string;
    tenantId: string;
    misionId: string;
    fechaRegistro: string;
    estado: 'pendiente' | 'verificado' | 'rechazado';
    datos: {
        nombres: string;
        apellidos: string;
        email: string;
        telefono: string;
        fechaNacimiento: string;
        eps?: string;
        rh?: string;
        direccion?: string;
        barrio?: string;
        tutorNombre?: string;
        tutorApellidos?: string;
        tutorCedula?: string;
        tutorTelefono?: string;
        tutorEmail?: string;
        parentesco?: string;
        sedeSugeridaId?: string;
    };
}

export interface Usuario {
    id: string;
    email: string;
    nombreUsuario: string;
    numeroIdentificacion: string;
    whatsapp: string;
    rol: RolUsuario;
    tenantId: string;
    sedeId?: string;
    fcmTokens?: string[];
    estadoContrato?: 'Pendiente' | 'Firmado' | 'Sin configurar';
    contrato?: {
        valorPago?: number; // Legacy: reemplazado por sueldoBase
        sueldoBase: number;
        duracionMeses: number;
        tipoVinculacion: TipoVinculacionColaborador;
        tipoVinculacionOtro?: string;
        fechaInicio: string;
        lugarEjecucion: string;
        firmado: boolean;
    };
    deletedAt?: string; // Soft delete: fecha de eliminación (ISO string)
}

export enum TipoVinculacionColaborador {
    Mes = 'Mes',
    Hora = 'Hora',
    Evento = 'Evento',
    Otro = 'Otro'
}

// Added fix: Exported Evento interface used in multiple views.
export interface Evento {
    id: string;
    tenantId: string;
    nombre: string;
    descripcion?: string;
    lugar: string;
    fechaEvento: string;
    fechaInicioInscripcion: string;
    fechaFinInscripcion: string;
    valor: number;
    requisitos?: string;
    imagenUrl?: string;
    solicitudesPendientes?: number;
}

// Added fix: Exported SolicitudInscripcion interface.
export interface SolicitudInscripcion {
    id: string;
    eventoId: string;
    estudiante: {
        id: string;
        nombres: string;
        apellidos: string;
    };
    fechaSolicitud: string;
    estado: EstadoSolicitud;
    pagado?: boolean;
    fechaPago?: string;
    metodoPago?: 'Efectivo' | 'Transferencia' | 'Tarjeta' | 'Otro';
    reciboId?: string;
}

// Added fix: Exported VariacionImplemento interface.
export interface VariacionImplemento {
    id: string;
    descripcion: string;
    precio: number;
}

// Added fix: Exported Implemento interface.
export interface Implemento {
    id: string;
    nombre: string;
    descripcion: string;
    imagenUrl: string;
    categoria: CategoriaImplemento;
    variaciones: VariacionImplemento[];
}

// Added fix: Exported SolicitudCompra interface.
export interface SolicitudCompra {
    id: string;
    estudiante: {
        id: string;
        nombres: string;
        apellidos: string;
        tutor?: {
            nombres: string;
            apellidos: string;
            telefono: string;
            correo: string;
        } | null;
    };
    implemento: {
        id: string;
        nombre: string;
        categoria: CategoriaImplemento;
    };
    variacion: {
        id: string;
        descripcion: string;
        precio: number;
    };
    fechaSolicitud: string;
    estado: EstadoSolicitudCompra;
    pagado?: boolean;
    fechaPago?: string;
    metodoPago?: 'Efectivo' | 'Transferencia' | 'Tarjeta' | 'Otro';
    reciboId?: string;
}

export enum EstadoValidacion {
    Pendiente = 'Pendiente',
    Analizando = 'Analizando',
    ValidadoIA = 'ValidadoIA',
    ErrorIA = 'ErrorIA',
    Aprobado = 'Aprobado',
    Rechazado = 'Rechazado'
}

export interface ReportePagoEstudiante {
    id: string;
    tenantId: string;
    estudianteId: string;
    estudianteNombre: string;
    montoInformado: number;
    fechaReporte: string;
    comprobanteUrl: string;
    estado: EstadoValidacion;
    // Datos extraídos por IA
    datosIA?: {
        referencia?: string;
        montoExtraido?: number;
        fechaExtraida?: string;
        confianza?: number;
        advertencias?: string[];
    };
    observaciones?: string;
    validadoPor?: string; // ID del usuario que aprobó
    fechaValidacion?: string;
}

// ============================================================================
// ETAPA 1: AGENDA, PROGRAMA ACADÉMICO Y CLASE EN VIVO
// Contratos Base (Ref: PLAN_INTEGRACION_AGENDA_PROGRAMA_CLASE_EN_VIVO.md)
// ============================================================================

/**
 * Define el contenido reutilizable. No debe representar por sí solo una clase específica.
 */
export interface ProgramaAcademico {
    id: string;
    tenantId: string;
    nombre: string;
    descripcion?: string;
    grupoObjetivo: 'Infantil' | 'Precadetes' | 'Cadetes' | 'Adultos' | 'Todos';
    gradosIncluidos: string[];
    fechaInicio: string;
    fechaFin: string;
    estado: 'borrador' | 'activo' | 'pausado' | 'cerrado';
    objetivos: string[];
    tags: string[];
    creadoPorUid: string;
    creadoEn: string;
    actualizadoEn: string;
}

export interface HorarioRecurrente {
    diaSemana: 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo';
    horaInicio: string;
    horaFin: string;
}

/**
 * Nueva variable central. Representa la ejecución real de un programa en una sede, horario y maestro.
 */
export interface CohorteAcademica {
    id: string;
    tenantId: string;
    programaId: string;
    nombre: string;
    sedeId: string;
    espacioId?: string;
    maestroTitularId: string;
    grupoOperativo: string;
    gradosIncluidos: string[];
    horario: HorarioRecurrente[];
    fechaInicio: string;
    fechaFin: string;
    estado: 'sin_agenda' | 'agenda_generada' | 'en_curso' | 'finalizada' | 'pausada';
    estudiantesIds?: string[];
    creadoPorUid: string;
    creadoEn: string;
    actualizadoEn: string;
}

/**
 * Clase específica generada por una cohorte o creada manualmente desde Agenda.
 */
export interface JornadaAcademica {
    id: string;
    tenantId: string;
    programaId?: string;
    cohorteId?: string;
    sedeId: string;
    espacioId?: string;
    maestroTitularId: string;
    maestroEjecutorId: string;
    grupoOperativo: string;
    gradosIncluidos: string[];
    fecha: string;
    horaInicio: string;
    horaFin: string;
    estado: 'programada' | 'confirmada' | 'iniciada' | 'cerrada' | 'cancelada' | 'reprogramada';
    origen: 'programa' | 'agenda_manual' | 'excepcion';
    motivoExcepcion?: string;
    creadoPorUid: string;
    creadoEn: string;
    actualizadoEn: string;
}

/**
 * No debe ser un módulo aislado; debe ser el estado operativo de una jornada.
 * Los estados 'en_curso' y 'finalizada' son usados por claseEnVivoApi.
 */
export interface ClaseEnVivo {
    id: string;
    tenantId: string;
    jornadaId: string;
    programaId?: string;
    cohorteId?: string;
    sedeId?: string;
    maestroEjecutorId?: string;
    estado: 'en_curso' | 'finalizada' | 'cancelada';
    inicioRealAt: string;
    cierreRealAt?: string;
    observaciones?: string;
    estadisticasActuales?: { totalAsistencias: number; totalAusencias: number };
    creadoEn?: string;
    actualizadoEn?: string;
}

/**
 * Guardar eventos permite auditar errores y recalcular resúmenes.
 * Los campos registradoPorUid y metodo son usados por asistenciaQrApi.
 */
export interface EventoAsistenciaQr {
    id: string;
    tenantId: string;
    jornadaId?: string;
    claseEnVivoId: string;
    estudianteId: string;
    tipo: 'entrada' | 'salida';
    timestamp: string;
    registradoPorUid: string;
    metodo: 'qr_scanner' | 'manual';
    creadoEn: string;
}

/**
 * Registro consolidado de asistencia por alumno por jornada.
 * primeraEntradaAt/ultimaSalidaAt son usados por asistenciaQrApi para calcular minutos.
 */
export interface AsistenciaJornada {
    id: string;
    tenantId: string;
    jornadaId: string;
    estudianteId: string;
    primeraEntradaAt?: string;
    ultimaSalidaAt?: string;
    minutosAsistidos: number;
    estado: 'presente' | 'tarde' | 'parcial' | 'ausente' | 'justificado';
    actualizadoEn: string;
}
