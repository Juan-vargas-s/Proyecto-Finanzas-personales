/**
 * Cálculos puros de las metas de ahorro.
 *
 * Toda la lógica de negocio del progreso de una meta vive aquí y no en el
 * JSX: así se puede probar sin montar React y las tarjetas de la UI solo se
 * encargan de pintar el resultado.
 *
 * Las fechas se interpretan en hora local (la fecha límite "2026-12-31" es el
 * 31 de diciembre del calendario del usuario, no el 30 en UTC).
 */

/** Días promedio de un mes (365.25 / 12). */
export const DIAS_POR_MES = 30.44;

const MS_POR_DIA = 86400000;

/**
 * Margen de tolerated: una meta solo pasa a "en riesgo" si el ritmo que
 * necesita supera al ritmo real en más de un 15% (evita marcar metas que
 * van justo a tiempo).
 */
export const TOLERANCIA_RIESGO = 1.15;

export const ESTADO_COMPLETADA = "completada";
export const ESTADO_EN_RIESGO = "en_riesgo";
export const ESTADO_VENCIDA = "vencida";
export const ESTADO_EN_BUEN_DIA = "en_buen_dia";

/** Etiquetas legibles de cada estado. */
export const ETIQUETAS_ESTADO = {
  [ESTADO_COMPLETADA]: "Completada",
  [ESTADO_EN_RIESGO]: "En riesgo",
  [ESTADO_VENCIDA]: "Vencida",
  [ESTADO_EN_BUEN_DIA]: "En buen día",
};

function numero(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

/** Monto objetivo de la meta. */
export function objetivo(meta) {
  return numero(meta && meta.montoObjetivo);
}

/** Monto ya ahorrado en la meta. */
export function ahorrado(meta) {
  return numero(meta && meta.montoActual);
}

/**
 * Cuánto falta para cumplir la meta. Nunca es negativo (si ya se cumplió,
 * falta 0).
 */
export function faltante(meta) {
  return Math.max(0, objetivo(meta) - ahorrado(meta));
}

/** Porcentaje de avance, acotado a 100 para poder pintar barras y anillos. */
export function porcentaje(meta) {
  const obj = objetivo(meta);
  if (obj <= 0) return 0;
  return Math.min(100, (ahorrado(meta) / obj) * 100);
}

/** La fecha límite como Date local, o null si no hay o es inválida. */
export function fechaLimite(meta) {
  const iso = meta && meta.fechaLimite;
  if (!iso || typeof iso !== "string") return null;
  const partes = iso.split("-").map(Number);
  if (partes.length !== 3 || partes.some((n) => !Number.isFinite(n))) return null;
  const [anio, mes, dia] = partes;
  const fecha = new Date(anio, mes - 1, dia);
  // Descarta fechas imposibles (31 de febrero): Date las desplaza al mes siguiente.
  if (fecha.getFullYear() !== anio || fecha.getMonth() !== mes - 1) return null;
  return fecha;
}

function medianoche(fecha) {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
}

/**
 * Días que faltan para la fecha límite. Negativo si la meta ya venció y
 * null si la meta no tiene fecha límite.
 */
export function diasRestantes(meta, hoy = new Date()) {
  const limite = fechaLimite(meta);
  if (!limite) return null;
  return Math.ceil((limite.getTime() - medianoche(hoy).getTime()) / MS_POR_DIA);
}

/**
 * Meses que faltan para la fecha límite (30.44 días por mes). Null si la
 * meta no tiene fecha límite.
 */
export function mesesRestantes(meta, hoy = new Date()) {
  const dias = diasRestantes(meta, hoy);
  if (dias === null) return null;
  return dias / DIAS_POR_MES;
}

/**
 * Meses que han pasado desde que se creó la meta. Null si la meta no tiene
 * fecha de creación o si se acaba de crear.
 */
export function mesesTranscurridos(meta, hoy = new Date()) {
  const creada = meta && meta.creadaEn;
  if (!creada) return null;
  const inicio = new Date(creada);
  if (Number.isNaN(inicio.getTime())) return null;
  const meses = (medianoche(hoy).getTime() - medianoche(inicio).getTime()) / MS_POR_DIA / DIAS_POR_MES;
  return meses > 0 ? meses : null;
}

/**
 * Cuánto hay que ahorrar por mes para llegar a la meta a tiempo.
 * "Necesitas $266/mes". Null si no hay fecha límite o si ya venció.
 */
export function ritmoRequerido(meta, hoy = new Date()) {
  const meses = mesesRestantes(meta, hoy);
  if (meses === null || meses <= 0) return null;
  return faltante(meta) / meses;
}

/**
 * Cuánto se está ahorrando por mes realmente. Null si la meta es muy nueva
 * para tener un ritmo medible.
 */
export function ritmoActual(meta, hoy = new Date()) {
  const meses = mesesTranscurridos(meta, hoy);
  if (meses === null) return null;
  return ahorrado(meta) / meses;
}

/**
 * Cuánto falta (o sobra) respecto al ritmo necesario: positivo = vas por
 * detrás, negativo = vas por delante.
 */
export function diferenciaRitmo(meta, hoy = new Date()) {
  const requerido = ritmoRequerido(meta, hoy);
  const actual = ritmoActual(meta, hoy);
  if (requerido === null || actual === null) return null;
  return requerido - actual;
}

/**
 * Estado de la meta:
 *  - completada: ya se alcanzó el objetivo (tiene prioridad sobre el resto,
 *    una meta cumplida no está "en riesgo" aunque su fecha ya haya pasado);
 *  - vencida: se pasó la fecha límite sin cumplirla;
 *  - en_riesgo: el ritmo requerido supera al ritmo real en más del 15%;
 *  - en_buen_dia: va al ritmo (o no tiene fecha límite para medirlo).
 */
export function estadoMeta(meta, hoy = new Date()) {
  if (objetivo(meta) > 0 && ahorrado(meta) >= objetivo(meta)) {
    return ESTADO_COMPLETADA;
  }
  const dias = diasRestantes(meta, hoy);
  if (dias !== null && dias < 0) return ESTADO_VENCIDA;
  const requerido = ritmoRequerido(meta, hoy);
  const actual = ritmoActual(meta, hoy);
  if (requerido !== null && actual !== null && requerido > actual * TOLERANCIA_RIESGO) {
    return ESTADO_EN_RIESGO;
  }
  return ESTADO_EN_BUEN_DIA;
}

/** Etiqueta legible del estado ("En riesgo"). */
export function etiquetaEstado(estado) {
  return ETIQUETAS_ESTADO[estado] || ETIQUETAS_ESTADO[ESTADO_EN_BUEN_DIA];
}

/**
 * Texto del plazo: "vence en 45 días", "vence hoy", "venció hace 3 días".
 * Sin fecha límite devuelve "".
 */
export function etiquetaPlazo(meta, hoy = new Date()) {
  const dias = diasRestantes(meta, hoy);
  if (dias === null) return "";
  if (dias === 0) return "vence hoy";
  if (dias === 1) return "vence mañana";
  if (dias < 0) {
    const pasados = Math.abs(dias);
    return `venció hace ${pasados} ${pasados === 1 ? "día" : "días"}`;
  }
  return `vence en ${dias} días`;
}
