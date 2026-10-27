"use client";

import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import Selector from "./Selector";
import { SelectorFecha } from "./Fechas";
import { IconoEditar } from "./Iconos";
import { aOpciones } from "../lib/categorias";
import { api } from "../lib/api";
import {
  hoyISO,
  mensajeAmigableTransaccion,
  validarTransaccion,
} from "../lib/transaccionValidador";

const FORM_VACIO = {
  tipo: "GASTO",
  monto: "",
  categoria: "",
  fecha: "",
  descripcion: "",
};

export default function EditarTransaccionModal({
  visible,
  onCerrar,
  onExito,
  transaccion,
  categorias = [],
}) {
  const [form, setForm] = useState(FORM_VACIO);
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (visible && transaccion) {
      setForm({
        tipo: transaccion.tipo,
        monto: String(transaccion.monto),
        categoria: transaccion.categoria,
        fecha: transaccion.fecha,
        descripcion: transaccion.descripcion || "",
      });
      setErrores({});
      setErrorGeneral("");
      setGuardando(false);
    }
  }, [visible, transaccion]);

  const opcionesGasto = aOpciones(categorias.filter((c) => c.tipo === "GASTO"));
  const opcionesIngreso = aOpciones(categorias.filter((c) => c.tipo === "INGRESO"));
  const opciones = form.tipo === "INGRESO" ? opcionesIngreso : opcionesGasto;

  async function enviar(e) {
    e.preventDefault();
    setErrores({});
    setErrorGeneral("");
    const v = validarTransaccion(form);
    if (Object.keys(v).length > 0) {
      setErrores(v);
      return;
    }
    if (!transaccion?.id) return;
    setGuardando(true);
    try {
      const cuerpo = {
        tipo: form.tipo,
        monto: parseFloat(form.monto),
        categoria: form.categoria,
        fecha: form.fecha,
        descripcion: form.descripcion?.trim() || undefined,
      };
      await api(`/api/transacciones/${transaccion.id}`, { method: "PUT", body: cuerpo });
      onExito?.("Movimiento actualizado", "Los cambios se guardaron correctamente.");
      onCerrar?.();
    } catch (err) {
      setErrorGeneral(mensajeAmigableTransaccion(err));
    } finally {
      setGuardando(false);
    }
  }

  function cambiarTipo(tipo) {
    setForm((f) => ({ ...f, tipo, categoria: "" }));
    setErrores((e) => ({ ...e, tipo: undefined, categoria: undefined }));
  }

  return (
    <Modal
      visible={visible}
      titulo="Editar movimiento"
      icono={<IconoEditar size={24} />}
      tipo="info"
      ancho="560px"
      onCerrar={guardando ? undefined : onCerrar}
      acciones={
        <>
          <button
            type="button"
            className="btn btn-secundario"
            onClick={onCerrar}
            disabled={guardando}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="form-editar-transaccion"
            className="btn"
            disabled={guardando}
          >
            {guardando ? "Guardando..." : "Guardar cambios"}
          </button>
        </>
      }
    >
      <form
        id="form-editar-transaccion"
        className="formulario"
        onSubmit={enviar}
        noValidate
      >
        {errorGeneral && <div className="alerta alerta-error">{errorGeneral}</div>}
        <div className="campo">
          <label>Tipo</label>
          <div className="segmento">
            <button
              type="button"
              className={form.tipo === "GASTO" ? "activo" : ""}
              onClick={() => cambiarTipo("GASTO")}
            >
              Gasto
            </button>
            <button
              type="button"
              className={form.tipo === "INGRESO" ? "activo" : ""}
              onClick={() => cambiarTipo("INGRESO")}
            >
              Ingreso
            </button>
          </div>
          {errores.tipo && <span className="error-campo">{errores.tipo}</span>}
        </div>
        <div className="fila">
          <div className="campo">
            <label htmlFor="editar-monto">Monto</label>
            <input
              id="editar-monto"
              type="number"
              step="0.01"
              min="0.01"
              inputMode="decimal"
              value={form.monto}
              onChange={(e) => setForm({ ...form, monto: e.target.value })}
              placeholder="0.00"
            />
            {errores.monto && <span className="error-campo">{errores.monto}</span>}
          </div>
          <div className="campo">
            <label htmlFor="editar-fecha">Fecha</label>
            <SelectorFecha
              id="editar-fecha"
              valor={form.fecha}
              onChange={(v) => setForm({ ...form, fecha: v })}
              max={hoyISO()}
            />
            {errores.fecha && <span className="error-campo">{errores.fecha}</span>}
          </div>
        </div>
        <div className="campo">
          <label htmlFor="editar-categoria">Categoría</label>
          <Selector
            id="editar-categoria"
            valor={form.categoria}
            onChange={(v) => setForm({ ...form, categoria: v })}
            opciones={opciones}
            placeholder="Seleccionar categoría"
          />
          {errores.categoria && (
            <span className="error-campo">{errores.categoria}</span>
          )}
        </div>
        <div className="campo">
          <label htmlFor="editar-desc">Descripción (opcional)</label>
          <input
            id="editar-desc"
            type="text"
            value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            placeholder="Notas..."
          />
        </div>
      </form>
    </Modal>
  );
}
