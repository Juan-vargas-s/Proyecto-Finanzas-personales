"use client";

import { useCallback, useEffect, useState } from "react";
import { api, usuarioId } from "../../../lib/api";
import { formatear, useMoneda } from "../../../lib/dinero";
import { aOpciones, useCategorias } from "../../../lib/categorias";
import { Modal, ModalConfirmacion, useRecuadro } from "../../../components/Modal";
import { SelectorFecha, fechaBonita } from "../../../components/Fechas";
import Selector from "../../../components/Selector";
import FlujoDinero from "../../../components/FlujoDinero";
import TarjetaMeta from "../../../components/TarjetaMeta";
import { Esqueleto, EsqueletoMetas } from "../../../components/Esqueleto";
import {
  IconoAlerta,
  IconoBanco,
  IconoCheckCirculo,
  IconoDeshacer,
  IconoEditar,
  IconoMas,
  IconoMetas,
  IconoTendencia,
} from "../../../components/Iconos";

function mesActual() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
}

const FORM_VACIO = {
  id: null,
  nombre: "",
  montoObjetivo: "",
  fechaLimite: "",
  categoria: "",
};

export default function MetasPage() {
  const uid = usuarioId();
  const moneda = useMoneda();
  const { categorias } = useCategorias();
  const [mes, setMes] = useState(mesActual());
  const [metas, setMetas] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [resumenMes, setResumenMes] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [aportesDe, setAportesDe] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [porEliminar, setPorEliminar] = useState(null);
  const { recuadro, exito, fallo, limpiar } = useRecuadro();

  const cargar = useCallback(async () => {
    if (!uid) return;
    setCargando(true);
    try {
      const [lista, kpis, mesDatos] = await Promise.all([
        api(`/api/metas?usuarioId=${uid}`),
        api(`/api/metas/resumen?usuarioId=${uid}`).catch(() => null),
        api(`/api/reportes/resumen/${uid}?mes=${mes}`).catch(() => null),
      ]);
      setMetas(Array.isArray(lista) ? lista : []);
      setResumen(kpis);
      setResumenMes(mesDatos);
    } catch (err) {
      fallo("No se pudieron cargar las metas", err.message);
    } finally {
      setCargando(false);
    }
  }, [uid, mes]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function abrirCrear() {
    limpiar();
    setForm(FORM_VACIO);
    setModalAbierto(true);
  }

  function abrirEditar(meta) {
    limpiar();
    setForm({
      id: meta.id,
      nombre: meta.nombre || "",
      montoObjetivo: String(meta.montoObjetivo ?? ""),
      fechaLimite: meta.fechaLimite || "",
      categoria: meta.categoria || "",
    });
    setModalAbierto(true);
  }

  async function guardar(e) {
    e.preventDefault();
    limpiar();
    if (!form.nombre.trim()) {
      fallo("Falta el nombre", "Ponle un nombre a la meta.");
      return;
    }
    if (!form.fechaLimite) {
      fallo("Falta la fecha límite", "Selecciona la fecha límite de la meta.");
      return;
    }
    const monto = parseFloat(form.montoObjetivo);
    if (!monto || monto <= 0) {
      fallo("Monto inválido", "El monto objetivo debe ser mayor a cero.");
      return;
    }
    setGuardando(true);
    try {
      const cuerpo = {
        nombre: form.nombre.trim(),
        montoObjetivo: monto,
        fechaLimite: form.fechaLimite,
        categoria: form.categoria || "",
      };
      if (form.id) {
        await api(`/api/metas/${form.id}`, { method: "PUT", body: cuerpo });
        exito("Meta actualizada", "Los cambios se guardaron correctamente.");
      } else {
        await api("/api/metas", { method: "POST", body: cuerpo });
        exito("Meta creada", "La nueva meta se guardó correctamente.");
      }
      setModalAbierto(false);
      setForm(FORM_VACIO);
      await cargar();
    } catch (err) {
      fallo(form.id ? "No se pudo actualizar la meta" : "No se pudo crear la meta", err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function aportar(id, monto) {
    limpiar();
    try {
      const meta = await api(`/api/metas/${id}/aportar`, {
        method: "PUT",
        body: { monto },
      });
      if (meta && meta.completada) {
        exito("¡Meta cumplida!", `¡Felicidades, lograste: ${meta.nombre}!`);
      } else {
        exito("Aporte registrado", "El monto se sumó a tu meta de ahorro.");
      }
      await cargar();
    } catch (err) {
      fallo("No se pudo registrar el aporte", err.message);
    }
  }

  async function abrirAportes(meta) {
    limpiar();
    setAportesDe({ meta, lista: [], cargando: true });
    try {
      const lista = await api(`/api/metas/${meta.id}/aportes`);
      setAportesDe({ meta, lista: Array.isArray(lista) ? lista : [], cargando: false });
    } catch (err) {
      setAportesDe(null);
      fallo("No se pudo ver el historial", err.message);
    }
  }

  async function retirar(meta, aporte) {
    limpiar();
    try {
      await api(`/api/metas/${meta.id}/retirar`, {
        method: "POST",
        body: { monto: Math.abs(aporte.monto) },
      });
      exito("Aporte deshecho", "El monto se devolvió a tu saldo disponible.");
      await cargar();
      await abrirAportes(meta);
    } catch (err) {
      fallo("No se pudo deshacer el aporte", err.message);
    }
  }

  function eliminar(meta) {
    setPorEliminar(meta);
  }

  async function confirmarEliminar() {
    const meta = porEliminar;
    setPorEliminar(null);
    limpiar();
    try {
      await api(`/api/metas/${meta.id}`, { method: "DELETE" });
      exito("Meta eliminada", "La meta y sus aportes se eliminaron correctamente.");
      await cargar();
    } catch (err) {
      fallo("No se pudo eliminar la meta", err.message);
    }
  }

  const totalAhorrado = Number(resumen?.totalAhorrado) || 0;
  const objetivoTotal = Number(resumen?.objetivoTotal) || 0;
  const enRiesgo = Number(resumen?.enRiesgo) || 0;
  const ingresos = Number(resumenMes?.totalIngresos) || 0;
  const ahorroMes = Number(resumenMes?.totalAhorro) || 0;
  const tasaAhorro = ingresos > 0 ? (ahorroMes / ingresos) * 100 : 0;

  return (
    <>
      <div className="pagina-titulo">
        <div>
          <h1>Metas de ahorro</h1>
          <p>Define metas, aporta y sigue tu ritmo para llegar a tiempo</p>
        </div>
        <div className="fila">
          <button className="btn" onClick={abrirCrear}>
            <IconoMas size={16} /> Nueva meta
          </button>
        </div>
      </div>

      {recuadro}

      <div className="tarjetas">
        <div className="tarjeta">
          <div className="cabecera">
            <span className="etiqueta">Ahorrado en metas</span>
            <span className="icono" aria-hidden="true">
              <IconoBanco size={20} />
            </span>
          </div>
          <div className="valor ahorro">{formatear(totalAhorrado, moneda)}</div>
          <div className="pie-tarjeta">
            de {formatear(objetivoTotal, moneda)} de objetivo
          </div>
        </div>

        <div className="tarjeta">
          <div className="cabecera">
            <span className="etiqueta">Objetivo total</span>
            <span className="icono" aria-hidden="true">
              <IconoMetas size={20} />
            </span>
          </div>
          <div className="valor">{formatear(objetivoTotal, moneda)}</div>
          <div className="pie-tarjeta">
            {resumen?.metas ?? metas.length} metas ·{" "}
            {resumen?.completadas ?? 0} completadas
          </div>
        </div>

        <div className="tarjeta">
          <div className="cabecera">
            <span className="etiqueta">Tasa de ahorro del mes</span>
            <span className="icono" aria-hidden="true">
              <IconoTendencia size={20} />
            </span>
          </div>
          <div className="valor positivo">{tasaAhorro.toFixed(1)}%</div>
          <div className="pie-tarjeta">
            {formatear(ahorroMes, moneda)} apartados de {formatear(ingresos, moneda)}
          </div>
        </div>

        <div className={`tarjeta ${enRiesgo > 0 ? "tarjeta-error" : "tarjeta-exito"}`}>
          <div className="cabecera">
            <span className="etiqueta">Metas en riesgo</span>
            <span className="icono" aria-hidden="true">
              {enRiesgo > 0 ? (
                <IconoAlerta size={20} />
              ) : (
                <IconoCheckCirculo size={20} />
              )}
            </span>
          </div>
          <div className={`valor ${enRiesgo > 0 ? "negativo" : "positivo"}`}>
            {enRiesgo}
          </div>
          <div className="pie-tarjeta">
            {enRiesgo > 0
              ? "no llegan a su fecha límite al ritmo actual"
              : "todas las metas van al ritmo"}
          </div>
        </div>
      </div>

      <section className="panel">
        <h2>Flujo de dinero</h2>
        <FlujoDinero
          ingresos={ingresos}
          gastos={resumenMes?.totalGastos}
          ahorro={ahorroMes}
          disponible={resumenMes?.disponible}
        />
      </section>

      <section className="panel">
        <div className="pagina-titulo" style={{ marginBottom: "1rem" }}>
          <h2 style={{ margin: 0 }}>Mis metas ({metas.length})</h2>
        </div>

        {cargando ? (
          <EsqueletoMetas />
        ) : metas.length === 0 ? (
          <div className="vacio-accion">
            <span className="vacio-icono" aria-hidden="true">
              <IconoMetas size={28} />
            </span>
            <span className="vacio-titulo">Aún no tienes metas de ahorro</span>
            <p className="vacio-detalle">
              Crea una meta y separa dinero cada mes hasta lograrla.
            </p>
            <button className="btn" onClick={abrirCrear}>
              Crear primera meta
            </button>
          </div>
        ) : (
          <div className="metas-grid">
            {metas.map((m) => (
              <TarjetaMeta
                key={m.id}
                meta={m}
                onAportar={(monto) => aportar(m.id, monto)}
                onEditar={abrirEditar}
                onRetirar={abrirAportes}
                onEliminar={eliminar}
              />
            ))}
          </div>
        )}
      </section>

      <Modal
        visible={modalAbierto}
        titulo={form.id ? "Editar meta" : "Nueva meta"}
        icono={form.id ? <IconoEditar size={24} /> : <IconoMetas size={24} />}
        tipo="info"
        ancho="560px"
        onCerrar={() => setModalAbierto(false)}
        acciones={
          <>
            <button
              type="button"
              className="btn btn-secundario"
              onClick={() => setModalAbierto(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn"
              onClick={guardar}
              disabled={guardando}
            >
              {guardando ? "Guardando…" : form.id ? "Guardar cambios" : "Crear meta"}
            </button>
          </>
        }
      >
        <form className="formulario" onSubmit={guardar}>
          <div className="campo">
            <label htmlFor="nombre">Nombre</label>
            <input
              id="nombre"
              type="text"
              placeholder="Viaje a Japón"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
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
          <div className="campo">
            <label htmlFor="categoria-meta">Categoría (opcional)</label>
            <Selector
              id="categoria-meta"
              valor={form.categoria}
              onChange={(v) => setForm({ ...form, categoria: v })}
              opciones={aOpciones(categorias)}
              placeholder="Sin categoría"
            />
          </div>
          <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
        </form>
      </Modal>

      <Modal
        visible={aportesDe !== null}
        titulo={aportesDe ? `Aportes de ${aportesDe.meta.nombre}` : "Aportes"}
        icono={<IconoDeshacer size={24} />}
        tipo="info"
        ancho="520px"
        onCerrar={() => setAportesDe(null)}
      >
        {aportesDe && (
          <div className="aportes-lista">
            {aportesDe.cargando ? (
              <Esqueleto
                className="esqueleto-linea"
                estilo={{ width: "65%", margin: "0.4rem 0" }}
              />
            ) : aportesDe.lista.length === 0 ? (
              <p className="vacio">Esta meta todavía no tiene aportes.</p>
            ) : (
              aportesDe.lista.map((a) => (
                <div key={a.id} className="aporte-item">
                  <div>
                    <strong
                      className={a.monto >= 0 ? "positivo" : "negativo"}
                    >
                      {a.monto >= 0 ? "+" : "−"}
                      {formatear(Math.abs(a.monto), moneda)}
                    </strong>
                    <span className="aporte-fecha">
                      {fechaBonita((a.creadaEn || "").slice(0, 10))} ·{" "}
                      {a.tipo === "RETIRO" ? "Retiro" : "Aporte"}
                    </span>
                  </div>
                  {a.tipo !== "RETIRO" && (
                    <button
                      type="button"
                      className="btn btn-secundario btn-mini"
                      onClick={() => retirar(aportesDe.meta, a)}
                    >
                      Revertir
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </Modal>

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
