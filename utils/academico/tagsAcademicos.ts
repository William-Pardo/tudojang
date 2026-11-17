// utils/academico/tagsAcademicos.ts
// Tags académicos estándar organizados por categoría para clasificación de recursos.

export interface GrupoTagAcademico {
  grupo: string;
  tags: readonly string[];
}

export const TAGS_ACADEMICOS_ESTANDAR: readonly GrupoTagAcademico[] = [
  {
    grupo: 'Etapa',
    tags: ['infantil', 'precadetes', 'cadetes', 'adultos', 'todos'],
  },
  {
    grupo: 'Nivel',
    tags: ['iniciacion', 'fundamentos', 'intermedio', 'avanzado', 'competencia', 'alto rendimiento'],
  },
  {
    grupo: 'Tecnica',
    tags: ['patada frontal', 'patada lateral', 'patada circular', 'bloqueos', 'defensa', 'combate', 'poomsae', 'kyorugi', 'rompimiento'],
  },
  {
    grupo: 'Capacidad',
    tags: ['coordinacion', 'equilibrio', 'flexibilidad', 'fuerza', 'velocidad', 'resistencia', 'control postural'],
  },
  {
    grupo: 'Uso',
    tags: ['estudio', 'practica', 'repaso', 'refuerzo', 'evaluacion', 'quiz', 'tarea', 'planeacion', 'demostracion'],
  },
  {
    grupo: 'Formato',
    tags: ['pdf', 'imagen', 'video', 'documento', 'presentacion', 'hoja de calculo'],
  },
  {
    grupo: 'Momento',
    tags: ['antes de clase', 'durante clase', 'despues de clase'],
  },
  {
    grupo: 'Operacion',
    tags: ['asistencia', 'trazabilidad', 'programa', 'ciclo', 'sede', 'instructor'],
  },
] as const;

export const alternarTagEnTexto = (textoActual: string, tag: string): string => {
  const tagsActuales = textoActual
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t, index, todos) => todos.findIndex((actual) => actual.toLowerCase() === t.toLowerCase()) === index);
  const yaExiste = tagsActuales.some((actual) => actual.toLowerCase() === tag.toLowerCase());
  const nuevosTags = yaExiste
    ? tagsActuales.filter((actual) => actual.toLowerCase() !== tag.toLowerCase())
    : [...tagsActuales, tag];
  return nuevosTags.join(', ');
};

export const parsearTagsTexto = (entrada: string): string[] => (
  entrada
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .filter((tag, index, todos) => todos.findIndex((actual) => actual.toLowerCase() === tag.toLowerCase()) === index)
);
