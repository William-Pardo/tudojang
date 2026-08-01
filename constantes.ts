
// constantes.ts
import { ConfiguracionClub } from './tipos';
import facturacionConfig from './functions/facturacion-config.json';

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
    tenantId: 'PLATFORM_INIT_PENDING',
    slug: 'tudojang',
    nombreClub: 'Tudojang SaaS',
    nit: '000.000.000-0',
    representanteLegal: 'Administrador de Plataforma',
    ccRepresentante: '00.000.000',
    lugarFirma: 'Sede Principal',
    duracionContratoMeses: 12,
    valorMensualidad: 0,
    valorInscripcion: 0,
    moraPorcentaje: 0,
    valorMatricula: 0,
    activarMatriculaAnual: false,
    metodoPago: 'Sin configurar',
    pagoNequi: '',
    pagoDaviplata: '',
    pagoBreB: '',
    pagoBanco: '',
    diasSuspension: 30,
    direccionClub: 'Calle de la Plataforma',
    colorPrimario: '#111111',
    colorSecundario: '#0047A0',
    colorAcento: '#CD2E3A',
    emailClub: 'soporte@tudojang.com',
    estadoSuscripcion: 'demo' as const,
    fechaVencimiento: '2029-12-31',
    onboardingStep: 0
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

// SDD pricing-cupo-real (Bloque 4b, D1 design.md): PLANES_SAAS (starter/growth/pro) se
// elimina -- ya no hay planes fijos, se factura por cupo real (calcularFacturacionMensual,
// utils/facturacion.ts). COSTOS_ADICIONALES queda SOLO como vitrina de precio unitario
// (display-only, tarea 4.11) para mostrar "cuánto cuesta +1" en el panel de "Ampliar
// Capacidad" (vistas/Configuracion.tsx) antes de confirmar -- el valor sale de
// functions/facturacion-config.json (`extras`), la única fuente de precios (D1); este
// objeto NO calcula ni persiste nada, solo formatea la misma cifra para mostrarla.
// Estudiantes ya no tiene un costo "por addon" -- se factura por conteo real, sin comprar
// cupos (ver PrecioCalculadora.tsx / la calculadora pública).
export const COSTOS_ADICIONALES = {
    sede: { precio: facturacionConfig.extras.sede, label: 'Sede Adicional' },
    equipoTecnico: { precio: facturacionConfig.extras.equipoTecnico, label: 'Cupo de Equipo Técnico' },
};

export const CONFIGURACION_WOMPI = {
    publicKey: "pub_prod_2XIISLESsoU3kWMce51HMChsMdr1tzVB",
    webhookUrl: "https://us-central1-tudojang.cloudfunctions.net/webhookWompi"
};

// Whitelist deliberadamente acotada a las pasarelas de pago colombianas más comunes.
// Se usa para validar el Payment Link externo que cada academia configura para que sus
// alumnos paguen mensualidad (ver ConfiguracionClub.linkPagoMensualidad en tipos.ts).
// Tudojang NO procesa ni recibe ese dinero -- solo valida que el link apunte a una
// pasarela conocida antes de mostrarlo al alumno. Para sumar una pasarela nueva alcanza
// con agregar su dominio de checkout acá, sin tocar el resto del código.
// IMPORTANTE: si se modifica esta lista, sincronizar también la regex de firestore.rules
// (match /tenants/{tenantId}, validación de linkPagoMensualidad).
export const DOMINIOS_PASARELAS_PAGO_PERMITIDOS = [
    'checkout.wompi.co',
    'checkout.payulatam.com',
    'checkout.epayco.co',
    'secure.payco.co',
];

