// Crea (una sola vez) las cuentas y datos que usan las pruebas de aceptación.
// Ejecutar con la API corriendo contra la BD de PRUEBAS:  npm run seed
import { API_URL, USUARIOS, DATOS } from "../config.js";

async function llamar(metodo, ruta, cuerpo, token) {
  const res = await fetch(`${API_URL}${ruta}`, {
    method: metodo,
    headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok && res.status !== 409) throw new Error(`${metodo} ${ruta} → ${res.status} ${json.message ?? ""}`);
  return { status: res.status, json };
}

async function sesion({ email, password }) {
  return (await llamar("POST", "/auth/login", { email, password })).json.token;
}

const jefeReg = await llamar("POST", "/auth/register", { nombre: "Jefe E2E", ...USUARIOS.jefe, tipo_registro: "jefe" });
const tJefe = jefeReg.status === 409 ? await sesion(USUARIOS.jefe) : jefeReg.json.token;

const { json: { codigo_invitacion } } = await llamar("POST", "/usuarios/codigo-invitacion", null, tJefe);
await llamar("POST", "/auth/register", { nombre: "Empleado E2E", ...USUARIOS.empleado, tipo_registro: "empleado", codigo_invitacion });

const insumos = (await llamar("GET", "/inventario/insumos", null, tJefe)).json;
let insumo = insumos.find((i) => i.nombre === DATOS.insumo.nombre);
if (!insumo) {
  insumo = (await llamar("POST", "/inventario/insumos", {
    nombre: DATOS.insumo.nombre, tipo: "carne", unidad_medida: "kg",
    stock_actual: 50, stock_minimo: 5, costo_unitario_prom: DATOS.insumo.costo,
  }, tJefe)).json;
}

const productos = (await llamar("GET", "/productos", null, tJefe)).json;
if (!productos.some((p) => p.nombre === DATOS.producto.nombre)) {
  await llamar("POST", "/productos", {
    nombre: DATOS.producto.nombre, precio_venta: DATOS.producto.precio,
    insumos: [{ insumo_id: insumo.id, cantidad_requerida: DATOS.producto.kg }],
  }, tJefe);
}
console.log("✔ Datos de prueba listos:", USUARIOS.jefe.email, "/", USUARIOS.empleado.email);
