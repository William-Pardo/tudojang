
// constantes.ts
import { ConfiguracionClub } from './tipos';

export const PLANTILLAS_NOTIFICACIONES = {
    BIENVENIDA: [
        "¡Hola {{TUTOR}}! Es un honor darle la bienvenida a {{ESTUDIANTE}} a la familia deportiva de {{CLUB}}. 🥋",
        "Kyeong-rye {{TUTOR}}! 👋 Le damos la bienvenida oficial a {{ESTUDIANTE}} a {{CLUB}}. Juntos forjaremos carácter.",
        "¡Excelente elección {{TUTOR}}! {{ESTUDIANTE}} ya forma parte de {{CLUB}}. ¡A entrenar!",
        "¡Bienvenido(a) {{ESTUDIANTE}}! {{TUTOR}}, gracias por confiar en {{CLUB}} para su formación técnica."
    ],
    RECORDATORIO_PAGO: [
        "Estimado(a) {{TUTOR}}, en {{CLUB}} le recordamos amablemente que el pago de {{CONCEPTO}} para {{ESTUDIANTE}} está próximo por valor de {{MONTO}}. Medios: {{MEDIOS_PAGO}}.",
        "¡Hola {{TUTOR}}! Tenemos pendiente el pago de {{ESTUDIANTE}} en {{CLUB}} por {{MONTO}}. 🙏 Puedes pagar vía {{MEDIOS_PAGO}}.",
        "{{TUTOR}}, un reminder de {{CLUB}}: la mensualidad de {{ESTUDIANTE}} vence pronto ({{MONTO}}). Disponemos de: {{MEDIOS_PAGO}}."
    ],
    AVISO_VENCIMIENTO: [
        "⚠️ ATENCIÓN {{TUTOR}}: El pago de {{ESTUDIANTE}} en {{CLUB}} por {{MONTO}} se encuentra VENCIDO. Por favor regularizar en {{MEDIOS_PAGO}}.",
        "Urgente: El sistema de {{CLUB}} detecta una mora en el pago de {{ESTUDIANTE}} ({{MONTO}}). Pague hoy en: {{MEDIOS_PAGO}}.",
        "Hola {{TUTOR}}, el pago de {{ESTUDIANTE}} en la academia lleva días de retraso. Evite la suspensión del cupo pagando en {{MEDIOS_PAGO}}."
    ],
    CONFIRMACION_COMPRA: [
        "¡Excelente equipo {{ESTUDIANTE}}! 👋 {{TUTOR}}, confirmamos en {{CLUB}} la compra de {{CONCEPTO}}. Valor: {{MONTO}}. Pago en {{MEDIOS_PAGO}}.",
        "Confirmación {{CLUB}}: {{CONCEPTO}} para {{ESTUDIANTE}} registrado. Valor: {{MONTO}}. Puedes transferir a {{MEDIOS_PAGO}}."
    ],
    INSCRIPCION_EVENTO: [
        "¡Meta fijada! 🏅 {{ESTUDIANTE}} inscrito por {{CLUB}} en {{CONCEPTO}}. Valor: {{MONTO}}. Asegura el cupo pagando en {{MEDIOS_PAGO}}.",
        "Confirmamos la participación de {{ESTUDIANTE}} en {{CONCEPTO}} representando a {{CLUB}}. Valor: {{MONTO}}. Paga en: {{MEDIOS_PAGO}}."
    ]
};

export const DATOS_RECAUDO_MASTER = {
    nequi: "300 765 4321",
    banco: "Bancolombia Ahorros #987-654321-01",
    whatsappSoporte: "3007654321",
};

export const CONFIGURACION_POR_DEFECTO = {
    tenantId: 'escuela-gajog-001',
    diaCobroMensual: 1,
    diasAnticipoRecordatorio: 5,
    diasGraciaSuspension: 10,
    frecuenciaSyncHoras: 24,
    frecuenciaQueryApiDias: 8,
};

