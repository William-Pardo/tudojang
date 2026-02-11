
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Estudiante, GradoTKD, GrupoEdad, EstadoPago } from '../tipos';

const NOMBRES = ["Santiago", "Sebastián", "Matías", "Mateo", "Nicolás", "Alejandro", "Samuel", "Valeria", "Sofía", "Mariana", "Valentina", "Isabella", "Camila", "Luciana", "Martín", "Daniel", "Joaquín", "Gabriela", "Victoria", "Emilia"];
const APELLIDOS = ["Rodríguez", "Gómez", "González", "López", "García", "Martínez", "Ramírez", "Hernández", "Díaz", "Pérez", "Torres", "Muñoz", "Rojas", "Moreno", "Vargas", "Jiménez", "Castro", "Ortiz", "Gutiérrez", "Ruiz"];
const GRADOS_VALUES = Object.values(GradoTKD);
const GRUPOS_VALUES = Object.values(GrupoEdad);

export const generarEstudiantesDemo = async (tenantId: string, cantidad: number = 10, onProgress?: (msg: string) => void) => {
    const estudiantesGenerados: Estudiante[] = [];
    const coleccionRef = collection(db, "estudiantes");

    for (let i = 0; i < cantidad; i++) {
        const nombre = NOMBRES[Math.floor(Math.random() * NOMBRES.length)];
        const apellido1 = APELLIDOS[Math.floor(Math.random() * APELLIDOS.length)];
        const apellido2 = APELLIDOS[Math.floor(Math.random() * APELLIDOS.length)];

        // 30% de probabilidad de tener deuda
        const tieneDeuda = Math.random() < 0.3;
        const estadoPago = tieneDeuda ? EstadoPago.Vencido : EstadoPago.AlDia;
        const saldoDeudor = tieneDeuda ? Math.floor(Math.random() * 200000) : 0;

        const grado = GRADOS_VALUES[Math.floor(Math.random() * GRADOS_VALUES.length)];
        const grupo = GRUPOS_VALUES[Math.floor(Math.random() * (GRUPOS_VALUES.length - 1))]; // Excluir NoAsignado si es posible

        const estudianteDemo: Omit<Estudiante, 'id'> = {
            tenantId,
            nombres: nombre,
            apellidos: `${apellido1} ${apellido2}`,
            numeroIdentificacion: Math.floor(1000000000 + Math.random() * 9000000000).toString(),
            fechaNacimiento: new Date(2010 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28)).toISOString().split('T')[0],
            grado: grado as GradoTKD,
            grupo: grupo as GrupoEdad,
            horasAcumuladasGrado: Math.floor(Math.random() * 50),
            sedeId: '1', // Asumiendo sede 1 o mock
            telefono: `3${Math.floor(100 + Math.random() * 200)} ${Math.floor(100 + Math.random() * 899)} ${Math.floor(1000 + Math.random() * 8999)}`,
            correo: `alumno${Math.floor(Math.random() * 10000)}@test.com`,
            fechaIngreso: new Date().toISOString().split('T')[0],
            estadoPago: estadoPago,
            saldoDeudor: saldoDeudor,
            historialPagos: [],
            consentimientoInformado: Math.random() > 0.2, // 80% firmado
            contratoServiciosFirmado: Math.random() > 0.2,
            consentimientoImagenFirmado: Math.random() > 0.2,
            consentimientoFotosVideos: true,
            carnetGenerado: Math.random() > 0.5,
            alergias: Math.random() > 0.9 ? "Polvo, Ácaros" : "",
            lesiones: Math.random() > 0.9 ? "Rodilla derecha" : "",
            tutor: {
                nombres: NOMBRES[Math.floor(Math.random() * NOMBRES.length)],
                apellidos: `${apellido1} ${apellido2}`, // Mismos apellidos usualmente
                numeroIdentificacion: Math.floor(50000000 + Math.random() * 50000000).toString(),
                telefono: `300${Math.floor(1000000 + Math.random() * 9000000)}`,
                correo: `tutor${Math.floor(Math.random() * 10000)}@test.com`
            }
        };

        try {
            if (onProgress) onProgress(`Creando ${nombre} ${apellido1}...`);
            await addDoc(coleccionRef, estudianteDemo);
        } catch (error) {
            console.error("Error al crear estudiante demo", error);
        }
    }

    if (onProgress) onProgress("¡Finalizado! Estudiantes creados.");
};
