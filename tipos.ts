
// tipos.ts 

export enum RolUsuario {
    Admin = 'Admin',
    Editor = 'Editor',
    Asistente = 'Asistente',
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

export enum TipoVinculacionColaborador {
    Mes = 'Mes',
    Hora = 'Hora',
    Evento = 'Evento',
    Otro = 'Otro'
}
// ... resto del archivo tipos.ts se mantiene igual ...
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
    Otros = 'Otros'
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

export interface InscripcionPrograma {
    idPrograma: string;
    nombrePrograma: string;
    fechaInscripcion: string;
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
    contrato?: {
        valorPago: number;
        tipoVinculacion: TipoVinculacionColaborador;
        tipoVinculacionOtro?: string;
        fechaInicio: string;
        lugarEjecucion: string;
        firmado: boolean;
    };
    estadoContrato?: string;
    requiereCambioPassword?: boolean;
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
}

export interface Programa {
    id: string;
    tenantId: string;
    nombre: string;
    descripcion: string;
    tipoCobro: TipoCobroPrograma;
    valor: number;
    horario: string;
    activo: boolean;
}

export interface Evento {
    id: string;
    tenantId: string;
    nombre: string;
    lugar: string;
    descripcion: string;
    fechaInicioInscripcion: string;
    fechaFinInscripcion: string;
    fechaEvento: string;
    valor: number;
    requisitos: string;
    imagenUrl?: string;
    solicitudesPendientes?: number;
}

export interface SolicitudInscripcion {
    id: string;
    tenantId: string;
    eventoId: string;
    estudiante: {
        id: string;
        nombres: string;
        apellidos: string;
    };
    fechaSolicitud: string;
    estado: EstadoSolicitud;
}

export interface VariacionImplemento {
    id: string;
    descripcion: string;
    precio: number;
}

export interface Implemento {
    id: string;
    tenantId: string;
    nombre: string;
    descripcion: string;
    imagenUrl: string;
    categoria: CategoriaImplemento;
    variaciones: VariacionImplemento[];
}

export interface SolicitudCompra {
    id: string;
    tenantId: string;
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

export interface Sede {
    id: string;
    tenantId: string;
    nombre: string;
    direccion: string;
    ciudad: string;
    telefono: string;
    valorMensualidad?: number; // Añadido: Precio específico de la clase para esta sede
}

export interface ConfiguracionNotificaciones {
    tenantId: string;
    diaCobroMensual: number;
    diasAnticipoRecordatorio: number;
    diasGraciaSuspension: number;
    frecuenciaSyncHoras: number;
    frecuenciaQueryApiDias: number;
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
}

export interface NotificacionHistorial {
    id: string;
    tenantId: string;
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

export interface Asistencia {
    id: string;
    tenantId: string;
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
    fechaExpiracion: string; // ISO con hora: "2024-06-01T18:00:00"
    activa: boolean;
    registrosRecibidos: number;
    estadoLote: 'captura' | 'legalizado' | 'procesado';
    firmaLegalizacion?: string;
    fechaLegalizacion?: string;
}

export interface PagoRegistro {
    monto: number;
    metodo: 'nequi' | 'daviplata' | 'efectivo' | 'otros';
    soporteUrl?: string;
    fechaPago?: string;
    verificadoPor?: string;
}

export interface RegistroTemporal {
    id: string;
    tenantId: string;
    misionId: string; // Misión Kicho (Batch) o 'inscripcion_premium' (Single)
    fechaRegistro: string;
    estado: 'pendiente' | 'verificado' | 'rechazado' | 'pendiente_pago' | 'por_verificar' | 'pago_validado' | 'procesado';
    pago?: PagoRegistro;
    datos: {
        nombres: string;
        apellidos: string;
        email: string;
        telefono: string;
        fechaNacimiento: string;
        tutorNombre?: string;
        tutorTelefono?: string;
        tutorEmail?: string;
        parentesco?: string;
        sedeSugeridaId?: string;
        programasInteres?: string[]; // IDs de programas elegidos
    };
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
    intensidad?: number;
}
