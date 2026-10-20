const CLAVE_TOKEN = "finanzas_token";
const CLAVE_USUARIO = "finanzas_usuario";

export class ApiError extends Error {
  constructor(mensaje, status) {
    super(mensaje);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Origen del API Gateway (Nginx :80). Usa NEXT_PUBLIC_API_GATEWAY si existe,
 *  pero siempre con el host desde el que el navegador abrió la app. */
export function gateway() {
  const cfg = process.env.NEXT_PUBLIC_API_GATEWAY;
  if (typeof window !== "undefined") {
    let puerto = "";
    if (cfg) {
      try {
        const u = new URL(cfg);
        if (u.port && u.port !== "80") puerto = `:${u.port}`;
      } catch {
        puerto = "";
      }
    }
    return `http://${window.location.hostname}${puerto}`;
  }
  return cfg || "http://localhost";
}

// ---------- Sesión ----------
export function getToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(CLAVE_TOKEN);
}

export function getUsuario() {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(window.localStorage.getItem(CLAVE_USUARIO) || "null");
  } catch {
    return null;
  }
}

export function setSesion(token, usuario) {
  window.localStorage.setItem(CLAVE_TOKEN, token);
  window.localStorage.setItem(CLAVE_USUARIO, JSON.stringify(usuario));
}

/** Actualiza los datos del usuario guardado (p. ej. al cambiar la moneda). */
export function setUsuario(usuario) {
  window.localStorage.setItem(CLAVE_USUARIO, JSON.stringify(usuario));
}

export function cerrarSesion() {
  window.localStorage.removeItem(CLAVE_TOKEN);
  window.localStorage.removeItem(CLAVE_USUARIO);
}

/** usuarioId desde el JWT (misma claim que usan Java, Go y Python). */
export function usuarioId() {
  const usuario = getUsuario();
  if (usuario && usuario.id) return usuario.id;
  const token = getToken();
  if (!token) return null;
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const datos = JSON.parse(atob(payload));
    return datos.usuarioId || null;
  } catch {
    return null;
  }
}

export function nombreUsuario() {
  const usuario = getUsuario();
  return usuario && usuario.nombre ? usuario.nombre : null;
}

function mensajeError(datos, status) {
  if (!datos) return `Error ${status}`;
  if (typeof datos.error === "string") return datos.error;
  if (typeof datos.detail === "string") return datos.detail;
  if (Array.isArray(datos.detail)) {
    return datos.detail.map((d) => d.msg || JSON.stringify(d)).join(", ");
  }
  if (typeof datos.message === "string" && datos.message) return datos.message;
  return `Error ${status}`;
}

/** Cliente HTTP: prefijo = API Gateway (Nginx), JWT automático en cada petición. */
export async function api(ruta, opciones = {}) {
  const { body, headers = {}, ...rest } = opciones;
  const token = getToken();

  const init = { ...rest, headers: { ...headers } };
  if (body !== undefined) {
    if (!init.headers["Content-Type"] && !init.headers["content-type"]) {
      init.headers["Content-Type"] = "application/json";
    }
    init.body = typeof body === "string" ? body : JSON.stringify(body);
  }
  if (token) init.headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(gateway() + ruta, init);
  } catch {
    throw new ApiError("No se pudo conectar con el servidor", 0);
  }

  if (res.status === 204) return null;

  const texto = await res.text();
  let datos = null;
  if (texto) {
    try {
      datos = JSON.parse(texto);
    } catch {
      datos = { mensaje: texto };
    }
  }

  if (!res.ok) {
    if (res.status === 401 && token) {
      cerrarSesion();
      if (typeof window !== "undefined") window.location.href = "/login";
    }
    throw new ApiError(mensajeError(datos, res.status), res.status);
  }
  return datos;
}
