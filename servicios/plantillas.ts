
// servicios/plantillas.ts
import type { Estudiante, ConfiguracionClub, Usuario, Sede } from '../tipos';
import { RolUsuario } from '../tipos';
import { formatearPrecio } from '../utils/formatters';

const FECHA_HOY_OBJ = () => {
    const fecha = new Date();
    const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    return {
        dia: fecha.getDate(),
        mes: meses[fecha.getMonth()],
        anio: fecha.getFullYear()
    };
};

/**
 * Contrato estándar para Alumnos (vía Acudiente)
 * Ahora permite inyectar el precio específico de la sede si existe.
 */
export const generarTextoContrato = (estudiante: Estudiante, configClub: ConfiguracionClub, sede?: Sede): string => {
    if (!estudiante.tutor) return "Error: No se puede generar el contrato sin datos del tutor.";
    const f = FECHA_HOY_OBJ();

    // Lógica de herencia de precios: Sede > Club
    const valorMensualidadFinal = (sede?.valorMensualidad && sede.valorMensualidad > 0)
        ? sede.valorMensualidad
        : configClub.valorMensualidad;

    return `
🥋 CONTRATO DE PRESTACIÓN DE SERVICIOS DE FORMACIÓN DEPORTIVA EN TAEKWONDO

ENTRE: ${configClub.nombreClub.toUpperCase()}, con NIT ${configClub.nit}, representada legalmente por ${configClub.representanteLegal.toUpperCase()}, identificada con C.C. ${configClub.ccRepresentante} (en adelante, EL CLUB).

Y: El(la) señor(a) ${estudiante.tutor.nombres.toUpperCase()} ${estudiante.tutor.apellidos.toUpperCase()}, identificado con C.C. No. ${estudiante.tutor.numeroIdentificacion}, actuando en calidad de tutor y representante legal del alumno(a) ${estudiante.nombres.toUpperCase()} ${estudiante.apellidos.toUpperCase()} (en adelante, EL USUARIO).

OBJETO: EL CLUB se obliga a prestar los servicios de formación técnica y deportiva en la disciplina de Taekwondo bajo su programa curricular en la sede ${sede?.nombre.toUpperCase() || 'PRINCIPAL'}.

VALOR Y PAGO: El valor de la mensualidad pactado es de ${formatearPrecio(valorMensualidadFinal)}. EL USUARIO se compromete a cancelar dicho valor durante los primeros ${Math.floor(configClub.diasSuspension / 6)} días de cada mes calendario.

VIGENCIA: El presente contrato tendrá una duración de ${configClub.duracionContratoMeses} meses a partir de la firma.

TERMINACIÓN: El incumplimiento en el pago por más de ${configClub.diasSuspension} días facultará al CLUB para suspender el servicio y dar por terminado el vínculo.

Firmado en ${configClub.lugarFirma}, el día ${f.dia} de ${f.mes} de ${f.anio}.
    `.trim();
};

/**
 * Autorización de Imagen y Datos
 */
export const generarTextoConsentimientoImagen = (estudiante: Estudiante, configClub: ConfiguracionClub): string => {
    if (!estudiante.tutor) return "Error: Sin datos de tutor.";
    const f = FECHA_HOY_OBJ();
    return `
📸 AUTORIZACIÓN DE USO DE IMAGEN Y TRATAMIENTO DE DATOS PERSONALES

Yo, ${estudiante.tutor.nombres.toUpperCase()} ${estudiante.tutor.apellidos.toUpperCase()}, en ejercicio de la patria potestad sobre el menor ${estudiante.nombres.toUpperCase()} ${estudiante.apellidos.toUpperCase()}, autorizo de manera libre, expresa e informada al club ${configClub.nombreClub.toUpperCase()} para:

1. Registro Fotográfico y Fílmico: Captar la imagen y voz del menor durante las clases, eventos y competencias organizadas por el club.
2. Uso Institucional: Utilizar dicho material exclusivamente para fines pedagógicos, informativos, publicitarios y de promoción institucional en redes sociales y sitio web del club.
3. Tratamiento de Datos: Manejar los datos personales suministrados en la ficha de inscripción bajo las normas de Habeas Data vigentes.

Esta autorización es gratuita y no genera derecho a compensación económica alguna.

Fecha de suscripción: ${f.dia}/${f.mes}/${f.anio}.
    `.trim();
};

/**
 * CONTRATOS PARA EQUIPO TÉCNICO (SABONIMS / SECRETARIOS / ASISTENTES)
 */
