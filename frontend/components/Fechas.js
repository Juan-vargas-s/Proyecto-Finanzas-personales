"use client";

import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { usePopover } from "../lib/hooks";

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const MESES_CORTO = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

const pad = (n) => String(n).padStart(2, "0");

function deISO(iso) {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d);
}

function aISO(fecha) {
  return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}`;
}

/** "2026-10-20" -> "20 oct 2026" */
export function fechaBonita(iso) {
  if (!iso) return "";
  try {
    return deISO(iso).toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

/** "2026-10" -> "Octubre 2026" */
export function mesBonito(valor) {
  if (!valor) return "";
  const [a, m] = valor.split("-").map(Number);
  if (!a || !m) return valor;
  return `${MESES[m - 1]} ${a}`;
}

/**
 * Calendario desplegable con el diseño del frontend (reemplaza al
 * input nativo type="date"). El panel se pinta en un portal para que no
 * quede recortado al final de la página: ver usePopover.
 */
export function SelectorFecha({ valor, onChange, id, max, min, placeholder = "Seleccionar fecha", className = "" }) {
  const [abierto, setAbierto] = useState(false);
  const [vista, setVista] = useState(() => {
    const base = valor ? deISO(valor) : new Date();
    return { anio: base.getFullYear(), mes: base.getMonth() };
  });
  const cerrar = useCallback(() => setAbierto(false), []);
  const { refBoton, refMenu, estilo } = usePopover(abierto, cerrar, 380, 282);

  function alternar() {
    if (!abierto) {
      const base = valor ? deISO(valor) : new Date();
      setVista({ anio: base.getFullYear(), mes: base.getMonth() });
    }
    setAbierto((v) => !v);
  }

  const anio = vista.anio;
  const mes = vista.mes;
  const totalDias = new Date(anio, mes + 1, 0).getDate();
  const offset = new Date(anio, mes, 1).getDay();
  const celdas = [
    ...Array(offset).fill(null),
    ...Array.from({ length: totalDias }, (_, i) => i + 1),
  ];
  const hoyISO = aISO(new Date());

  function mover(delta) {
    const fecha = new Date(anio, mes + delta, 1);
    setVista({ anio: fecha.getFullYear(), mes: fecha.getMonth() });
  }

  function elegir(dia) {
    const iso = `${anio}-${pad(mes + 1)}-${pad(dia)}`;
    onChange(iso);
    cerrar();
  }

  return (
    <div className={`selector-contenedor ${className}`} ref={refBoton}>
      <button
        type="button"
        id={id}
        className={`selector${abierto ? " abierto" : ""}${valor ? "" : " vacio"}`}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        onClick={alternar}
      >
        <span className="selector-texto">
          <span aria-hidden="true">📅</span> {valor ? fechaBonita(valor) : placeholder}
        </span>
        <span className="selector-flecha" aria-hidden="true">
          ▾
        </span>
      </button>

      {abierto &&
        estilo &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={refMenu}
            className="calendario"
            style={estilo}
            role="dialog"
            aria-label="Seleccionar fecha"
          >
            <div className="calendario-head">
              <button
                type="button"
                className="calendario-nav"
                aria-label="Mes anterior"
                onClick={() => mover(-1)}
              >
                ‹
              </button>
              <span className="calendario-titulo">
                {MESES[mes]} {anio}
              </span>
              <button
                type="button"
                className="calendario-nav"
                aria-label="Mes siguiente"
                onClick={() => mover(1)}
              >
                ›
              </button>
            </div>

            <div className="calendario-grid">
              {DIAS.map((d) => (
                <span key={d} className="calendario-dow">
                  {d}
                </span>
              ))}
              {celdas.map((dia, i) => {
                if (dia === null) return <span key={`v${i}`} />;
                const iso = `${anio}-${pad(mes + 1)}-${pad(dia)}`;
                const deshabilitado =
                  (max && iso > max) || (min && iso < min);
                const clases = [
                  "calendario-dia",
                  iso === valor ? "seleccionado" : "",
                  iso === hoyISO ? "hoy" : "",
                  deshabilitado ? "deshabilitado" : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <button
                    key={iso}
                    type="button"
                    className={clases}
                    disabled={deshabilitado}
                    onClick={() => elegir(dia)}
                  >
                    {dia}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

/**
 * Selector de mes desplegable con el diseño del frontend (reemplaza al
 * input nativo type="month"). valor: "YYYY-MM".
 */
export function SelectorMes({ valor, onChange, id, placeholder = "Seleccionar mes", className = "" }) {
  const [abierto, setAbierto] = useState(false);
  const [anio, setAnio] = useState(() =>
    valor ? Number(valor.slice(0, 4)) : new Date().getFullYear()
  );
  const cerrar = useCallback(() => setAbierto(false), []);
  const { refBoton, refMenu, estilo } = usePopover(abierto, cerrar, 340, 282);

  function alternar() {
    if (!abierto) {
      setAnio(valor ? Number(valor.slice(0, 4)) : new Date().getFullYear());
    }
    setAbierto((v) => !v);
  }

  return (
    <div className={`selector-contenedor ${className}`} ref={refBoton}>
      <button
        type="button"
        id={id}
        className={`selector${abierto ? " abierto" : ""}${valor ? "" : " vacio"}`}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        onClick={alternar}
      >
        <span className="selector-texto">
          <span aria-hidden="true">🗓️</span> {valor ? mesBonito(valor) : placeholder}
        </span>
        <span className="selector-flecha" aria-hidden="true">
          ▾
        </span>
      </button>

      {abierto &&
        estilo &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={refMenu}
            className="calendario calendario-mes"
            style={estilo}
            role="dialog"
            aria-label="Seleccionar mes"
          >
            <div className="calendario-head">
              <button
                type="button"
                className="calendario-nav"
                aria-label="Año anterior"
                onClick={() => setAnio((a) => a - 1)}
              >
                ‹
              </button>
              <span className="calendario-titulo">{anio}</span>
              <button
                type="button"
                className="calendario-nav"
                aria-label="Año siguiente"
                onClick={() => setAnio((a) => a + 1)}
              >
                ›
              </button>
            </div>

            <div className="calendario-meses">
              {MESES_CORTO.map((m, i) => {
                const v = `${anio}-${pad(i + 1)}`;
                return (
                  <button
                    key={v}
                    type="button"
                    className={`calendario-mes-opcion${v === valor ? " activa" : ""}`}
                    onClick={() => {
                      onChange(v);
                      cerrar();
                    }}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
