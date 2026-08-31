import { generarAlertasAsistenciales, nombreCoincideConTutor, EDAD_INUSUAL_MINIMA } from './validacionAsistencial';

describe('generarAlertasAsistenciales', () => {
  const base = { edad: 25, nombres: 'Juan', apellidos: 'Perez', tutorNombres: 'Maria', tutorApellidos: 'Gomez' };

  it('no reporta alertas para un registro bien formado (caso "todo bien")', () => {
    expect(generarAlertasAsistenciales(base)).toEqual([]);
  });

  describe('edad implausible (posible error de fecha de nacimiento)', () => {
    it('marca una edad mayor a 100 años', () => {
      const alertas = generarAlertasAsistenciales({ ...base, edad: 150 });
      expect(alertas).toHaveLength(1);
      expect(alertas[0]).toMatch(/fecha de nacimiento parece incorrecta/i);
    });

    it('marca una edad negativa', () => {
      const alertas = generarAlertasAsistenciales({ ...base, edad: -1 });
      expect(alertas).toHaveLength(1);
      expect(alertas[0]).toMatch(/fecha de nacimiento parece incorrecta/i);
    });

    it('no marca nada si la edad es null (fecha no calculable)', () => {
      expect(generarAlertasAsistenciales({ ...base, edad: null })).toEqual([]);
    });
  });

  describe('edad inusual pero posible (pide confirmar)', () => {
    it('marca desde EDAD_INUSUAL_MINIMA pidiendo confirmar la fecha de nacimiento', () => {
      const alertas = generarAlertasAsistenciales({ ...base, edad: EDAD_INUSUAL_MINIMA });
      expect(alertas).toHaveLength(1);
      expect(alertas[0]).toMatch(/confirma/i);
    });

    it('no marca nada justo debajo del umbral', () => {
      expect(generarAlertasAsistenciales({ ...base, edad: EDAD_INUSUAL_MINIMA - 1 })).toEqual([]);
    });

    it('no duplica el mensaje de "implausible" para edades > 100 (solo reporta una alerta)', () => {
      const alertas = generarAlertasAsistenciales({ ...base, edad: 101 });
      expect(alertas).toHaveLength(1);
    });
  });

  describe('nombre del alumno calcado del tutor', () => {
    it('marca cuando el nombre completo coincide con el del tutor', () => {
      const alertas = generarAlertasAsistenciales({ ...base, tutorNombres: 'Juan', tutorApellidos: 'Perez' });
      expect(alertas).toHaveLength(1);
      expect(alertas[0]).toMatch(/idéntico al del tutor/i);
    });

    it('no marca nada si falta el nombre del tutor', () => {
      expect(generarAlertasAsistenciales({ ...base, tutorNombres: undefined, tutorApellidos: undefined })).toEqual([]);
    });
  });

  it('acumula alertas de edad implausible y nombre calcado del tutor a la vez (triangulación)', () => {
    const alertas = generarAlertasAsistenciales({
      edad: 150, nombres: 'Juan', apellidos: 'Perez', tutorNombres: 'Juan', tutorApellidos: 'Perez'
    });
    expect(alertas).toHaveLength(2);
  });
});

describe('nombreCoincideConTutor', () => {
  it('detecta coincidencia normalizando mayúsculas y espacios', () => {
    expect(nombreCoincideConTutor(' Juan ', 'PEREZ', 'juan', 'perez ')).toBe(true);
  });

  it('no detecta coincidencia si los nombres difieren', () => {
    expect(nombreCoincideConTutor('Juan', 'Perez', 'Maria', 'Gomez')).toBe(false);
  });

  it('no detecta coincidencia si falta el nombre del tutor', () => {
    expect(nombreCoincideConTutor('Juan', 'Perez', undefined, undefined)).toBe(false);
  });
});
