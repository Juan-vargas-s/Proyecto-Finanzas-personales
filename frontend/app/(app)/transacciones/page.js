"use client";

import { useCallback, useEffect, useState } from "react";
import { api, usuarioId } from "../../../lib/api";
import { formatear, useMoneda } from "../../../lib/dinero";
import { aOpciones, estiloCategoria, useCategorias } from "../../../lib/categorias";
import GestionCategorias from "../../../components/GestionCategorias";
import { ModalConfirmacion, useRecuadro } from "../../../components/Modal";
import Selector from "../../../components/Selector";
import AsignarMetaModal from "../../../components/AsignarMetaModal";
import { SelectorFecha, SelectorMes, fechaBonita, mesBonito } from "../../../components/Fechas";
import { EsqueletoTabla } from "../../../components/Esqueleto";
import {
  IconoBuscar,
  IconoEtiqueta,
  IconoMetas,
  IconoTransacciones,
} from "../../../components/Iconos";

function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function mesActual() {
  return hoyISO().slice(0, 7);
}

function formVacio() {
  return {
    tipo: "GASTO",
    monto: "",
    categoria: "",
    fecha: hoyISO(),
    descripcion: "",
  };
}

export default function TransaccionesPage() {
  const uid = usuarioId();
  const moneda = useMoneda();
  const {
    categorias,
    todas,
    cargando: cargandoCategorias,
    recargar: recargarCategoriasBase,
  } = useCategorias();
  const [pestana, setPestana] = useState("movimientos");
  const [mes, setMes] = useState(mesActual());
  const [transacciones, setTransacciones] = useState([]);
  const [presupuestos, setPresupuestos] = useState([]);
  const [estados, setEstados] = useState({});
  const [filtro, setFiltro] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [form, setForm] = useState(formVacio());
  const [editando, setEditando] = useState(null);
  const [formPres, setFormPres] = useState({
    categoria: "",
    limiteMensual: "",
    mes: mesActual(),
  });
  const [editandoPresupuesto, setEditandoPresupuesto] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [porEliminar, setPorEliminar] = useState(null);
  const [porEliminarPresupuesto, setPorEliminarPresupuesto] = useState(null);
  const [asignando, setAsignando] = useState(false);
  const [metas, setMetas] = useState([]);
  const [montoIngreso, setMontoIngreso] = useState(0);
  const [guardandoAsignacion, setGuardandoAsignacion] = useState(false);
  const { recuadro, exito, fallo, aviso, limpiar } = useRecuadro();

  const opcionesGasto = aOpciones(categorias.filter((c) => c.tipo === "GASTO"));
  const opcionesIngreso = aOpciones(categorias.filter((c) => c.tipo === "INGRESO"));
  const opcionesCategoria = (tipo) =>
    tipo === "INGRESO" ? opcionesIngreso : opcionesGasto;

  const cargar = useCallback(async (mesSel) => {
    setCargando(true);
    try {
      const [lista, pres, estadosRes] = await Promise.all([
        api(`/api/transacciones/?mes=${mesSel}`),
        api(`/api/transacciones/presupuestos?mes=${mesSel}`),
        api(`/api/transacciones/presupuestos/estado?mes=${mesSel}`).catch(() => []),
      ]);
      setTransacciones(Array.isArray(lista) ? lista : []);
      const listaPres = Array.isArray(pres) ? pres : [];
      setPresupuestos(listaPres);

      // Una sola llamada trae el estado (gasto acumulado) de todos los presupuestos.
      const mapa = {};
      (Array.isArray(estadosRes) ? estadosRes : []).forEach((e) => {
        if (e && e.categoria) mapa[e.categoria] = e;
      });
      setEstados(mapa);
    } catch (err) {
      fallo("No se pudieron cargar los datos", err.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar(mes);
  }, [mes, cargar]);

  // La búsqueda del topbar llega por la URL (?q=…) o por un evento al navegar
  // dentro de la misma ruta.
  useEffect(() => {
    const inicial = new URLSearchParams(window.location.search).get("q");
    if (inicial) setBusqueda(inicial);

    function alBuscar(e) {
      setBusqueda(e.detail || "");
    }
    window.addEventListener("finanzas:buscar", alBuscar);
    return () => window.removeEventListener("finanzas:buscar", alBuscar);
  }, []);

  function enfocarFormulario(idForm, idCampo) {
    document
      .getElementById(idForm)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    const campo = idCampo
      ? document.querySelector(`#${idCampo} button, #${idCampo}`)
      : null;
    if (campo instanceof HTMLElement) campo.focus({ preventScroll: true });
  }

  function cambiar(campo) {
    return (e) => setForm({ ...form, [campo]: e.target.value });
  }

  function recargarTrasGasto(tipo) {
    // La verificación de presupuestos es automática: Java publica el evento,
    // Go reevalúa y la alerta llega sola por SSE. Aquí solo se avisa.
    if (tipo !== "GASTO") {
      exito("Ingreso registrado", "El movimiento se guardó correctamente.");
      return;
    }
    exito("Gasto registrado", "El movimiento se guardó correctamente.");
  }

  async function enviar(e) {
    e.preventDefault();
    limpiar();
    try {
      const cuerpo = {
        tipo: form.tipo,
        monto: parseFloat(form.monto),
        categoria: form.categoria.trim(),
        fecha: form.fecha,
        descripcion: form.descripcion.trim() || null,
      };
      const url = editando ? `/api/transacciones/${editando}` : "/api/transacciones/";
      const metodo = editando ? "PUT" : "POST";
      await api(url, { method: metodo, body: cuerpo });
      setForm(formVacio());
      setEditando(null);
      if (!editando) {
        recargarTrasGasto(cuerpo.tipo);
      } else {
        exito("Transacción actualizada", "Los cambios se guardaron correctamente.");
      }
      await cargar(mes);
    } catch (err) {
      fallo(editando ? "No se pudo editar" : "No se pudo registrar", err.message);
    }
  }

  function editar(t) {
    setEditando(t.id);
    limpiar();
    setForm({
      tipo: t.tipo,
      monto: String(t.monto),
      categoria: t.categoria,
      fecha: t.fecha,
      descripcion: t.descripcion || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelar() {
    setEditando(null);
    setForm(formVacio());
    limpiar();
  }

  /** Abre el reparto del ingreso entre las metas de ahorro. */
  async function abrirAsignacion() {
    limpiar();
    const monto = parseFloat(form.monto);
    if (!monto || monto <= 0) {
      fallo("Monto inválido", "Ingresa el monto del ingreso que quieres repartir.");
      return;
    }
    if (!form.categoria.trim()) {
      fallo("Falta la categoría", "Elige la categoría del ingreso antes de repartirlo.");
      return;
    }
    try {
      const lista = await api(`/api/metas?usuarioId=${uid}`);
      setMetas(Array.isArray(lista) ? lista : []);
      setMontoIngreso(monto);
      setAsignando(true);
    } catch (err) {
      fallo("No se pudieron cargar las metas", err.message);
    }
  }

  /**
   * Registra el ingreso y reparte el monto entre las metas. Cada reparto es
   * un aporte: genera el evento que Java materializa como transacción AHORRO.
   */
  async function confirmarAsignacion(reparto) {
    setGuardandoAsignacion(true);
    limpiar();
    try {
      await api("/api/transacciones/", {
        method: "POST",
        body: {
          tipo: "INGRESO",
          monto: parseFloat(form.monto),
          categoria: form.categoria.trim(),
          fecha: form.fecha,
          descripcion: form.descripcion.trim() || null,
        },
      });
      for (const parte of reparto) {
        await api(`/api/metas/${parte.id}/aportar`, {
          method: "PUT",
          body: { monto: parte.monto },
        });
      }
      setAsignando(false);
      setForm(formVacio());
      exito(
        "Ingreso asignado",
        `Se registró el ingreso y se repartieron ${reparto.length} aporte(s) a tus metas.`
      );
      await cargar(mes);
    } catch (err) {
      fallo("No se pudo asignar el ingreso", err.message);
    } finally {
      setGuardandoAsignacion(false);
    }
  }

  async function eliminar(id) {
    setPorEliminar(id);
  }

  async function confirmarEliminar() {
    const id = porEliminar;
    setPorEliminar(null);
    limpiar();
    try {
      await api(`/api/transacciones/${id}`, { method: "DELETE" });
      exito("Movimiento eliminado", "El registro se eliminó correctamente.");
      await cargar(mes);
    } catch (err) {
      fallo("No se pudo eliminar", err.message);
    }
  }

  async function guardarPresupuesto(e) {
    e.preventDefault();
    limpiar();
    if (!formPres.categoria) {
      fallo("Falta la categoría", "Elige la categoría del presupuesto.");
      return;
    }
    const limite = parseFloat(formPres.limiteMensual);
    if (!limite || limite <= 0) {
      fallo("Límite inválido", "El límite mensual debe ser mayor a cero.");
      return;
    }
    try {
      const cuerpo = {
        categoria: formPres.categoria,
        limiteMensual: limite,
        mes: formPres.mes,
      };
      if (editandoPresupuesto) {
        await api(`/api/transacciones/presupuestos/${editandoPresupuesto}`, {
          method: "PUT",
          body: cuerpo,
        });
        exito("Presupuesto actualizado", "El límite mensual se guardó.");
      } else {
        await api("/api/transacciones/presupuestos", { method: "POST", body: cuerpo });
        exito("Presupuesto guardado", "El límite mensual de la categoría se guardó.");
      }
      setFormPres({ categoria: "", limiteMensual: "", mes: mes });
      setEditandoPresupuesto(null);
      await cargar(mes);
    } catch (err) {
      fallo(
        editandoPresupuesto
          ? "No se pudo actualizar el presupuesto"
          : "No se pudo guardar el presupuesto",
        err.message
      );
    }
  }

  /** Carga el presupuesto en el formulario para editarlo. */
  function editarPresupuesto(p) {
    limpiar();
    setEditandoPresupuesto(p.id);
    setFormPres({
      categoria: p.categoria,
      limiteMensual: String(p.limiteMensual ?? ""),
      mes: p.mes,
    });
  }

  function cancelarEdicionPresupuesto() {
    limpiar();
    setEditandoPresupuesto(null);
    setFormPres({ categoria: "", limiteMensual: "", mes: mes });
  }

  async function confirmarEliminarPresupuesto() {
    const id = porEliminarPresupuesto;
    setPorEliminarPresupuesto(null);
    limpiar();
    try {
      await api(`/api/transacciones/presupuestos/${id}`, { method: "DELETE" });
      exito("Presupuesto eliminado", "El límite de esa categoría se quitó.");
      if (editandoPresupuesto === id) cancelarEdicionPresupuesto();
      await cargar(mes);
    } catch (err) {
      fallo("No se pudo eliminar el presupuesto", err.message);
    }
  }

  // ---------- Cálculos de la pestaña de presupuestos ----------

  const totalPresupuestado = presupuestos.reduce(
    (suma, p) => suma + Number(p.limiteMensual || 0),
    0
  );
  const totalGastado = presupuestos.reduce((suma, p) => {
    const estado = estados[p.categoria];
    return suma + (estado ? Number(estado.gastoAcumulado || 0) : 0);
  }, 0);
  const totalRestante = totalPresupuestado - totalGastado;
  const porcentajeGlobal =
    totalPresupuestado > 0 ? (totalGastado / totalPresupuestado) * 100 : 0;

  /** Zona de la barra: normal (<80%), alerta (80-99%) o excedido (>=100%). */
  function zonaDe(pct) {
    if (pct >= 100) return "excedido";
    if (pct >= 80) return "alerta";
    return "normal";
  }

  const textoBusqueda = busqueda.trim().toLowerCase();
  const visibles = transacciones.filter((t) => {
    if (filtro && t.tipo !== filtro) return false;
    if (!textoBusqueda) return true;
    return (
      (t.descripcion || "").toLowerCase().includes(textoBusqueda) ||
      (t.categoria || "").toLowerCase().includes(textoBusqueda)
    );
  });

  const dinero = (v) => formatear(v, moneda);

  return (
    <>
      <div className="pagina-titulo">
        <div>
          <h1>Transacciones</h1>
          <p>Ingresos, gastos y presupuestos mensuales por categoría</p>
        </div>
        <div className="control-mes">
          <span>Mes</span>
          <SelectorMes valor={mes} onChange={setMes} />
        </div>
      </div>

      {recuadro}

      <div className="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={pestana === "movimientos"}
          className={`tab ${pestana === "movimientos" ? "activa" : ""}`}
          onClick={() => setPestana("movimientos")}
        >
          <IconoTransacciones size={16} /> Movimientos
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={pestana === "presupuestos"}
          className={`tab ${pestana === "presupuestos" ? "activa" : ""}`}
          onClick={() => setPestana("presupuestos")}
        >
          <IconoMetas size={16} /> Presupuestos
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={pestana === "categorias"}
          className={`tab ${pestana === "categorias" ? "activa" : ""}`}
          onClick={() => setPestana("categorias")}
        >
          <IconoEtiqueta size={16} /> Categorías
        </button>
      </div>

      {pestana === "movimientos" && (
        <>
      <section className="panel">
        <div className="pagina-titulo" style={{ marginBottom: "0.75rem" }}>
          <h2 style={{ margin: 0 }}>Movimientos de {mesBonito(mes)}</h2>
          <div className="control-mes">
            <input
              type="search"
              className="campo-busqueda"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar…"
              aria-label="Buscar en los movimientos del mes"
            />
            <span>Filtrar</span>
            <Selector
              className="selector-estrecho"
              valor={filtro}
              onChange={setFiltro}
              opciones={[
                { valor: "", etiqueta: "Todos" },
                { valor: "INGRESO", etiqueta: "Ingresos" },
                { valor: "GASTO", etiqueta: "Gastos" },
                { valor: "AHORRO", etiqueta: "Ahorros" },
              ]}
            />
          </div>
        </div>

        {cargando ? (
          <EsqueletoTabla />
        ) : visibles.length === 0 ? (
          <div className="vacio-accion">
            <span className="vacio-icono" aria-hidden="true">
              {textoBusqueda ? (
                <IconoBuscar size={28} />
              ) : (
                <IconoTransacciones size={28} />
              )}
            </span>
            <span className="vacio-titulo">
              {textoBusqueda
                ? `Sin resultados para “${busqueda.trim()}”`
                : "No hay movimientos en este mes"}
            </span>
            <p className="vacio-detalle">
              {textoBusqueda
                ? "Prueba con otra palabra o revisa el filtro de tipo."
                : "Registra tu primer movimiento del mes para ver el resumen."}
            </p>
            {textoBusqueda ? (
              <button
                className="btn btn-secundario"
                onClick={() => setBusqueda("")}
              >
                Limpiar búsqueda
              </button>
            ) : (
              <button
                className="btn"
                onClick={() => enfocarFormulario("form-movimiento", "monto")}
              >
                Registrar movimiento
              </button>
            )}
          </div>
        ) : (
          <div className="tabla-wrap">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Categoría</th>
                  <th>Monto</th>
                  <th>Descripción</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((t) => (
                  <tr key={t.id}>
                    <td>{fechaBonita(t.fecha)}</td>
                    <td>
                      <span
                        className={`badge ${
                          t.tipo === "INGRESO"
                            ? "badge-ingreso"
                            : t.tipo === "AHORRO"
                            ? "badge-ahorro"
                            : "badge-gasto"
                        }`}
                      >
                        {t.tipo}
                      </span>
                    </td>
                    <td>
                      <span className="cat-celda">
                        <span
                          className="cat-punto"
                          style={{
                            background:
                              estiloCategoria(todas, t.categoria).color ||
                              "var(--texto-2)",
                          }}
                          aria-hidden="true"
                        />
                        <span style={{ textTransform: "capitalize" }}>
                          {t.categoria}
                        </span>
                      </span>
                    </td>
                    <td
                      className={
                        t.tipo === "INGRESO"
                          ? "positivo"
                          : t.tipo === "AHORRO"
                          ? "ahorro"
                          : "negativo"
                      }
                      style={{ fontWeight: 600 }}
                    >
                      {t.tipo === "INGRESO" ? "+" : t.tipo === "AHORRO" ? "" : "−"}
                      {dinero(t.monto)}
                    </td>
                    <td>{t.descripcion || "—"}</td>
                    <td>
                      <div className="acciones">
                        {t.tipo !== "AHORRO" && (
                          <button
                            className="btn btn-secundario btn-mini"
                            onClick={() => editar(t)}
                          >
                            Editar
                          </button>
                        )}
                        <button
                          className="btn btn-peligro btn-mini"
                          onClick={() => eliminar(t.id)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
          <h2>{editando ? "Editar transacción" : "Registrar transacción"}</h2>
          <form className="formulario" id="form-movimiento" onSubmit={enviar}>
            <div className="fila">
              <div className="campo">
                <label htmlFor="tipo">Tipo</label>
                <Selector
                  id="tipo"
                  valor={form.tipo}
                  onChange={(v) =>
                    // Al cambiar de tipo se limpia la categoría: una categoría
                    // de gasto no es válida como ingreso (y al revés).
                    setForm({ ...form, tipo: v, categoria: "" })
                  }
                  opciones={[
                    { valor: "GASTO", etiqueta: "Gasto" },
                    { valor: "INGRESO", etiqueta: "Ingreso" },
                  ]}
                />
              </div>
              <div className="campo">
                <label htmlFor="monto">Monto</label>
                <input
                  id="monto"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={form.monto}
                  onChange={cambiar("monto")}
                  required
                />
              </div>
            </div>
            <div className="fila">
              <div className="campo">
                <label htmlFor="categoria">Categoría</label>
                <Selector
                  id="categoria"
                  valor={form.categoria}
                  onChange={(v) => setForm({ ...form, categoria: v })}
                  opciones={opcionesCategoria(form.tipo)}
                  placeholder="Elegir categoría"
                />
              </div>
              <div className="campo">
                <label htmlFor="fecha">Fecha</label>
                <SelectorFecha
                  id="fecha"
                  valor={form.fecha}
                  onChange={(v) => setForm({ ...form, fecha: v })}
                  max={hoyISO()}
                />
              </div>
            </div>
            <div className="campo">
              <label htmlFor="descripcion">Descripción (opcional)</label>
              <input
                id="descripcion"
                type="text"
                placeholder="Nota sobre el movimiento"
                value={form.descripcion}
                onChange={cambiar("descripcion")}
              />
            </div>
            <div className="fila">
              <button className="btn" type="submit">
                {editando ? "Guardar cambios" : "Registrar"}
              </button>
              {!editando && form.tipo === "INGRESO" && (
                <button
                  className="btn btn-exito"
                  type="button"
                  onClick={abrirAsignacion}
                >
                  <IconoMetas size={16} /> Asignar a meta
                </button>
              )}
              {editando && (
                <button
                  className="btn btn-secundario"
                  type="button"
                  onClick={cancelar}
                >
                  Cancelar
                </button>
              )}
            </div>
            {!editando && form.tipo === "INGRESO" && (
              <p className="form-nota">
                “Asignar a meta” registra el ingreso y reparte el monto entre tus
                metas de ahorro: el dinero deja de ser un cubo aislado.
              </p>
            )}
          </form>
        </section>
        </>
      )}

      {pestana === "presupuestos" && (
        <>
      <section className="panel">
        <div className="pagina-titulo" style={{ marginBottom: "0.75rem" }}>
          <h2 style={{ margin: 0 }}>Presupuestos de {mesBonito(mes)}</h2>
          <span className="control-mes">
            <span className="etiqueta-suave">
              {presupuestos.length} categoría(s) con límite
            </span>
          </span>
        </div>

        <div className="kpi-strip">
          <div className="kpi-item">
            <span className="kpi-etiqueta">Presupuestado</span>
            <span className="kpi-valor">{dinero(totalPresupuestado)}</span>
          </div>
          <div className="kpi-item">
            <span className="kpi-etiqueta">Gastado</span>
            <span className="kpi-valor">{dinero(totalGastado)}</span>
          </div>
          <div className="kpi-item">
            <span className="kpi-etiqueta">Restante</span>
            <span
              className={`kpi-valor ${
                totalRestante < 0 ? "negativo" : "positivo"
              }`}
            >
              {dinero(totalRestante)}
            </span>
          </div>
          <div className="kpi-item">
            <span className="kpi-etiqueta">% de ejecución global</span>
            <span
              className={`kpi-valor ${
                zonaDe(porcentajeGlobal) === "excedido"
                  ? "negativo"
                  : zonaDe(porcentajeGlobal) === "alerta"
                  ? "alerta-valor"
                  : ""
              }`}
            >
              {porcentajeGlobal.toFixed(1)}%
            </span>
          </div>
        </div>

        {cargando ? (
          <EsqueletoTabla filas={3} />
        ) : presupuestos.length === 0 ? (
          <div className="vacio-accion">
            <span className="vacio-icono" aria-hidden="true">
              <IconoMetas size={28} />
            </span>
            <span className="vacio-titulo">
              Sin presupuestos para este mes
            </span>
            <p className="vacio-detalle">
              Define un límite por categoría y recibe avisos automáticos al 80%
              y al excederlo.
            </p>
            <button
              className="btn"
              onClick={() => enfocarFormulario("form-presupuesto", "cat-pres")}
            >
              Crear presupuesto
            </button>
          </div>
        ) : (
          <div className="presupuestos-lista">
            {presupuestos.map((p) => {
              const estado = estados[p.categoria];
              const gastado = estado ? Number(estado.gastoAcumulado || 0) : 0;
              const limite = Number(p.limiteMensual || 0);
              const porcentaje = estado ? Number(estado.porcentajeUsado || 0) : 0;
              const restante = estado
                ? Number(estado.restante ?? limite - gastado)
                : limite - gastado;
              const zona = zonaDe(porcentaje);
              const cat = estiloCategoria(todas, p.categoria);
              return (
                <article key={p.id} className={`presupuesto-card ${zona}`}>
                  <div className="presupuesto-cabecera">
                    <span className="presupuesto-cat">
                      <span
                        className="cat-punto"
                        style={{ background: cat.color || "var(--texto-2)" }}
                        aria-hidden="true"
                      />
                      <span style={{ textTransform: "capitalize" }}>
                        {p.categoria}
                      </span>
                    </span>
                    <span className={`presupuesto-pct ${zona}`}>
                      {porcentaje.toFixed(1)}%
                    </span>
                  </div>

                  <div className={`barra-pista ${zona}`}>
                    <i style={{ width: `${Math.min(porcentaje, 100)}%` }}></i>
                    <span className="marca-80" title="80% del límite"></span>
                  </div>

                  <div className="presupuesto-pie">
                    <span>
                      {dinero(gastado)} de {dinero(limite)}
                    </span>
                    <span className={restante < 0 ? "negativo" : "restante-ok"}>
                      {restante < 0
                        ? `Te pasaste por ${dinero(Math.abs(restante))}`
                        : `Restante ${dinero(restante)}`}
                    </span>
                  </div>

                  <div className="acciones">
                    <button
                      type="button"
                      className="btn btn-secundario btn-mini"
                      onClick={() => editarPresupuesto(p)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="btn btn-peligro btn-mini"
                      onClick={() => setPorEliminarPresupuesto(p.id)}
                    >
                      Eliminar
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel">
        <h2>
          {editandoPresupuesto
            ? "Editar presupuesto"
            : `Nuevo presupuesto para ${mesBonito(mes)}`}
        </h2>
          <form className="formulario" id="form-presupuesto" onSubmit={guardarPresupuesto}>
          <div className="fila">
            <div className="campo">
              <label htmlFor="cat-pres">Categoría</label>
              <Selector
                id="cat-pres"
                valor={formPres.categoria}
                onChange={(v) => setFormPres({ ...formPres, categoria: v })}
                opciones={opcionesGasto}
                placeholder="Elegir categoría"
              />
            </div>
            <div className="campo">
              <label htmlFor="limite">Límite mensual</label>
              <input
                id="limite"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="1500.00"
                value={formPres.limiteMensual}
                onChange={(e) =>
                  setFormPres({ ...formPres, limiteMensual: e.target.value })
                }
                required
              />
            </div>
          </div>
          <div className="campo">
            <label htmlFor="mes-pres">Mes</label>
            <SelectorMes
              id="mes-pres"
              valor={formPres.mes}
              onChange={(v) => setFormPres({ ...formPres, mes: v })}
            />
          </div>
          <div className="fila">
            <button className="btn" type="submit">
              {editandoPresupuesto ? "Guardar cambios" : "Guardar presupuesto"}
            </button>
            {editandoPresupuesto && (
              <button
                type="button"
                className="btn btn-secundario"
                onClick={cancelarEdicionPresupuesto}
              >
                Cancelar
              </button>
            )}
          </div>
          <p className="form-nota">
            Cuando llegues al 80% del límite (o lo excedas) recibes un aviso
            automático: no hace falta que verifiques nada a mano.
          </p>
        </form>
      </section>
        </>
      )}

      {pestana === "categorias" && (
        <section className="panel">
          <GestionCategorias
            categorias={todas}
            cargando={cargandoCategorias}
            onRecargar={async () => {
              await recargarCategoriasBase();
              await cargar(mes);
            }}
            onExito={exito}
          />
        </section>
      )}

      <AsignarMetaModal
        visible={asignando}
        total={montoIngreso}
        metas={metas}
        guardando={guardandoAsignacion}
        onCerrar={() => setAsignando(false)}
        onAsignar={confirmarAsignacion}
      />

      <ModalConfirmacion
        visible={porEliminar !== null}
        titulo="Eliminar transacción"
        mensaje="Esta acción no se puede deshacer. ¿Deseas eliminar el movimiento seleccionado?"
        textoConfirmar="Sí, eliminar"
        onConfirmar={confirmarEliminar}
        onCancelar={() => setPorEliminar(null)}
      />

      <ModalConfirmacion
        visible={porEliminarPresupuesto !== null}
        titulo="Eliminar presupuesto"
        mensaje="Se quitará el límite mensual de esa categoría. ¿Deseas continuar?"
        textoConfirmar="Sí, eliminar"
        onConfirmar={confirmarEliminarPresupuesto}
        onCancelar={() => setPorEliminarPresupuesto(null)}
      />
    </>
  );
}
