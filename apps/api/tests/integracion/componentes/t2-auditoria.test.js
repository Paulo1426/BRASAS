/**
 * T2 · Auditoría automática (audit.middleware → historial.service → historial.repository)
 * - Hoja (CI-A03): el driver invoca auditMiddleware con req/res simulados y un stub de historial.service.
 * - Integrado (CI-A07, CI-DP6, CI-DA4): middleware + servicio + repositorio reales dentro de app.js;
 *   la BD es un stub que registra cada INSERT INTO historial.
 */
const { EventEmitter } = require('events');

jest.mock('../../../src/shared/database/db', () => require('../../helpers/fakeDb').crearFakeDb());

const request = require('supertest');
const db = require('../../../src/shared/database/db');
const { IDS, tokenPara, esperarAsync } = require('../../helpers/auth');

const PEDIDO_ID = '99999999-9999-4999-8999-999999999999';
const PRODUCTO_ID = '22222222-2222-4222-8222-222222222222';
const insertsHistorial = () => db.__sentencias().filter(({ sql }) => /INSERT INTO historial/.test(sql));

describe('T2 · hoja con driver (historial.service simulado)', () => {
  let auditMiddleware; let registrar;

  beforeAll(() => {
    jest.isolateModules(() => {
      jest.doMock('../../../src/features/historial/historial.service', () => ({ registrar: jest.fn().mockResolvedValue({}) }));
      ({ auditMiddleware } = require('../../../src/shared/middlewares/audit.middleware'));
      ({ registrar } = require('../../../src/features/historial/historial.service'));
    });
    jest.dontMock('../../../src/features/historial/historial.service');   // el bloque integrado usa el real
  });
  beforeEach(() => registrar.mockClear());

  /** Ejecuta el middleware y simula el fin de la respuesta con el código indicado. */
  const ejecutar = (method, path, statusCode) => {
    const req = { method, path, user: { id: IDS.JEFE, local_id: IDS.LOCAL } };
    const res = Object.assign(new EventEmitter(), { statusCode });
    const next = jest.fn();
    auditMiddleware(req, res, next);
    res.emit('finish');
    return next;
  };

  test('T2-01 · POST 201 → registrar(CREAR, entidad del path, usuario y local del token)', () => {
    const next = ejecutar('POST', '/api/v1/pedidos', 201);
    expect(next).toHaveBeenCalled();
    expect(registrar).toHaveBeenCalledWith(expect.objectContaining({
      tipo_accion: 'CREAR', entidad: 'pedidos', entidad_id: null, usuario_id: IDS.JEFE, local_id: IDS.LOCAL,
    }));
  });

  test('T2-02 · PUT 200 sobre /pedidos/:id/estado → EDITAR con entidad_id = id', () => {
    ejecutar('PUT', `/api/v1/pedidos/${PEDIDO_ID}/estado`, 200);
    expect(registrar).toHaveBeenCalledWith(expect.objectContaining({ tipo_accion: 'EDITAR', entidad_id: PEDIDO_ID }));
  });

  test('T2-03 · POST con 400 (operación rechazada) → no se registra', () => {
    ejecutar('POST', '/api/v1/inventario/salida', 400);
    expect(registrar).not.toHaveBeenCalled();
  });

  test('T2-04 · GET → no se registra (solo mutaciones)', () => {
    ejecutar('GET', '/api/v1/pedidos', 200);
    expect(registrar).not.toHaveBeenCalled();
  });

  test('T2-05 · POST /auth/login 200 → excluido del historial automático', () => {
    ejecutar('POST', '/api/v1/auth/login', 200);
    expect(registrar).not.toHaveBeenCalled();
  });
});

describe('T2 · integrado (middleware + servicio + repositorio reales)', () => {
  let app;
  beforeAll(() => { app = require('../../../src/app'); });
  beforeEach(() => db.__reset());

  // En app.js el middleware lee req.path cuando la respuesta termina; para entonces Express dejó la ruta
  // relativa al router (/insumos, /, /:id/estado). Se espera la entidad del módulo, no el segmento interno.
  test('T2-06 · Crear un insumo inserta en historial (CREAR · inventario · usuario JEFE)', async () => {
    db.__cuando(/INSERT INTO insumos/, (p) => ({ rows: [{ id: 'ins-1', nombre: p[1] }] }));
    const res = await request(app).post('/api/v1/inventario/insumos').set('Authorization', tokenPara('JEFE'))
      .send({ nombre: 'Sal marina', unidad_medida: 'kg' });
    await esperarAsync();
    expect(res.status).toBe(201);
    const [insert] = insertsHistorial();
    expect(insert.params).toEqual([IDS.JEFE, IDS.LOCAL, 'inventario', null, 'CREAR', expect.any(String)]);
  });

  test('T2-07 · Crear un pedido debe dejar UN solo registro CREAR en el historial', async () => {
    db.__cuando(/SELECT precio_venta FROM productos/, () => ({ rows: [{ precio_venta: '45000' }] }));
    db.__cuando(/INSERT INTO pedidos/, () => ({ rows: [{ id: PEDIDO_ID, estado: 'pendiente', total: '45000' }] }));
    db.__cuando(/FROM pedidos p LEFT JOIN usuarios/, () => ({ rows: [{ id: PEDIDO_ID, estado: 'pendiente', total: '45000' }] }));
    const res = await request(app).post('/api/v1/pedidos').set('Authorization', tokenPara('EMPLEADO'))
      .send({ items: [{ producto_id: PRODUCTO_ID, cantidad: 1 }] });
    await esperarAsync();
    expect(res.status).toBe(201);
    const creaciones = insertsHistorial().filter(({ params }) => params[4] === 'CREAR');
    expect(creaciones.map(({ params }) => params[2])).toEqual(['pedidos']);   // servicio y middleware registran la misma acción
  });

  test('T2-08 · Si falla el INSERT en historial, la operación principal responde igual (201)', async () => {
    db.__cuando(/INSERT INTO insumos/, (p) => ({ rows: [{ id: 'ins-2', nombre: p[1] }] }));
    db.__cuando(/INSERT INTO historial/, () => { throw new Error('conexión perdida'); });
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app).post('/api/v1/inventario/insumos').set('Authorization', tokenPara('JEFE'))
      .send({ nombre: 'Carbón', unidad_medida: 'kg' });
    await esperarAsync();
    expect(res.status).toBe(201);
    expect(errorLog).toHaveBeenCalledWith('[Historial] fallo al registrar:', 'conexión perdida');
    errorLog.mockRestore();
  });
});