export const generarTextoContratoColaborador = (usuario: Usuario, configClub: ConfiguracionClub): string => {
    const f = FECHA_HOY_OBJ();
    // Si no hay contrato configurado, usamos valores por defecto para evitar errores de renderizado
    const c = usuario.contrato || {
        valorPago: 0,
        tipoVinculacion: 'Mes' as any,
        tipoVinculacionOtro: '',
        fechaInicio: new Date().toISOString().split('T')[0],
        lugarEjecucion: configClub.lugarFirma || 'Bogotá D.C.',
        firmado: false
    };

    const tipoFinal = c.tipoVinculacion === 'Otro' ? c.tipoVinculacionOtro : c.tipoVinculacion;
    const valorP = formatearPrecio(c.valorPago);

    // Encabezado Común
    let texto = `
CONTRATO DE TRABAJO/PRESTACIÓN ${usuario.rol.toUpperCase()} – ${configClub.nombreClub.toUpperCase()}

Entre los suscritos a saber:

CONTRATANTE:
- Nombre: ${configClub.nombreClub.toUpperCase()}
- NIT: ${configClub.nit}
- Representante: ${configClub.representanteLegal}
- Teléfono: ${configClub.metodoPago}

CONTRATADO/A (${usuario.rol}):
- Nombre: ${usuario.nombreUsuario.toUpperCase()}
- Cédula: ${usuario.numeroIdentificacion}
- Teléfono: ${usuario.whatsapp}
- Correo: ${usuario.email}

Fecha de inicio: ${c.fechaInicio}
Lugar de ejecución: ${c.lugarEjecucion}
Tipo de vinculación: ${tipoFinal}
Valor a pagar: ${valorP} COP

---

Cláusula Primera – Objeto del contrato
El(la) ${usuario.rol} se compromete a prestar sus servicios al Club ${configClub.nombreClub}, bajo las condiciones pactadas y en el marco de la legislación colombiana vigente.

Funciones principales:
`;

    // Funciones por Rol (Basado en plantillas del usuario)
    if (usuario.rol === RolUsuario.Tutor) {
        texto += `
- Planear y desarrollar las sesiones de entrenamiento de acuerdo al programa del club.
- Evaluar el desempeño y progreso de los alumnos.
- Organizar y liderar la participación del club en eventos y competencias.
- Velar por la seguridad e integridad de los estudiantes durante las clases.
- Mantener comunicación activa con padres de familia y coordinadores.
- Participar en la elaboración de informes y reportes periódicos.
- Actualizarse en normatividad y técnicas propias del Taekwondo.
`;
    } else if (usuario.rol === RolUsuario.Editor) {
        texto += `
- Manejo y organización de la agenda del club y los profesores.
- Recepción y archivo de documentos administrativos.
- Atención y orientación a alumnos, padres y visitantes.
- Apoyo en la inscripción y registro de nuevos miembros.
- Control y actualización de bases de datos.
- Apoyo en la elaboración y gestión de informes administrativos.
- Gestión de correspondencia y comunicaciones internas y externas.
- Manejo básico de caja menor y pagos rutinarios del club.
`;
    } else {
        // Asistente
        texto += `
- Apoyo logístico en la apertura y cierre del dojang.
- Supervisión de seguridad y orden en la zona de entrega de alumnos.
- Asistencia en el registro de asistencia mediante código QR.
- Apoyo en la organización de implementos y materiales de clase.
- Tareas operativas delegadas por la dirección o secretaría.
`;
    }

    texto += `
Cláusula Segunda – Jornada y modalidad
El presente contrato se ejecutará bajo la modalidad seleccionada y el horario pactado, que podrá ajustarse según las necesidades del club.

Cláusula Tercera – Obligaciones generales
- Cumplir con las políticas internas y el código de ética del club.
- Mantener la absoluta confidencialidad de la información del club y sus miembros.
- Asistir a capacitaciones y reuniones convocadas por el club.

Cláusula Cuarta – Duración y Terminación
El contrato tendrá la duración acordada y podrá ser renovado o terminado conforme a la ley o a lo pactado entre las partes.

En constancia se firma a los ${f.dia} días del mes de ${f.mes} de ${f.anio}.

Firma Contratante: ________________________
Firma Contratado/a: ${c.firmado ? 'FIRMADO DIGITALMENTE' : '_______________________'}
`;

    return texto.trim();
};
