"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, gateway, getToken } from "../lib/api";

export default function Notificaciones({ usuarioId }) {
  const [lista, setLista] = useState([]);
  const [abierta, setAbierta] = useState(false);
  const [tick, setTick] = useState(0);
  const [nueva, setNueva] = useState(null);
  const [enVivo, setEnVivo] = useState(false);
  const avisoRef = useRef(null);

  const cargar = useCallback(async () => {
    if (!usuarioId) return;
    try {
      const datos = await api(`/api/metas/notificaciones/${usuarioId}`);
      setLista(Array.isArray(datos) ? datos : []);
    } catch {
      // el polling no debe romper la UI si el servicio falla
    }
  }, [usuarioId]);

  useEffect(() => {
    cargar();
    const intervalo = setInterval(cargar, 60000);
    return () => clearInterval(intervalo);
  }, [cargar]);

  useEffect(() => {
    if (tick > 0) cargar();
  }, [tick, cargar]);

  /**
   * Alertas en vivo: el servicio de metas empuja las notificaciones por SSE
   * (Server-Sent Events) en cuanto se generan, sin que el navegador tenga
   * que preguntar cada X segundos. Si la conexión no se puede abrir, el
   * polling anterior sigue funcionando como respaldo.
   */
  useEffect(() => {
    const token = getToken();
    if (!token || !usuarioId) return undefined;

    let fuente = null;
    try {
      fuente = new EventSource(
        `${gateway()}/api/metas/stream?token=${encodeURIComponent(token)}`
      );
    } catch {
      return undefined;
    }

    fuente.addEventListener("conectado", () => setEnVivo(true));
    fuente.addEventListener("notificacion", (evento) => {
      try {
        const n = JSON.parse(evento.data);
        setNueva(n);
        cargar();
      } catch {
        // evento con formato inesperado: se ignora
      }
    });
    fuente.onerror = () => setEnVivo(false);

    return () => {
      setEnVivo(false);
      if (fuente) fuente.close();
    };
  }, [usuarioId, cargar]);

  // El aviso flotante se oculta solo a los pocos segundos.
  useEffect(() => {
    if (!nueva) return undefined;
    const t = setTimeout(() => setNueva(null), 6000);
    return () => clearTimeout(t);
  }, [nueva]);

  const noLeidas = lista.filter((n) => !n.leida);

  async function marcarLeida(id) {
    try {
      await api(`/api/metas/notificaciones/${id}/leer?usuarioId=${usuarioId}`, {
        method: "PUT",
      });
      setTick((t) => t + 1);
    } catch {
      // ignorar
    }
  }

  async function marcarTodas() {
    for (const n of noLeidas) {
      await marcarLeida(n.id);
    }
  }

  function fecha(cadena) {
    try {
      return new Date(cadena).toLocaleString("es-MX", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return cadena;
    }
  }

  return (
    <>
      {nueva && (
        <div className="aviso-flotante" role="status" ref={avisoRef}>
          <span className="aviso-icono" aria-hidden="true">
            {nueva.tipo === "META" ? "🏆" : "⚠️"}
          </span>
          <span className="aviso-texto">{nueva.mensaje}</span>
          <button
            type="button"
            className="btn btn-secundario btn-mini"
            onClick={() => setNueva(null)}
            aria-label="Cerrar aviso"
          >
            ✕
          </button>
        </div>
      )}

      <button
        type="button"
        className="campana"
        title={enVivo ? "Notificaciones (en vivo)" : "Notificaciones"}
        aria-label={`Notificaciones${
          noLeidas.length > 0 ? `: ${noLeidas.length} sin leer` : ""
        }`}
        aria-expanded={abierta}
        onClick={() => setAbierta((a) => !a)}
      >
        <span aria-hidden="true">🔔</span>
        {noLeidas.length > 0 && (
          <span className="contador" aria-hidden="true">
            {noLeidas.length}
          </span>
        )}
      </button>

      {abierta && (
        <>
          <div className="notif-fondo" onClick={() => setAbierta(false)} />
          <div className="notif-caja">
            <h3>
              Notificaciones
              {noLeidas.length > 0 && (
                <button
                  type="button"
                  className="btn btn-secundario btn-mini"
                  onClick={marcarTodas}
                >
                  Marcar todas
                </button>
              )}
            </h3>
            <div className="notif-lista">
              {lista.length === 0 && (
                <div className="vacio">No tienes notificaciones 🎉</div>
              )}
              {lista.map((n) => (
                <div
                  key={n.id}
                  className={`notif-item ${n.leida ? "" : "no-leida"}`}
                >
                  <span className="mensaje">
                    {n.tipo === "META" ? "🏆 " : "⚠️ "}
                    {n.mensaje}
                  </span>
                  <span className="meta-notif">
                    <span>{fecha(n.creadaEn)}</span>
                    {!n.leida && (
                      <button
                        type="button"
                        className="btn btn-secundario btn-mini"
                        onClick={() => marcarLeida(n.id)}
                      >
                        Marcar leída
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
