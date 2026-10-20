"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";

export default function Notificaciones({ usuarioId }) {
  const [lista, setLista] = useState([]);
  const [abierta, setAbierta] = useState(false);
  const [tick, setTick] = useState(0);

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
    const intervalo = setInterval(cargar, 30000);
    return () => clearInterval(intervalo);
  }, [cargar]);

  useEffect(() => {
    if (tick > 0) cargar();
  }, [tick, cargar]);

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
      <button
        type="button"
        className="campana"
        title="Notificaciones"
        onClick={() => setAbierta((a) => !a)}
      >
        🔔
        {noLeidas.length > 0 && (
          <span className="contador">{noLeidas.length}</span>
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
