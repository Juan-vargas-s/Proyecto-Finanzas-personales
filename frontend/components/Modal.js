"use client";

import { useEffect, useState } from "react";

/**
 * Modal genérico con el diseño del frontend (fondo difuminado, panel
 * elevado y animaciones). Se cierra con Escape o clic fuera.
 */
export function Modal({ visible, titulo, icono, tipo, children, acciones, onCerrar, ancho }) {
  useEffect(() => {
    if (!visible) return;
    function tecla(e) {
      if (e.key === "Escape" && onCerrar) onCerrar();
    }
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [visible, onCerrar]);

  if (!visible) return null;

  return (
    <div
      className="modal-fondo"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && onCerrar) onCerrar();
      }}
    >
      <div
        className={`modal-caja${ancho ? " modal-caja-ancha" : ""}`}
        style={ancho ? { width: `min(${ancho}, 100%)` } : undefined}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
      >
        <button
          type="button"
          className="modal-cerrar"
          aria-label="Cerrar"
          onClick={onCerrar}
        >
          ✕
        </button>
        {icono && (
          <div
            className={`modal-icono${tipo ? ` modal-icono-${tipo}` : ""}`}
            aria-hidden="true"
          >
            {icono}
          </div>
        )}
        <h3 className={`modal-titulo${tipo ? ` modal-titulo-${tipo}` : ""}`}>
          {titulo}
        </h3>
        <div className="modal-mensaje">{children}</div>
        {acciones && <div className="modal-acciones">{acciones}</div>}
      </div>
    </div>
  );
}

/**
 * Modal de confirmación (reemplaza a window.confirm / window.alert).
 */
export function ModalConfirmacion({
  visible,
  titulo,
  mensaje,
  textoConfirmar = "Eliminar",
  textoCancelar = "Cancelar",
  peligro = true,
  onConfirmar,
  onCancelar,
}) {
  return (
    <Modal
      visible={visible}
      titulo={titulo}
      icono={peligro ? "⚠️" : "ℹ️"}
      tipo={peligro ? "aviso" : "info"}
      onCerrar={onCancelar}
      acciones={
        <>
          <button type="button" className="btn btn-secundario" onClick={onCancelar}>
            {textoCancelar}
          </button>
          <button
            type="button"
            className={`btn ${peligro ? "btn-peligro-solido" : "btn"}`}
            onClick={onConfirmar}
          >
            {textoConfirmar}
          </button>
        </>
      }
    >
      <p>{mensaje}</p>
    </Modal>
  );
}

export default Modal;

const ICONOS = {
  exito: "✓",
  error: "✕",
  aviso: "⚠",
  info: "ℹ",
};

/**
 * Recuadro de mensaje para una acción (éxito, error, aviso o información).
 * Reemplaza a los banners de alerta en línea.
 */
export function ModalMensaje({
  visible,
  tipo = "info",
  titulo,
  mensaje,
  textoAceptar = "Aceptar",
  onCerrar,
}) {
  return (
    <Modal
      visible={visible}
      titulo={titulo}
      icono={ICONOS[tipo] || ICONOS.info}
      tipo={tipo}
      onCerrar={onCerrar}
      acciones={
        <button type="button" className="btn" onClick={onCerrar}>
          {textoAceptar}
        </button>
      }
    >
      <p className="modal-texto">{mensaje}</p>
    </Modal>
  );
}

/**
 * Hook para mostrar recuadros (mensajes de acción) desde cualquier página.
 *
 *   const { recuadro, exito, fallo, aviso, limpiar } = useRecuadro();
 *   exito("Movimiento eliminado", "El registro se eliminó.");
 *   ...
 *   return (<> ... {recuadro} </>);
 */
export function useRecuadro() {
  const [datos, setDatos] = useState(null);

  function mostrar(tipo, titulo, mensaje) {
    setDatos({ tipo, titulo, mensaje });
  }

  return {
    recuadro: datos ? (
      <ModalMensaje
        visible
        tipo={datos.tipo}
        titulo={datos.titulo}
        mensaje={datos.mensaje}
        onCerrar={() => setDatos(null)}
      />
    ) : null,
    mostrar,
    exito: (titulo, mensaje) => mostrar("exito", titulo, mensaje),
    fallo: (titulo, mensaje) => mostrar("error", titulo, mensaje),
    aviso: (titulo, mensaje) => mostrar("aviso", titulo, mensaje),
    limpiar: () => setDatos(null),
  };
}
