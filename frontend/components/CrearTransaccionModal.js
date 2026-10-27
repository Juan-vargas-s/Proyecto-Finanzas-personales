"use client";

import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import Selector from "./Selector";
import { SelectorFecha } from "./Fechas";
import { IconoIngreso, IconoMetas } from "./Iconos";
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

export default function CrearTransaccionModal({
  visible,
  onCerrar,
  onExito,
  onAsignarMeta,
  categorias = [],
}) {
  const [form, setForm] = useState({ ...FORM_VACIO, fecha: hoyISO() });
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (visible) {
      setForm({ ...FORM_VACIO, fecha: hoyISO() });
      setErrores({});
      setErrorGeneral("");
      setGuardando(false);
    }
  }, [visible]);

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
    setGuardando(true);
    try {
      const cuerpo = {
        tipo: form.tipo,
        monto: parseFloat(form.monto),
        categoria: form.categoria,
        fecha: form.fecha,
        descripcion: form.descripcion?.trim() || undefined,
      };
      await api("/api/transacciones/", { method: "POST", body: cuerpo });
      onExito?.(
        form.tipo === "INGRESO" ? "Ingreso registrado" : "Gasto registrado",
        "El movimiento se guardó correctamente."
      );
      onCerrar?.();
    } catch (err) {
      setErrorGeneral(mensajeAmigableTransaccion(err));
    } finally {
      setGuardando(false);
    }
  }

  function manejarAsignar() {
    setErrores({});
    setErrorGeneral("");
    const v = validarTransaccion(form);
    if (Object.keys(v).length > 0) {
      setErrores(v);
      return;
    }
    onAsignarMeta?.({
      tipo: "INGRESO",
      monto: parseFloat(form.monto),
      categoria: form.categoria,
      fecha: form.fecha,
      descripcion: form.descripcion?.trim() || undefined,
    });
    onCerrar?.();
  }

  function cambiarTipo(tipo) {
    setForm((f) => ({ ...f, tipo, categoria: "" }));
    setErrores((e) => ({ ...e, tipo: undefined, categoria: undefined }));
  }

  return (
    <Modal
      visible={visible}
      titulo="Nuevo movimiento"
      icono={<IconoIngreso size={24} />}
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
          {form.tipo === "INGRESO" && onAsignarMeta && (
            <button
              type="button"
              className="btn btn-exito"
              onClick={manejarAsignar}
              disabled={guardando}
            >
              <IconoMetas size={16} /> Asignar a meta
            </button>
          )}
          <button
            type="submit"
            form="form-crear-transaccion"
            className="btn"
            disabled={guardando}
          >
            {guardando ? "Guardando..." : "Guardar"}
          </button>
        </>
      }
    >
      <form
        id="form-crear-transaccion"
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
            <label htmlFor="crear-monto">Monto</label>
            <input
              id="crear-monto"
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
            <label htmlFor="crear-fecha">Fecha</label>
            <SelectorFecha
              id="crear-fecha"
              valor={form.fecha}
              onChange={(v) => setForm({ ...form, fecha: v })}
              max={hoyISO()}
            />
            {errores.fecha && <span className="error-campo">{errores.fecha}</span>}
          </div>
        </div>
        <div className="campo">
          <label htmlFor="crear-categoria">Categoría</label>
          <Selector
            id="crear-categoria"
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
          <label htmlFor="crear-desc">Descripción (opcional)</label>
          <input
            id="crear-desc"
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
