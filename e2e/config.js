// Valores por defecto para el ambiente local; se pueden sobreescribir con variables de entorno.
export const BASE_URL = process.env.BASE_URL ?? "http://localhost:5173";
export const API_URL  = process.env.API_URL  ?? "http://localhost:3000/api/v1";
export const TIMEOUT  = Number(process.env.TIMEOUT ?? 10000);

export const USUARIOS = {
  jefe:     { email: process.env.JEFE_EMAIL ?? "jefe.e2e@brasas.test",     password: process.env.JEFE_PASS ?? "Clave123*" },
  empleado: { email: process.env.EMP_EMAIL  ?? "empleado.e2e@brasas.test", password: process.env.EMP_PASS  ?? "Clave123*" },
};

// Datos semilla que crea support/seed.js
export const DATOS = {
  insumo:   { nombre: "Punta de anca (prueba)", costo: 30000 },
  producto: { nombre: "Churrasco 400 g (prueba)", precio: 45000, kg: 0.4 },
};
