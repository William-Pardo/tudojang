import { Estudiante, GradoTKD, GrupoEdad, EstadoPago, ConfiguracionClub } from '../tipos';
import { db, isFirebaseConfigured } from '../firebase/config';
import { collection, addDoc, serverTimestamp, getDocs, query, where, limit, doc, getDoc } from 'firebase/firestore';

const MIN_EDAD = 4;
const MAX_EDAD = 18;
const MIN_HORAS = 0;
const MAX_HORAS = 100;

const APELLIDOS = [
    'García', 'Rodríguez', 'Martínez', 'Hernández', 'López',
    'González', 'Pérez', 'Sánchez', 'Ramírez', 'Torres',
    'Flores', 'Rivera', 'Gómez', 'Díaz', 'Reyes',
    'Morales', 'Jiménez', 'Ortiz', 'Castillo', 'Moreno'
];

const NOMBRES_MASCULINOS = [
    'Santiago', 'Mateo', 'Sebastián', 'Leonardo', 'Matías',
    'Emiliano', 'Diego', 'Daniel', 'Miguel', 'Alexander',
    'Samuel', 'Nicolás', 'Felipe', 'Alejandro', 'Gabriel'
];

const NOMBRES_FEMENINOS = [
    'Sofía', 'Valentina', 'Isabella', 'Camila', 'Valeria',
    'Mariana', 'Gabriela', 'Sara', 'Victoria', 'Luciana',
    'Daniela', 'Natalia', 'Catalina', 'María', 'Paula'
];

const generarNumeroAleatorio = (min: number, max: number) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

const obtenerElementoAleatorio = <T>(array: T[]): T => {
    return array[generarNumeroAleatorio(0, array.length - 1)];
};

const generarFechaNacimiento = () => {
    const edad = generarNumeroAleatorio(MIN_EDAD, MAX_EDAD);
    const fecha = new Date();
    fecha.setFullYear(fecha.getFullYear() - edad);
    fecha.setMonth(generarNumeroAleatorio(0, 11));
    fecha.setDate(generarNumeroAleatorio(1, 28));
    return fecha.toISOString().split('T')[0];
};

const generarFechaIngreso = () => {
    const mesesAtras = generarNumeroAleatorio(0, 24); // Hasta 2 años atrás
    const fecha = new Date();
    fecha.setMonth(fecha.getMonth() - mesesAtras);
    fecha.setDate(generarNumeroAleatorio(1, 28));
    return fecha.toISOString().split('T')[0];
};

const generarGrupoPorEdad = (fechaNacimiento: string): GrupoEdad => {
    const hoy = new Date();
    const nacimiento = new Date(fechaNacimiento);
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const mes = hoy.getMonth() - nacimiento.getMonth();
    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) edad--;

    if (edad >= 3 && edad <= 6) return GrupoEdad.Infantil;
    if (edad >= 7 && edad <= 12) return GrupoEdad.Precadetes;
    if (edad >= 13) return GrupoEdad.Cadetes;
    return GrupoEdad.NoAsignado;
};

export const generarEstudiantesFicticios = async (cantidad: number, sedeId: string, tenantId: string) => {
    if (!isFirebaseConfigured) return;

    // 1. Verificar límites de la membresía
    try {
        const configRef = doc(db, 'configuracion_club', tenantId);
        const configSnap = await getDoc(configRef);
        const config = configSnap.exists() ? configSnap.data() as ConfiguracionClub : null;

        if (config) {
            const limite = config.limiteEstudiantes || 50; // Fallback por defecto
            const estSnap = await getDocs(query(collection(db, 'estudiantes'), where('tenantId', '==', tenantId)));
            const actual = estSnap.size;

            if (actual + cantidad > limite) {
                const mensaje = `Límite superado. El plan actual permite ${limite} alumnos. Tienes ${actual} y quieres agregar ${cantidad}.`;
                console.error(mensaje);
                throw new Error(mensaje);
            }
        }
    } catch (e: any) {
        throw new Error(e.message || "Error al validar límites de suscripción");
    }

    const estudiantesGenerados = [];

    for (let i = 0; i < cantidad; i++) {
        const esHombre = Math.random() > 0.5;
        const nombre = esHombre ? obtenerElementoAleatorio(NOMBRES_MASCULINOS) : obtenerElementoAleatorio(NOMBRES_FEMENINOS);
        const segundoNombre = Math.random() > 0.7 ? (esHombre ? obtenerElementoAleatorio(NOMBRES_MASCULINOS) : obtenerElementoAleatorio(NOMBRES_FEMENINOS)) : '';
        const apellido1 = obtenerElementoAleatorio(APELLIDOS);
        const apellido2 = obtenerElementoAleatorio(APELLIDOS);

        const fechaNacimiento = generarFechaNacimiento();
        const grupo = generarGrupoPorEdad(fechaNacimiento);

        const estudiante: Omit<Estudiante, 'id'> = {
            tenantId,
            sedeId,
            nombres: `${nombre} ${segundoNombre}`.trim(),
            apellidos: `${apellido1} ${apellido2}`,
            numeroIdentificacion: generarNumeroAleatorio(10000000, 99999999).toString(),
            fechaNacimiento,
            grado: obtenerElementoAleatorio(Object.values(GradoTKD)),
            grupo,
            horasAcumuladasGrado: generarNumeroAleatorio(MIN_HORAS, MAX_HORAS),
            telefono: `3${generarNumeroAleatorio(0, 9)}${generarNumeroAleatorio(10000000, 99999999)}`,
            correo: `test.${nombre.toLowerCase()}.${apellido1.toLowerCase()}${generarNumeroAleatorio(1, 99)}@example.com`,
            fechaIngreso: generarFechaIngreso(),
            estadoPago: Math.random() > 0.2 ? EstadoPago.AlDia : EstadoPago.Vencido,
            saldoDeudor: 0,
            historialPagos: [],
            consentimientoInformado: true,
            contratoServiciosFirmado: true,
            consentimientoImagenFirmado: true,
            consentimientoFotosVideos: true,
            carnetGenerado: false,
            programasInscritos: [],
            tutor: {
                nombres: `${obtenerElementoAleatorio(NOMBRES_MASCULINOS)} ${apellido1}`,
                apellidos: apellido2,
                numeroIdentificacion: generarNumeroAleatorio(10000000, 99999999).toString(),
                telefono: `3${generarNumeroAleatorio(0, 9)}${generarNumeroAleatorio(10000000, 99999999)}`,
                correo: 'tutor@test.com'
            },
            eps: obtenerElementoAleatorio(['Sanitas', 'Sura', 'Salud Total', 'Compensar', 'Coosalud']),
            rh: obtenerElementoAleatorio(['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-']),
            direccion: `Calle ${generarNumeroAleatorio(1, 200)} # ${generarNumeroAleatorio(1, 100)} - ${generarNumeroAleatorio(1, 100)}`,
            barrio: obtenerElementoAleatorio(['Los Pinos', 'El Recreo', 'La Castellana', 'San Fernando', 'Bocagrande'])
        };

        try {
            await addDoc(collection(db, 'estudiantes'), {
                ...estudiante,
                creadoEn: serverTimestamp(),
                actualizadoEn: serverTimestamp()
            });
            estudiantesGenerados.push(estudiante);
        } catch (error) {
            console.error("Error al generar estudiante ficticio:", error);
        }
    }

    return estudiantesGenerados;
};
