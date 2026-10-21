"use client";

import { useCallback, useEffect, useState } from "react";
import { api, usuarioId } from "../../../lib/api";
import { formatear } from "../../../lib/dinero";
import { ModalConfirmacion, useRecuadro } from "../../../components/Modal";
import { SelectorFecha, fechaBonita } from "../../../components/Fechas";

const dinero = (v) => formatear(v);

export default function MetasPage() {
  const uid = usuarioId();
  const [metas, setMetas] = useState([]);
  const [form, setForm] = useState({ nombre: "", montoObjetivo: "", fechaLimite: "" });
  const [aportes, setAportes] = useState({});
  const [cargando, setCargando] = useState(true);
  const [porEliminar, setPorEliminar] = useState(null);
  const { recuadro, exito, fallo, aviso, limpiar } = useRecuadro();

  const cargar = useCallback(async () => {
    if (!uid) return;
    setCargando(true);
    try {
      const datos = await api(`/api/metas?usuarioId=${uid}`);
      setMetas(Array.isArray(datos) ? datos : []);
    } catch (err) {
      fallo("No se pudieron cargar las metas", err.message);
    } finally {
      setCargando(false);
    }
  }, [uid]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function crear(e) {
    e.preventDefault();
    limpiar();
    if (!form.fechaLimite) {
      fallo("Falta la fecha límite", "Selecciona la fecha límite de la meta.");
      return;
    }
    try {
      await api("/api/metas", {
        method: "POST",
        body: {
          nombre: form.nombre.trim(),
          montoObjetivo: parseFloat(form.montoObjetivo),
          fechaLimite: form.fechaLimite,
        },
      });
      setForm({ nombre: "", montoObjetivo: "", fechaLimite: "" });
      exito("Meta creada", "La nueva meta se guardó correctamente.");
      await cargar();
    } catch (err) {
      fallo("No se pudo crear la meta", err.message);
    }
  }

  async function aportar(id) {
    const monto = parseFloat(aportes[id] || "0");
    if (!monto || monto <= 0) {
      fallo("Monto inválido", "Ingresa un monto válido para el aporte.");
      return;
    }
    limpiar();
    try {
      const meta = await api(`/api/metas/${id}/aportar`, {
        method: "PUT",
        body: { monto },
      });
      setAportes({ ...aportes, [id]: "" });
      if (meta && meta.completada) {
        exito("¡Meta cumplida!", `¡Felicidades, lograste: ${meta.nombre}! 🏆`);
      } else {
        exito("Aporte registrado", "El monto se sumó a tu meta de ahorro.");
      }
      await cargar();
    } catch (err) {
      fallo("No se pudo registrar el aporte", err.message);
    }
  }

  function eliminar(id) {
    setPorEliminar(id);
  }

  async function confirmarEliminar() {
    const id = porEliminar;
    setPorEliminar(null);
    limpiar();
    try {
      await api(`/api/metas/${id}`, { method: "DELETE" });
      exito("Meta eliminada", "La meta y sus aportes se eliminaron correctamente.");
      await cargar();
    } catch (err) {
      fallo("No se pudo eliminar la meta", err.message);
    }
  }

  async function verificar() {
    limpiar();
    try {
      const r = await api("/api/metas/verificar", { method: "POST" });
      if (r && r.alertasGeneradas > 0) {
        aviso(
          "Alertas de presupuesto",
          `${r.alertasGeneradas} alerta(s) de presupuesto generadas. Revisa la campana 🔔.`
        );
      } else {
        exito("Verificación completa", "Ningún presupuesto superó el 80%.");
      }
    } catch (err) {
      fallo("No se pudo verificar", err.message);
    }
  }

  return (
    <>
      <div className="pagina-titulo">
        <div>
          <h1>Metas de ahorro</h1>
          <p>Define metas, aporta y recibe alertas de presupuesto (≥80%)</p>
        </div>
        <button className="btn btn-secundario" onClick={verificar}>
          🔎 Verificar presupuestos
        </button>
      </div>

      {recuadro}

      <div className="grid-2">
        <section className="panel">
          <h2>Nueva meta</h2>
          <form className="formulario" onSubmit={crear}>
            <div className="campo">
              <label htmlFor="nombre">Nombre</label>
              <input
                id="nombre"
                type="text"
                placeholder="Viaje a Japón"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                required
                autoFocus
              />
            </div>
            <div className="fila">
              <div className="campo">
                <label htmlFor="objetivo">Monto objetivo</label>
                <input
                  id="objetivo"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="5000.00"
                  value={form.montoObjetivo}
                  onChange={(e) =>
                    setForm({ ...form, montoObjetivo: e.target.value })
                  }
                  required
                />
              </div>
              <div className="campo">
                <label htmlFor="limite">Fecha límite</label>
                <SelectorFecha
                  id="limite"
                  valor={form.fechaLimite}
                  onChange={(v) => setForm({ ...form, fechaLimite: v })}
                />
              </div>
            </div>
            <button className="btn" type="submit">
              Crear meta
            </button>
          </form>
        </section>

        <section className="panel">
          <h2>Mis metas ({metas.length})</h2>
          {cargando ? (
            <p className="vacio">Cargando…</p>
          ) : metas.length === 0 ? (
            <p className="vacio">
              Aún no tienes metas. Crea la primera en el formulario
            </p>
          ) : (
            <div className="metas-grid" style={{ gridTemplateColumns: "1fr" }}>
              {metas.map((m) => {
                const clase = m.completada
                  ? "barra lista"
                  : m.porcentaje >= 80
                  ? "barra alerta"
                  : "barra";
                return (
                  <article className="meta-card" key={m.id}>
                    <header>
                      <div>
                        <strong>{m.nombre}</strong>
                        <div className="fecha">
                          Fecha límite: {fechaBonita(m.fechaLimite)}
                        </div>
                      </div>
                      <button
                        className="btn btn-peligro btn-mini"
                        onClick={() => eliminar(m.id)}
                      >
                        Eliminar
                      </button>
                    </header>

                    <div className={clase}>
                      <i style={{ width: `${Math.min(m.porcentaje, 100)}%` }}></i>
                    </div>
                    <div className="progreso-dato">
                      <span>
                        {dinero(m.montoActual)} de {dinero(m.montoObjetivo)}
                      </span>
                      <span>
                        {m.porcentaje}% {m.completada ? "· ¡Completada!" : ""}
                      </span>
                    </div>

                    <div className="aportar-fila">
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="Monto a aportar"
                        value={aportes[m.id] || ""}
                        onChange={(e) =>
                          setAportes({ ...aportes, [m.id]: e.target.value })
                        }
                      />
                      <button className="btn btn-exito" onClick={() => aportar(m.id)}>
                        Aportar
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <ModalConfirmacion
        visible={porEliminar !== null}
        titulo="Eliminar meta"
        mensaje="Se eliminarán también los aportes realizados. Esta acción no se puede deshacer. ¿Deseas continuar?"
        textoConfirmar="Sí, eliminar"
        onConfirmar={confirmarEliminar}
        onCancelar={() => setPorEliminar(null)}
      />
    </>
  );
}
