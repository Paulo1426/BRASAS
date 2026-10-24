/**
 * T1 · Autenticación y roles (shared/middlewares/auth.middleware.js)
 * - Hoja (CI-A03): el driver invoca verifyToken / requireRole / requireAnyRole con req/res simulados.
 * - Integrado (CI-A07, CI-DP5, CI-DA4): el middleware real protege los routers de los 5 módulos;
 *   la BD se reemplaza por un stub, de modo que solo se observa la decisión de acceso.
 */
jest.mock('../../../src/shared/database/db', () => require('../../helpers/fakeDb').crearFakeDb());

const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../../../src/app');
const db = require('../../../src/shared/database/db');
const { verifyToken, requireRole, requireAnyRole } = require('../../../src/shared/middlewares/auth.middleware');
const { payloadPara, tokenPara } = require('../../helpers/auth');

/** Respuesta simulada que registra status y cuerpo. */
const resSimulada = () => {
  const res = { statusCode: 200, body: null };
  res.status = jest.fn((c) => { res.statusCode = c; return res; });
  res.json = jest.fn((b) => { res.body = b; return res; });
  return res;
};

describe('T1 · hoja con driver', () => {
  test('T1-01 · Sin cabecera Authorization → 401 y no continúa', () => {
    const req = { headers: {} }; const res = resSimulada(); const next = jest.fn();
    verifyToken(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('T1-02 · Token vencido → 401 con code TOKEN_EXPIRED', () => {
    const vencido = jwt.sign({ ...payloadPara('JEFE'), exp: Math.floor(Date.now() / 1000) - 60 }, process.env.JWT_SECRET);
    const req = { headers: { authorization: `Bearer ${vencido}` } }; const res = resSimulada();
    verifyToken(req, res, jest.fn());
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('TOKEN_EXPIRED');
  });

  test('T1-03 · Token firmado con otro secreto → 401', () => {
    const falso = jwt.sign(payloadPara('ADMIN'), 'otro-secreto');
    const req = { headers: { authorization: `Bearer ${falso}` } }; const res = resSimulada();
    verifyToken(req, res, jest.fn());
    expect(res.statusCode).toBe(401);
  });

  test('T1-04 · Token válido con rol en minúscula → req.user.rol en MAYÚSCULA y next()', () => {
    const req = { headers: { authorization: tokenPara('JEFE', { rol: 'jefe' }) } };
    const next = jest.fn();
    verifyToken(req, resSimulada(), next);
    expect(next).toHaveBeenCalled();
    expect(req.user.rol).toBe('JEFE');
  });

  test('T1-05 · requireRole("ADMIN") con JEFE → 403; requireAnyRole("JEFE","ADMIN") con JEFE → next()', () => {
    const req = { user: { rol: 'JEFE' } };
    const res = resSimulada(); const next = jest.fn();
    requireRole('ADMIN')(req, res, next);
    expect(res.statusCode).toBe(403);
    requireAnyRole('JEFE', 'ADMIN')(req, resSimulada(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe('T1 · integrado en los routers de los 5 módulos', () => {
  const rutasProtegidas = [
    ['GET', '/api/v1/pedidos/todos'],
    ['GET', '/api/v1/inventario/insumos'],
    ['GET', '/api/v1/productos/costos'],
    ['GET', '/api/v1/reportes/resumen'],
    ['GET', '/api/v1/historial'],
  ];

  test.each(rutasProtegidas)('T1-06 · %s %s sin token → 401 (RNF-01)', async (metodo, ruta) => {
    const res = await request(app)[metodo.toLowerCase()](ruta);
    expect(res.status).toBe(401);
  });

  test.each(rutasProtegidas.slice(0, 4))('T1-07 · %s %s con token de EMPLEADO → 403', async (metodo, ruta) => {
    const res = await request(app)[metodo.toLowerCase()](ruta).set('Authorization', tokenPara('EMPLEADO'));
    expect(res.status).toBe(403);
  });

  test('T1-08 · GET /historial con token de EMPLEADO → 200 (alcance restringido en el servicio)', async () => {
    db.__cuando(/COUNT\(\*\) AS total/, () => ({ rows: [{ total: '0' }] }));
    const res = await request(app).get('/api/v1/historial').set('Authorization', tokenPara('EMPLEADO'));
    expect(res.status).toBe(200);
  });
});
