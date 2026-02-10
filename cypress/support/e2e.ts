// cypress/support/e2e.ts
import './commands';

Cypress.on('window:before:load', (win) => {
    cy.spy(win.console, 'error').as('consoleError');
    cy.spy(win.console, 'warn').as('consoleWarn');
    cy.spy(win.console, 'log').as('consoleLog');
});

// Pipe console errors to Cypress log for better visibility in headless mode
Cypress.on('uncaught:exception', (err, runnable) => {
    console.error('Uncaught Exception:', err.message);
    return false; // prevent Cypress from failing the test immediately if we want to see more
});