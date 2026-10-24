/**
 * Utilidades de los hilos H01–H05 (todo pasa por la API real, como lo haría el frontend).
 * Requiere la BD de pruebas: se importa después de fixturesBD.
 */
const request = require('supertest');
const app = require('../../src/app');

const api = () => request(app);
const hoy = () => new Date().toLocaleDateString('en-CA');   // AAAA-MM-DD, igual que <input type="date">

async function crearInsumo(auth, datos) {
  const res = await api().post('/api/v1/inventario/insumos').set('Authorization', auth)
    .send({ tipo: 'insumo', unidad_medida: 'kg', stock_minimo: 0, ...datos });
  if (res.status !== 201) throw new Error(`No se creó el insumo: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

async function crearProducto(auth, datos) {
  const res = await api().post('/api/v1/productos').set('Authorization', auth).send(datos);
  if (res.status !== 201) throw new Error(`No se creó el producto: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

async function crearPedido(auth, items) {
  return api().post('/api/v1/pedidos').set('Authorization', auth).send({ items });
}

async function cambiarEstado(auth, pedidoId, estado, pago) {
  return api().put(`/api/v1/pedidos/${pedidoId}/estado`).set('Authorization', auth).send({ estado, ...(pago && { pago }) });
}

module.exports = { api, hoy, crearInsumo, crearProducto, crearPedido, cambiarEstado };
