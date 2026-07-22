'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { construirCorreoInvitacion } = require('./plantillasInvitacion');

test('Estudiante: usa la plantilla de alumno con su nombre y el enlace', () => {
  const { asunto, html } = construirCorreoInvitacion('Estudiante', {
    nombreDestinatario: 'Ana Pérez',
    enlace: 'https://tudojang.com/#/activar-cuenta?x=1',
  });
  assert.match(asunto, /bienvenida/i);
  assert.match(html, />Ana Pérez<\/span>/);
  assert.match(html, /Asignar mi Contraseña/);
  assert.match(html, /https:\/\/tudojang\.com\/#\/activar-cuenta\?x=1/);
  assert.doesNotMatch(html, /\{\{/);
});

test('Tutor: usa la plantilla de tutor con su nombre Y el nombre del alumno', () => {
  const { asunto, html } = construirCorreoInvitacion('Tutor', {
    nombreDestinatario: 'Carlos Gómez',
    nombreAlumno: 'Sofía Gómez',
    enlace: 'https://tudojang.com/#/activar-cuenta?x=2',
  });
  assert.match(asunto, /Tutores/);
  assert.match(html, />Carlos Gómez<\/span>/);
  assert.match(html, />Sofía Gómez<\/span>/);
  assert.match(html, /Configurar mi Contraseña/);
});

test('Maestro: usa la plantilla de instructor con "Sabonim"', () => {
  const { html } = construirCorreoInvitacion('Maestro', {
    nombreDestinatario: 'Juan Ríos',
    enlace: 'https://tudojang.com/#/activar-cuenta?x=3',
  });
  assert.match(html, /Sabonim Juan Ríos/);
  assert.match(html, /Acceso para Instructores/);
});

test('Asistente: usa la plantilla administrativa', () => {
  const { html } = construirCorreoInvitacion('Asistente', {
    nombreDestinatario: 'Laura Díaz',
    enlace: 'https://tudojang.com/#/activar-cuenta?x=4',
  });
  assert.match(html, /Acceso Administrativo/);
  assert.match(html, /Laura Díaz/);
});

test('sin nombreDestinatario, usa un fallback razonable (no revienta)', () => {
  const { html } = construirCorreoInvitacion('Estudiante', { enlace: 'https://x.com' });
  assert.match(html, />estudiante<\/span>/);
  assert.doesNotMatch(html, /\{\{/);
});
