"use client";

import { useState } from "react";
import { Modal } from "./Modal";
import Selector from "./Selector";
import { IconoEditar, IconoEtiqueta, IconoMas } from "./Iconos";
import { actualizarCategoria, crearCategoria } from "../lib/categorias";

const FORM_VACIO = {
  nombre: "",
  tipo: "GASTO",
  color: "#38bdf8",
};

const GRUPOS = [
  { tipo: "GASTO", titulo: "Gastos" },
  { tipo: "INGRESO", titulo: "Ingresos" },
  { tipo: "AHORRO", titulo: "Ahorro interno" },
];

const TIPOS = [
  { valor: "GASTO", etiqueta: "Gasto" },
  { valor: "INGRESO", etiqueta: "Ingreso" },
];

const NOMBRE_TIPO = {
  GASTO: "Gasto",
  INGRESO: "Ingreso",
  AHORRO: "Ahorro",
};

export default function GestionCategorias({
  categorias,
  cargando,
  onRecargar,
  onExito,
}) {
  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  function abrirCrear(tipo = "GASTO") {
    setEditando(null);
    setForm({ ...FORM_VACIO, tipo });
    setError("");
    setAbierto(true);
  }

  function abrirEditar(categoria) {
    setEditando(categoria);
    setForm({
      nombre: categoria.nombre,
      tipo: categoria.tipo,
      color: categoria.color || "#38bdf8",
    });
    setError("");
    setAbierto(true);
  }

  async function guardar() {
    setError("");
    setGuardando(true);
    try {
      const datos = {
        nombre: form.nombre.trim(),
        tipo: form.tipo,
        color: form.color,
      };
      if (editando) {
        await actualizarCategoria(editando.id, datos);
      } else {
        await crearCategoria(datos);
      }
      setAbierto(false);
      await onRecargar?.();
      onExito?.(
        editando ? "Categoría actualizada" : "Categoría creada",
        editando
          ? "Los cambios se guardaron correctamente."
          : "Ya puedes usarla en tus movimientos."
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <div className="gestor-cabecera">
        <div>
          <h2>Categorías</h2>
          <p className="gestor-ayuda">
            Cada cuenta tiene su propio catálogo. Renombrar una categoría
            actualiza también sus movimientos y presupuestos.
          </p>
        </div>
        <button type="button" className="btn" onClick={() => abrirCrear()}>
          <IconoMas size={16} /> Nueva categoría
        </button>
      </div>

      {cargando ? (
        <p className="vacio">Cargando categorías…</p>
      ) : categorias.length === 0 ? (
        <p className="vacio">Todavía no tienes categorías.</p>
      ) : (
        GRUPOS.map((grupo) => {
          const lista = categorias.filter((c) => c.tipo === grupo.tipo);
          if (lista.length === 0) return null;
          return (
            <div className="gestor-grupo" key={grupo.tipo}>
              <h3 className="gestor-grupo-titulo">
                {grupo.titulo}
                <span>{lista.length}</span>
              </h3>
              <div className="gestor-lista">
                {lista.map((c) => {
                  const reservada = c.reservada || c.tipo === "AHORRO";
                  return (
                    <article className="gestor-item" key={c.id}>
                      <span
                        className="gestor-punto"
                        style={{ background: c.color || "var(--texto-2)" }}
                        aria-hidden="true"
                      />
                      <span className="gestor-nombre">{c.nombre}</span>
                      <span className={`badge badge-${c.tipo.toLowerCase()}`}>
                        {NOMBRE_TIPO[c.tipo] || c.tipo}
                      </span>
                      {reservada ? (
                        <span className="gestor-reservada">Reservada</span>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-secundario btn-mini"
                          onClick={() => abrirEditar(c)}
                          aria-label={`Editar ${c.nombre}`}
                        >
                          <IconoEditar size={14} /> Editar
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      <Modal
        visible={abierto}
        titulo={editando ? "Editar categoría" : "Nueva categoría"}
        icono={<IconoEtiqueta size={24} />}
        tipo="info"
        ancho="480px"
        onCerrar={() => setAbierto(false)}
        acciones={
          <>
            <button
              type="button"
              className="btn btn-secundario"
              onClick={() => setAbierto(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn"
              onClick={guardar}
              disabled={guardando || !form.nombre.trim()}
            >
              {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Crear"}
            </button>
          </>
        }
      >
        <form
          className="formulario"
          onSubmit={(e) => {
            e.preventDefault();
            guardar();
          }}
        >
          {error && <div className="alerta alerta-error">{error}</div>}
          <div className="campo">
            <label htmlFor="cat-nombre">Nombre</label>
            <input
              id="cat-nombre"
              type="text"
              maxLength={40}
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Mascotas"
              autoFocus
            />
          </div>
          <div className="fila">
            <div className="campo">
              <label htmlFor="cat-tipo">Tipo</label>
              <Selector
                id="cat-tipo"
                valor={form.tipo}
                onChange={(v) => setForm({ ...form, tipo: v })}
                opciones={TIPOS}
                placeholder="Elegir tipo"
              />
            </div>
            <div className="campo">
              <label htmlFor="cat-color">Color</label>
              <div className="campo-color">
                <input
                  id="cat-color"
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                />
                <code>{form.color}</code>
              </div>
            </div>
          </div>
          {editando && (
            <p className="form-nota">
              Si la categoría ya tiene movimientos no podrás cambiar su tipo.
            </p>
          )}
          <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
        </form>
      </Modal>
    </>
  );
}
