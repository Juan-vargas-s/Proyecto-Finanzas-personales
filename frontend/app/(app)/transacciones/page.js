"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "../../../lib/api";
import { formatear } from "../../../lib/dinero";
import { ModalConfirmacion, useRecuadro } from "../../../components/Modal";
import Selector from "../../../components/Selector";
import { SelectorFecha, SelectorMes, fechaBonita, mesBonito } from "../../../components/Fechas";

const CATEGORIAS = [
  "comida",
  "transporte",
  "entretenimiento",
  "vivienda",
  "servicios",
  "salud",
  "educacion",
  "ropa",
  "salario",
  "freelance",
  "otros",
];

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

const dinero = (v) => formatear(v);

export default function TransaccionesPage() {
  const [mes, setMes] = useState(mesActual());
  const [transacciones, setTransacciones] = useState([]);
  const [presupuestos, setPresupuestos] = useState([]);
  const [estados, setEstados] = useState({});
  const [filtro, setFiltro] = useState("");
  const [form, setForm] = useState(formVacio());
  const [editando, setEditando] = useState(null);
  const [formPres, setFormPres] = useState({
    categoria: "",
    limiteMensual: "",
    mes: mesActual(),
  });
  const [cargando, setCargando] = useState(true);
  const [porEliminar, setPorEliminar] = useState(null);
  const { recuadro, exito, fallo, aviso, limpiar } = useRecuadro();

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

  function cambiar(campo) {
    return (e) => setForm({ ...form, [campo]: e.target.value });
  }

  function recargarTrasGasto(tipo) {
    if (tipo !== "GASTO") {
      exito("Ingreso registrado", "El movimiento se guardó correctamente.");
      return;
    }
    api("/api/metas/verificar", { method: "POST" })
      .then((r) => {
        if (r && r.alertasGeneradas > 0) {
          aviso(
            "Alertas de presupuesto",
            `Se generaron ${r.alertasGeneradas} alerta(s) de presupuesto al 80% o más. Revisa la campana 🔔.`
          );
        } else {
          exito("Gasto registrado", "Ningún presupuesto superó el 80%.");
        }
      })
      .catch(() => exito("Gasto registrado", "El movimiento se guardó correctamente."));
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
    try {
      await api("/api/transacciones/presupuestos", {
        method: "POST",
        body: {
          categoria: formPres.categoria.trim(),
          limiteMensual: parseFloat(formPres.limiteMensual),
          mes: formPres.mes,
        },
      });
      setFormPres({ categoria: "", limiteMensual: "", mes: mes });
      await cargar(mes);
      exito("Presupuesto guardado", "El límite mensual de la categoría se guardó.");
    } catch (err) {
      fallo("No se pudo guardar el presupuesto", err.message);
    }
  }

  const visibles = transacciones.filter((t) => !filtro || t.tipo === filtro);

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

      <section className="panel">
        <div className="pagina-titulo" style={{ marginBottom: "0.75rem" }}>
          <h2 style={{ margin: 0 }}>Movimientos de {mesBonito(mes)}</h2>
          <div className="control-mes">
            <span>Filtrar</span>
            <Selector
              className="selector-estrecho"
              valor={filtro}
              onChange={setFiltro}
              opciones={[
                { valor: "", etiqueta: "Todos" },
                { valor: "INGRESO", etiqueta: "Ingresos" },
                { valor: "GASTO", etiqueta: "Gastos" },
              ]}
            />
          </div>
        </div>

        {cargando ? (
          <p className="vacio">Cargando…</p>
        ) : visibles.length === 0 ? (
          <p className="vacio">No hay movimientos en este mes</p>
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
                          t.tipo === "INGRESO" ? "badge-ingreso" : "badge-gasto"
                        }`}
                      >
                        {t.tipo}
                      </span>
                    </td>
                    <td style={{ textTransform: "capitalize" }}>{t.categoria}</td>
                    <td
                      className={t.tipo === "INGRESO" ? "positivo" : "negativo"}
                      style={{ fontWeight: 600 }}
                    >
                      {t.tipo === "INGRESO" ? "+" : "−"}
                      {dinero(t.monto)}
                    </td>
                    <td>{t.descripcion || "—"}</td>
                    <td>
                      <div className="acciones">
                        <button
                          className="btn btn-secundario btn-mini"
                          onClick={() => editar(t)}
                        >
                          Editar
                        </button>
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

      <div className="grid-2">
        <section className="panel">
          <h2>{editando ? "Editar transacción" : "Registrar transacción"}</h2>
          <form className="formulario" onSubmit={enviar}>
            <div className="fila">
              <div className="campo">
                <label htmlFor="tipo">Tipo</label>
                <Selector
                  id="tipo"
                  valor={form.tipo}
                  onChange={(v) => setForm({ ...form, tipo: v })}
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
                <input
                  id="categoria"
                  list="lista-categorias"
                  placeholder="comida"
                  value={form.categoria}
                  onChange={cambiar("categoria")}
                  required
                />
                <datalist id="lista-categorias">
                  {CATEGORIAS.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
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
          </form>
        </section>

        <section className="panel">
          <h2>Presupuestos de {mesBonito(mes)}</h2>
          <form className="formulario" onSubmit={guardarPresupuesto}>
            <div className="fila">
              <div className="campo">
                <label htmlFor="cat-pres">Categoría</label>
                <input
                  id="cat-pres"
                  list="lista-categorias"
                  placeholder="comida"
                  value={formPres.categoria}
                  onChange={(e) =>
                    setFormPres({ ...formPres, categoria: e.target.value })
                  }
                  required
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
            <button className="btn" type="submit">
              Guardar presupuesto
            </button>
          </form>

          <div style={{ marginTop: "1.25rem" }}>
            {presupuestos.length === 0 ? (
              <p className="vacio">Sin presupuestos para este mes</p>
            ) : (
              presupuestos.map((p) => {
                const estado = estados[p.categoria];
                const gastado = estado ? Number(estado.gastoAcumulado) : 0;
                const limite = Number(p.limiteMensual);
                const porcentaje = estado ? Number(estado.porcentajeUsado) : 0;
                const clase =
                  porcentaje >= 80 ? "barra alerta" : "barra";
                return (
                  <div key={p.id} style={{ marginBottom: "1rem" }}>
                    <div className="progreso-dato" style={{ marginBottom: "0.25rem" }}>
                      <span style={{ textTransform: "capitalize", color: "#e6edf7" }}>
                        {p.categoria}
                      </span>
                      <span>
                        {dinero(gastado)} / {dinero(limite)} ({porcentaje.toFixed(1)}%)
                      </span>
                    </div>
                    <div className={clase}>
                      <i style={{ width: `${Math.min(porcentaje, 100)}%` }}></i>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      <ModalConfirmacion
        visible={porEliminar !== null}
        titulo="Eliminar transacción"
        mensaje="Esta acción no se puede deshacer. ¿Deseas eliminar el movimiento seleccionado?"
        textoConfirmar="Sí, eliminar"
        onConfirmar={confirmarEliminar}
        onCancelar={() => setPorEliminar(null)}
      />
    </>
  );
}
