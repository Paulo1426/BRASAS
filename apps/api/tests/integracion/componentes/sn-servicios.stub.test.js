/**
 * SN · Servicios de negocio N2–N5 SIMULADOS (stubs) bajo el API Gateway real
 * Reales: app.js (G1) → routers → auth.middleware (T1) → controllers de inventario, productos, reportes e historial
 * Stubs: inventario.service, productos.service, reportes.service, historial.service y db.
 * Se usa en la integración descendente (CI-DP4 antes de reemplazar los stubs, CI-DA3).
 */
jest.mock('../../../src/shared/database/db', () => require('../../helpers/fakeDb').crearFakeDb());
jest.mock('../../../src/features/inventario/inventario.service', () => ({ createMovimiento: jest.fn(), getInsumos: jest.fn() }));
jest.mock('../../../src/features/productos/productos.service', () => ({ create: jest.fn(), createCategoria: jest.fn(), getAll: jest.fn() }));
jest.mock('../../../src/features/reportes/reportes.service', () => ({ getResumen: jest.fn() }));
jest.mock('../../../src/features/historial/historial.service', () => ({
  getHistorial: jest.fn(), registrar: jest.fn().mockResolvedValue({}),
  VALID_TIPOS: ['CREAR', 'EDITAR', 'ELIMINAR', 'LOGIN', 'LOGOUT', 'COMPLETAR', 'CANCELAR'],
  VALID_ENTIDADES: ['productos', 'pedidos', 'carnes', 'insumos', 'inventario', 'usuarios', 'auth'],
}));

const request = require('supertest');
const app = require('../../../src/app');
const inventarioService = require('../../../src/features/inventario/inventario.service');
const productosService = require('../../../src/features/productos/productos.service');
const reportesService = require('../../../src/features/reportes/reportes.service');
const historialService = require('../../../src/features/historial/historial.service');
const { IDS, tokenPara } = require('../../helpers/auth');

const INSUMO_ID = '33333333-3333-4333-8333-333333333333';

describe('SN · controllers de N2–N5 con servicios simulados', () => {
  test('SN-01 · POST /inventario/entrada delega con usuario y local del token → 201', async () => {
    inventarioService.createMovimiento.mockResolvedValue({ stock_actual: '15', alerta_stock: false });
    const res = await request(app).post('/api/v1/inventario/entrada').set('Authorization', tokenPara('JEFE'))
      .send({ insumo_id: INSUMO_ID, cantidad: 5, costo_unitario: 30000 });
    expect(res.status).toBe(201);
    expect(inventarioService.createMovimiento).toHaveBeenCalledWith(expect.objectContaining({
      tipo: 'entrada', usuario_id: IDS.JEFE, local_id: IDS.LOCAL, cantidad: 5,
    }));
  });

  test('SN-02 · INSUMO_NO_ENCONTRADO del servicio → 404', async () => {
    inventarioService.createMovimiento.mockRejectedValue(new Error('INSUMO_NO_ENCONTRADO'));
    const res = await request(app).post('/api/v1/inventario/entrada').set('Authorization', tokenPara('JEFE'))
      .send({ insumo_id: INSUMO_ID, cantidad: 5 });
    expect(res.status).toBe(404);
  });

  test('SN-03 · STOCK_INSUFICIENTE del servicio en una salida → 400', async () => {
    inventarioService.createMovimiento.mockRejectedValue(new Error('STOCK_INSUFICIENTE'));
    const res = await request(app).post('/api/v1/inventario/salida').set('Authorization', tokenPara('JEFE'))
      .send({ insumo_id: INSUMO_ID, cantidad: 50 });
    expect(res.status).toBe(400);
  });

  test('SN-04 · POST /productos delega con el local del token → 201', async () => {
    productosService.create.mockResolvedValue({ id: 'prod-1', nombre: 'Churrasco' });
    const res = await request(app).post('/api/v1/productos').set('Authorization', tokenPara('JEFE'))
      .send({ nombre: 'Churrasco', precio_venta: 45000 });
    expect(res.status).toBe(201);
    expect(productosService.create).toHaveBeenCalledWith(expect.objectContaining({ local_id: IDS.LOCAL, precio_venta: 45000 }));
  });

  test('SN-05 · CATEGORIA_DUPLICADA del servicio → 409', async () => {
    productosService.createCategoria.mockRejectedValue(new Error('CATEGORIA_DUPLICADA'));
    const res = await request(app).post('/api/v1/productos/categorias').set('Authorization', tokenPara('JEFE'))
      .send({ nombre: 'Carnes' });
    expect(res.status).toBe(409);
  });

  test('SN-06 · GET /reportes/resumen?periodo=diario → getResumen("diario", local del token)', async () => {
    reportesService.getResumen.mockResolvedValue({ periodo: 'diario' });
    const res = await request(app).get('/api/v1/reportes/resumen?periodo=diario').set('Authorization', tokenPara('JEFE'));
    expect(res.status).toBe(200);
    expect(reportesService.getResumen).toHaveBeenCalledWith('diario', IDS.LOCAL);
  });

  test('SN-07 · GET /historial → getHistorial(rol, usuario, local, filtros) con los filtros recibidos', async () => {
    historialService.getHistorial.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
    const res = await request(app).get('/api/v1/historial?tipo_accion=CREAR&fecha_inicio=2026-10-01').set('Authorization', tokenPara('JEFE'));
    expect(res.status).toBe(200);
    expect(historialService.getHistorial).toHaveBeenCalledWith('JEFE', IDS.JEFE, IDS.LOCAL,
      expect.objectContaining({ tipo_accion: 'CREAR', fecha_inicio: '2026-10-01' }));
  });

  test('SN-08 · Error inesperado del servicio → 500 genérico, sin exponer el detalle técnico', async () => {
    reportesService.getResumen.mockRejectedValue(new Error('relation "pedidos" does not exist'));
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app).get('/api/v1/reportes/resumen').set('Authorization', tokenPara('JEFE'));
    errorLog.mockRestore();
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/relation/);
  });
});
