"use client";

import { useCallback, useEffect, useState } from "react";
import { api, usuarioId } from "../../../lib/api";

const dinero = (v) =>
  `$${Number(v || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function fechaBonita(cadena) {
  try {
    return new Date(`${cadena}T00:00:00`).toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return cadena;
  }
}

export default function MetasPage() {
  const uid = usuarioId();
  const [metas, setMetas] = useState([]);
  const [form, setForm] = useState({ nombre: "", montoObjetivo: "", fechaLimite: "" });
  const [aportes, setAportes] = useState({});
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    if (!uid) return;
    setCargando(true);
    setError("");
    try {
      const datos = await api(`/api/metas?usuarioId=${uid}`);
      setMetas(Array.isArray(datos) ? datos : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, [uid]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function crear(e) {
    e.preventDefault();
    setError("");
    setAviso("");
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
      setAviso("✓ Meta creada.");
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function aportar(id) {
    const monto = parseFloat(aportes[id] || "0");
    if (!monto || monto <= 0) {
      setError("Ingresa un monto válido para el aporte");
      return;
    }
    setError("");
    setAviso("");
    try {
      const meta = await api(`/api/metas/${id}/aportar`, {
        method: "PUT",
        body: { monto },
      });
      setAportes({ ...aportes, [id]: "" });
      if (meta && meta.completada) {
        setAviso(`🏆 ¡Meta cumplida: ${meta.nombre}!`);
      }
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function eliminar(id) {
    if (!window.confirm("¿Eliminar esta meta?")) return;
    setError("");
    try {
      await api(`/api/metas/${id}`, { method: "DELETE" });
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function verificar() {
    setError("");
    setAviso("");
    try {
      const r = await api("/api/metas/verificar", { method: "POST" });
      if (r && r.alertasGeneradas > 0) {
        setAviso(
          `⚠️ ${r.alertasGeneradas} alerta(s) de presupuesto generadas. Revisa la campana 🔔.`
        );
      } else {
        setAviso("✓ Verificación completa: ningún presupuesto superó el 80%.");
      }
    } catch (err) {
      setError(err.message);
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

      {error && <div className="alerta alerta-error">{error}</div>}
      {aviso && <div className="alerta alerta-aviso">{aviso}</div>}

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
                <input
                  id="limite"
                  type="date"
                  value={form.fechaLimite}
                  onChange={(e) => setForm({ ...form, fechaLimite: e.target.value })}
                  required
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
    </>
  );
}
