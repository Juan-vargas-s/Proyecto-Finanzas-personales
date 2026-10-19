"use client";

import { useEffect } from "react";
import { getToken } from "../lib/api";

export default function HomePage() {
  useEffect(() => {
    const destino = getToken() ? "/dashboard" : "/login";
    window.location.replace(destino);
  }, []);

  return (
    <main className="landing">
      <h1>💰 Finanzas Personales</h1>
      <p>Sistema de finanzas personales en microservicios</p>
      <p className="estado">Redirigiendo…</p>
    </main>
  );
}
