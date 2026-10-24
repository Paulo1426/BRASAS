/**
 * Fixtures sobre la BD de PRUEBAS (nunca producción).
 * Usa los servicios de auth/users, ya validados en la entrega 1, para crear
 * un local aislado por ejecución y poder borrarlo al final.
 */
// Salvaguarda: si .env.test no se cargó, app.js tomaría .env (producción). Se aborta antes de conectar.
if (process.env.DB_ENTORNO !== 'pruebas') {
  throw new Error('Falta apps/api/.env.test con DB_ENTORNO=pruebas: las pruebas con BD nunca usan la base de producción.');
}

const db = require('../../src/shared/database/db');
const authService = require('../../src/features/auth/service');
const usersService = require('../../src/features/users/users.service');

async function crearLocalDePrueba() {
  const sufijo = Date.now();
  const jefe = await authService.register({
    nombre: 'Jefe Test', email: `jefe.${sufijo}@brasas.test`, password: 'Clave123*', tipo_registro: 'jefe',
  });
  const { codigo_invitacion } = await usersService.generarCodigoInvitacion(jefe.user.id);
  const empleado = await authService.register({
    nombre: 'Empleado Test', email: `emp.${sufijo}@brasas.test`, password: 'Clave123*',
    tipo_registro: 'empleado', codigo_invitacion,
  });
  return {
    localId: jefe.user.local_id,
    jefe: { id: jefe.user.id, auth: `Bearer ${jefe.token}` },
    empleado: { id: empleado.user.id, auth: `Bearer ${empleado.token}` },
  };
}

/** Borra todo lo creado para el local, respetando el orden de las llaves foráneas. */
async function limpiarLocal(localId) {
  const sentencias = [
    'DELETE FROM historial WHERE local_id = $1',
    'DELETE FROM pedido_items WHERE pedido_id IN (SELECT id FROM pedidos WHERE local_id = $1)',
    'DELETE FROM pedidos WHERE local_id = $1',
    'DELETE FROM stock_movimientos WHERE insumo_id IN (SELECT id FROM insumos WHERE local_id = $1)',
    'DELETE FROM producto_insumos WHERE producto_id IN (SELECT id FROM productos WHERE local_id = $1)',
    'DELETE FROM productos WHERE local_id = $1',
    'DELETE FROM insumos WHERE local_id = $1',
    'DELETE FROM usuarios WHERE local_id = $1',
    'DELETE FROM locales WHERE id = $1',
  ];
  for (const sql of sentencias) {
    try { await db.query(sql, [localId]); } catch (e) { console.warn('[limpieza]', e.message); }
  }
}

module.exports = { db, crearLocalDePrueba, limpiarLocal };
