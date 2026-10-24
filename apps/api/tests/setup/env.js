// Silencia los mensajes de dotenv 17 y carga .env.test ANTES de que app.js
// ejecute dotenv.config(); dotenv no sobreescribe variables ya definidas.
process.env.DOTENV_CONFIG_QUIET = 'true';
require('dotenv').config({ path: '.env.test' });
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-solo-para-pruebas';