export const CONFIGURACION_CLUB_POR_DEFECTO: ConfiguracionClub = {
    tenantId: 'escuela-gajog-001',
    slug: 'gajog',
    nombreClub: 'Taekwondo Ga Jog',
    nit: '900.123.456-7',
    representanteLegal: 'CARLOS ANDRÉS PÉREZ',
    ccRepresentante: '1.020.333.444',
    lugarFirma: 'Bogotá D.C.',
    duracionContratoMeses: 12,
    valorMensualidad: 180000,
    // Added comment above fix: Added required valorInscripcion and moraPorcentaje properties.
    valorInscripcion: 50000,
    moraPorcentaje: 5,
    metodoPago: 'Transferencia Directa',
    pagoNequi: '3001234567',
    pagoDaviplata: '',
    pagoBreB: '',
    pagoBanco: 'Bancolombia Ahorros #123-456789-01',
    diasSuspension: 30,
    direccionClub: 'Calle 127 # 45-67, Edificio Arcial, Local 102',
    colorPrimario: '#FFFFFF',
    colorSecundario: '#0047A0',
    colorAcento: '#CD2E3A',
    emailClub: 'academia@gajog.com',
    estadoSuscripcion: 'activo' as const,
    fechaVencimiento: '2025-12-31',
    plan: 'starter',
    limiteEstudiantes: 50,
    limiteUsuarios: 2,
    limiteSedes: 1,
};

export const ADMIN_WHATSAPP = "3001234567";

export const FRASES_SALIDA = [
    "¡Hola! [ESTUDIANTE] ha terminado su práctica con éxito en {{CLUB}}. Ya puedes pasar a recogerlo(a).",
    "¡Qué gran clase hoy! [ESTUDIANTE] ya terminó su sesión en {{CLUB}}. Te esperamos en la salida.",
    "Entrenamiento finalizado en {{CLUB}}. [ESTUDIANTE] está listo para ir a casa. ¡Buen trabajo!",
    "Aviso de salida: [ESTUDIANTE] ha terminado su entrenamiento en la sede."
];

export const BASE_CONOCIMIENTO_PQRS = [
    { id: "pagos-1", pregunta: "¿Cuáles son los medios de pago?", respuesta: "Aceptamos transferencias por Nequi, Daviplata o Bancolombia. Por favor, enviar siempre el comprobante para legalizar el pago." }
];

export const PLANES_SAAS = {
    starter: {
        id: 'starter',
        nombre: 'Plan Starter',
        precio: 160000,
        limiteEstudiantes: 50,
        limiteUsuarios: 2,
        limiteSedes: 1,
        caracteristicas: ['Hasta 50 alumnos', '2 Instructores', '1 Sede', 'Gestión de Tienda', 'Eventos Básicos'],
        popular: false
    },
    growth: {
        id: 'growth',
        nombre: 'Plan Growth',
        precio: 340000,
        limiteEstudiantes: 150,
        limiteUsuarios: 5,
        limiteSedes: 2,
        caracteristicas: ['Hasta 150 alumnos', '5 Instructores', '2 Sedes', 'Firma Digital Ilimitada', 'Analíticas Avanzadas'],
        popular: true
    },
    pro: {
        id: 'pro',
        nombre: 'Plan Pro',
        precio: 580000,
        limiteEstudiantes: 350,
        limiteUsuarios: 10,
        limiteSedes: 5,
        caracteristicas: ['Hasta 350 alumnos', '10 Instructores', '5 Sedes', 'Soporte Sabonim AI', 'Exportación Pro'],
        popular: false
    }
};

export const COSTOS_ADICIONALES = {
    estudiantes: { cantidad: 10, label: '+10 Alumnos', precio: 15000, key: 'estudiantes' },
    instructor: { cantidad: 1, label: '+1 Miembro Equipo', precio: 10000, key: 'instructor' },
    sede: { cantidad: 1, label: '+1 Sede Adicional', precio: 30000, key: 'sede' }
};

export const CONFIGURACION_WOMPI = {
    publicKey: "pub_test_XsQuPPUIhtkAUjxpyZtof7fEh5zYs52q",
    privateKey: "prv_test_VVkIyE0hBvHJpjKf2JJOl2dGoYG6PBXK",
    eventsKey: "test_events_znXLPPCzTpxVNzn6ITFPEESQwTLwbGzd",
    integrityKey: "test_integrity_Iq6lRgXaEjqD4YLSoQsvPCvjdUhpNalY",
    webhookUrl: "https://us-central1-tudojang.cloudfunctions.net/webhookWompi"
};
