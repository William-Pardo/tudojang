module.exports = {
  testEnvironment: 'node',
  // Acotado a los 2 archivos que realmente usan Jest (jest.fn/describe globales) -- el
  // resto de academico/*.test.js usa node:test y se corre desde npm test en package.json.
  // Un testMatch genérico ('**/*.test.js') rompería esos con "jest is not defined".
  testMatch: ['**/drive.test.js', '**/invitaciones.test.js'],
};
