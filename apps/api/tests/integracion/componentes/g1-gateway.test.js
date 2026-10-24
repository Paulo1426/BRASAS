/**
 * G1 · API Gateway (src/app.js: helmet, express.json, CORS, Swagger y montaje de routers)
 * Integración (CI-A10, CI-DA1, CI-DA2): se ejecuta la app real; la BD es un stub.
 */
jest.mock('../../../src/shared/database/db', () => require('../../helpers/fakeDb').crearFakeDb());

const request = require('supertest');
const app = require('../../../src/app');
const { tokenPara } = require('../../helpers/auth');

describe('G1 · API Gateway', () => {
  test('G1-01 · helmet agrega cabeceras de seguridad', async () => {
    const res = await request(app).get('/api/v1/pedidos');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  test('G1-02 · CORS permite el origen del frontend (http://localhost:5173)', async () => {
    const res = await request(app).options('/api/v1/pedidos')
      .set('Origin', 'http://localhost:5173').set('Access-Control-Request-Method', 'POST');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  test('G1-03 · CORS no autoriza un origen externo', async () => {
    const res = await request(app).get('/api/v1/pedidos').set('Origin', 'https://sitio-externo.com');
    expect(res.headers['access-control-allow-origin']).not.toBe('https://sitio-externo.com');
  });

  test('G1-04 · JSON mal formado → 400 sin llegar al controlador', async () => {
    const res = await request(app).post('/api/v1/pedidos').set('Authorization', tokenPara('EMPLEADO'))
      .set('Content-Type', 'application/json').send('{"items": [');
    expect(res.status).toBe(400);
  });

  test('G1-05 · Ruta inexistente → 404', async () => {
    const res = await request(app).get('/api/v1/no-existe');
    expect(res.status).toBe(404);
  });

  test('G1-06 · Documentación Swagger disponible en /api-docs/', async () => {
    const res = await request(app).get('/api-docs/');
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/swagger/i);
  });

  test('G1-07 · Los 5 routers de los módulos están montados (responden 401 y no 404 sin token)', async () => {
    const rutas = ['/api/v1/pedidos', '/api/v1/inventario/insumos', '/api/v1/productos', '/api/v1/reportes/resumen', '/api/v1/historial'];
    const estados = await Promise.all(rutas.map((r) => request(app).get(r).then((res) => res.status)));
    expect(estados).toEqual([401, 401, 401, 401, 401]);
  });
});
