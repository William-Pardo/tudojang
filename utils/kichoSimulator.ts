
import { registrarAspirantePublico } from '../servicios/censoApi';

const APELLIDOS = [
    'GARCÍA', 'RODRÍGUEZ', 'MARTÍNEZ', 'HERNÁNDEZ', 'LÓPEZ',
    'GONZÁLEZ', 'PÉREZ', 'SÁNCHEZ', 'RAMÍREZ', 'TORRES',
    'FLORES', 'RIVERA', 'GÓMEZ', 'DÍAZ', 'REYES'
];

const NOMBRES = [
    'SANTIAGO', 'MATEO', 'SEBASTIÁN', 'LEONARDO', 'MATÍAS',
    'SOFÍA', 'VALENTINA', 'ISABELLA', 'CAMILA', 'VALERIA'
];

const EPS = ['SANITAS', 'SURA', 'SALUD TOTAL', 'COMPENSAR', 'NUEVA EPS'];
const RH = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

const generarAleatorio = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

export const simularRegistrosMasivos = async (cantidad: number, misionId: string, tenantId: string) => {
    for (let i = 0; i < cantidad; i++) {
        const nombre = generarAleatorio(NOMBRES);
        const apellido1 = generarAleatorio(APELLIDOS);
        const apellido2 = generarAleatorio(APELLIDOS);

        const esMenor = Math.random() > 0.3;
        const edad = esMenor ? Math.floor(Math.random() * 14) + 4 : Math.floor(Math.random() * 30) + 18;

        const fechaNac = new Date();
        fechaNac.setFullYear(fechaNac.getFullYear() - edad);

        const email = `test.${nombre.toLowerCase()}.${Math.floor(Math.random() * 1000)}@example.com`;
        const tel = `300${Math.floor(Math.random() * 9000000) + 1000000}`;

        const datos = {
            nombres: nombre,
            apellidos: `${apellido1} ${apellido2}`,
            email,
            telefono: tel,
            fechaNacimiento: fechaNac.toISOString().split('T')[0],
            eps: generarAleatorio(EPS),
            rh: generarAleatorio(RH),
            direccion: `CALLE ${Math.floor(Math.random() * 100)} # ${Math.floor(Math.random() * 50)}`,
            barrio: 'BARRIO DE PRUEBA',
            tutorNombre: esMenor ? generarAleatorio(NOMBRES) + ' ' + apellido1 : undefined,
            tutorApellidos: esMenor ? apellido2 : undefined,
            tutorCedula: esMenor ? '10' + Math.floor(Math.random() * 90000000) : undefined,
            tutorTelefono: esMenor ? tel : undefined,
            tutorEmail: esMenor ? email : undefined,
            parentesco: 'PADRE'
        };

        await registrarAspirantePublico(misionId, tenantId, datos);
    }
};
