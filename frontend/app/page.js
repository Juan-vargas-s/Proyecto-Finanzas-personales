"use client";

import { useEffect } from "react";
import { getToken } from "../lib/api";
import { IconoFinanzas } from "../components/Iconos";

export default function HomePage() {
  useEffect(() => {
    const destino = getToken() ? "/dashboard" : "/login";
    window.location.replace(destino);
  }, []);

  return (
    <main className="landing">
      <h1>
        <IconoFinanzas size={40} className="logo-inline" /> Finanzas Personales
      </h1>
      <p>Sistema de finanzas personales en microservicios</p>
      <p className="estado">Redirigiendo…</p>
    </main>
  );
}
