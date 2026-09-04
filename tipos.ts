
// tipos.ts 

// Regla canonica de roles (decision de producto del usuario, 2026-07-09 — ver
// CIERRE CENTRO DE ESTUDIOS.md 14.9):
//   - Tutor   = padre/acudiente. NUNCA un instructor ni un miembro del Equipo Tecnico.
//   - Maestro = rol de quien ensena y asigna clases (el rol docente del Equipo Tecnico).
//   - Editor  = Secretaria (gestion de alumnos/tienda/cobros); su capacidad docente es legacy.
//   - Asistente solo aparece como instructor de Programa si el admin lo habilita
//     (features.asistenteInstructorPrograma).
export enum RolUsuario {
    Admin = 'Admin',
    Editor = 'Editor',
    Asistente = 'Asistente',
    Estudiante = 'Estudiante',
    Tutor = 'Tutor',
    Maestro = 'Maestro',
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

export interface SolicitudCarnet {
    id: string;
    tenantId: string;
    nombreClub: string;
    cantidad: number;
    sedeNombre: string;
    fechaSolicitud: string;
    estado: 'pendiente' | 'en_produccion' | 'enviado' | 'rechazado';
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
    // Flag de marketing/ventas, independiente de estadoSuscripcion: oculta módulos que se
    // reservan como valor agregado en una demo comercial (Carnetización, Programas Extra,
    // configuración de Biblioteca/Drive). El trial real de 7 días de un cliente nuevo
    // (estadoSuscripcion === 'demo') NO se ve afectado por esto -- solo lo activa SuperAdmin
    // a mano para el/los tenant(s) que usa para mostrarle la app a un prospecto (ver
    // vistas/MasterDashboard.tsx, alternarDemoComercialTenant en servicios/configuracionApi.ts).
    esDemoComercial?: boolean;
    fechaVencimiento: string;
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
    cobroAutomaticoActivo?: boolean;
    cobroAutomaticoIntentosFallidos?: number; // se resetea a 0 tras un cobro exitoso
    linkPagoMensualidad?: string; // URL de Payment Link externo (Wompi/PayU/ePayco) de la CUENTA de la academia, para que sus alumnos paguen mensualidad en línea. Tudojang no procesa ni recibe este dinero -- ver Términos de Servicio. Debe pertenecer a un dominio de DOMINIOS_PASARELAS_PAGO_PERMITIDOS (constantes.ts).
    // "Cobro Justo": evoluciona la Regla de Fin de Mes (cobrarMesSiguiente, día 26+, todo o
    // nada) a un prorrateo diario desde el día 10. Opt-in por tenant -- si no está activo, el
    // formulario de alta mantiene exactamente el comportamiento anterior.
    cobroJustoActivo?: boolean;
    // Campos de pricing por cupo real (SDD pricing-cupo-real, Bloque 2 -- capacidad-tenant /
    // facturacion-metered). Corte final (Bloque 4, tasks.md 4.13): `plan`/`limiteEstudiantes`/
    // `limiteUsuarios`/`limiteSedes` fueron RETIRADOS de esta interfaz -- cualquier lector que
    // sobreviviera se vuelve un fallo de `npm run typecheck` a propósito (el antídoto
    // estructural al patrón write-here/read-there de ERR-0013, ver design.md "Notes on
    // Constraints"). La fuente única de capacidad/facturación ahora es
    // utils/facturacion.ts::calcularCapacidad/calcularFacturacionMensual sobre estos 4
    // campos aditivos/opcionales. Ausentes en un tenant legacy => false/0 (D3/Migración).
    sedeBonusOtorgada?: boolean; // D4: otorgado UNA vez al cruzar el umbral, nunca se recalcula ni se revoca
    sedeBonusOtorgadaEn?: string; // ISO -- auditoria de cuando se otorgo el bono
    sedesExtraContratadas?: number; // mas alla de incluido.sedes + el bono
    equipoTecnicoExtraContratado?: number; // mas alla de incluido.equipoTecnico
}

// Fix seguridad 2026-07-18: wompiPaymentSourceId vivía en ConfiguracionClub (documento
// tenants/{tenantId} raíz), legible por `allow get` a CUALQUIER usuario autenticado del
// tenant (Instructor/Editor/Asistente/Maestro incluidos) según firestore.rules. Se movió al
// subdocumento tenants/{tenantId}/privado/facturacion, acotado a Admin/SuperAdmin. Los otros
// dos campos de cobro automático (cobroAutomaticoActivo/cobroAutomaticoIntentosFallidos) NO
// se movieron -- se quedan en ConfiguracionClub porque no son sensibles por sí solos.
export interface FacturacionPrivadaTenant {
    wompiPaymentSourceId?: number | null;
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
    authUid?: string;
    /**
     * Cómo se va el estudiante a casa al terminar la clase (Clase en Vivo, WS-3).
     * - `recogida` (default cuando está ausente): un adulto lo pasa a buscar → el sistema
     *   avisa al acudiente antes de que termine la clase para que llegue a tiempo.
     * - `ruta_bus`: se va en la ruta de transporte contratada → al hacer check-out (sube al
     *   bus) se le avisa al acudiente que ya salió, en vez de pedirle que vaya.
     */
    modoTransporte?: 'recogida' | 'ruta_bus';
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
    // Registro del monto que se le informó al staff al momento del alta, cuando el tenant
    // tiene "Cobro Justo" activo y el ingreso fue día 10+ del mes (ver calcularMontoCobroJusto
    // en utils/calculations.ts). Puramente informativo/auditoría -- igual que
    // cobrarMesSiguiente, no dispara ningún cálculo automático de saldoDeudor.
    montoCobroJustoAlIngreso?: number;
    estadoMatricula: 'activo' | 'retirado';
    fechaRetiro?: string;
    fechaReactivacion?: string;
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
    // ERR-0011: agregado para poder filtrar `historialNotificaciones` por tenant en
    // lectura (servicios/notificacionesApi.ts) y en firestore.rules. Antes ningun
    // documento lo tenia -- todos los generadores (client-side y Cloud Functions
    // cron) ahora lo escriben.
    tenantId: string;
    fecha: string;
    estudianteId: string;
    estudianteNombre: string;
    tutorNombre: string;
    destinatario: string;
    // SDD notificaciones-pagos (Fase A, in-app only): 'InApp' se suma para los 3 nuevos tipos
    // de aviso de pagos (ComprobantePagoAdmin/PagoAprobado/PagoRechazado) -- ninguno usa
    // WhatsApp/Email real. Ver blast radius del ensanche de esta union en design.md.
    canal: 'WhatsApp' | 'Email' | 'InApp';
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
    SolicitudCompraAdmin = 'SolicitudCompraAdmin',
    // Plan B #2 (fix tutor-role-end-to-end): avance académico (material completado).
    AvanceAcademico = 'AvanceAcademico',
    // Plan B #3 (fix tutor-role-end-to-end): evento nuevo con inscripción abierta.
    EventoNuevo = 'EventoNuevo',
    // SDD notificaciones-pagos (D6): admin-facing (sufijo "...Admin", mismo criterio que
    // SolicitudCompraAdmin), escrita por la Cloud Function analizarComprobanteEstudiante
    // (functions/index.js) con el estudianteId sentinel -- ver constantes.ts.
    ComprobantePagoAdmin = 'ComprobantePagoAdmin',
    // Tutor-facing, escritas por gestionarReportePago (servicios/pagosEstudiantesApi.ts).
    PagoAprobado = 'PagoAprobado',
    PagoRechazado = 'PagoRechazado'
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
    estadoLote: 'captura' | 'legalizado' | 'procesado' | 'cancelado';
    firmaLegalizacion?: string;
    fechaLegalizacion?: string;
    fechaCancelacion?: string; // Presente cuando un SuperAdmin corta la vigencia manualmente
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
        firmaDigital?: string;
    };
    deletedAt?: string; // Soft delete: fecha de eliminación (ISO string)
    // Matriz de roles de Agenda (extension posterior al cierre del modulo 12, ver
    // CIERRE CENTRO DE ESTUDIOS.md): permiso de EDICION de Agenda otorgado por un Admin a
    // un usuario Asistente/Editor puntual (Admin/SuperAdmin siempre editan todo; Maestro
    // edita solo su propia clase asignada via instructorId -- ninguno de esos dos casos
    // necesita este flag). Por defecto false/undefined: Asistente/Editor pueden CONSULTAR
    // Agenda pero no editar hasta que un Admin active este flag. El control visual/toggle
    // para que un Admin lo active desde `vistas/Configuracion.tsx` queda PENDIENTE (zona
    // exclusiva de Codex, ver nota en COORDINACION CODEX ANTIGRAVITY - CENTRO ESTUDIOS.md) --
    // este campo solo define el dato; la logica de permiso vive en
    // `puedeEditarJornada` (vistas/admin/MisClasesView.tsx) y en `firestore.rules`.
    permisoEdicionAgenda?: boolean;
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
    // ERR-0011: agregado para filtrar `solicitudesCompra` por tenant (antes solo se
    // filtraba por `estado`, sin aislamiento de tenant en lectura ni en reglas).
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
        // Ya la devuelve la Cloud Function (functions/index.js::analizarComprobanteEstudiante,
        // prompt de Gemini) pero faltaba en el tipo -- el campo se guardaba en Firestore sin
        // que TypeScript lo conociera.
        entidad?: string;
        confianza?: number;
        advertencias?: string[];
    };
    observaciones?: string;
    validadoPor?: string; // ID del usuario que aprobó
    fechaValidacion?: string;
    // Vincula el reporte a la cuenta autenticada del tutor que lo envió (flujo con login).
    // Ausente en reportes creados por el link público /reportar-pago (sin sesión).
    tutorUsuarioId?: string;
}

