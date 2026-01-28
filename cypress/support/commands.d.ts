declare namespace Cypress {
  interface Chainable<Subject = any> {
    /**
     * Custom command to programmatically log in by setting session storage.
     * This avoids having to log in via the UI in every test.
     * @param role 'admin' or 'usuario'. Defaults to 'admin'.
     * @example cy.login('admin')
     */
    login(role?: 'admin' | 'usuario'): Chainable<void>;
  }
}
