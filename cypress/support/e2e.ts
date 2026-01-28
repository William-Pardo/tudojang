
// cypress/support/e2e.ts
// This file is processed automatically before running test files.
// It's a great place to put global configuration and behavior that modifies Cypress.

// FIX: Removed the failing triple-slash reference as types are handled via local declarations in the respective files to resolve compiler errors.
import './commands';

// Alternatively you can use CommonJS syntax:
// require('./commands')