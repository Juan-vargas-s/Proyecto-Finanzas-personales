"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  cerrarSesion,
  getToken,
  nombreUsuario,
  usuarioId,
} from "../../lib/api";
import Notificaciones from "../../components/Notificaciones";

const PAGINAS = [
  { ruta: "/dashboard", etiqueta: "Dashboard" },
  { ruta: "/transacciones", etiqueta: "Transacciones" },
  { ruta: "/metas", etiqueta: "Metas" },
];

export default function AppLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [listo, setListo] = useState(false);
  const [uid, setUid] = useState(null);
  const [nombre, setNombre] = useState("");

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    setUid(usuarioId());
    setNombre(nombreUsuario() || "Usuario");
    setListo(true);
  }, [router]);

  function salir() {
    cerrarSesion();
    router.replace("/login");
  }

  if (!listo) {
    return <div className="pantalla-carga">Cargando…</div>;
  }

  return (
    <div className="app">
      <header className="topbar">
        <Link href="/dashboard" className="marca">
          💰 Finanzas
        </Link>
        <nav className="nav">
          {PAGINAS.map((p) => (
            <Link
              key={p.ruta}
              href={p.ruta}
              className={pathname === p.ruta ? "activo" : ""}
            >
              {p.etiqueta}
            </Link>
          ))}
        </nav>
        <div className="usuario">
          <Notificaciones usuarioId={uid} />
          <span className="nombre-usuario">{nombre}</span>
          <Link href="/cambiar-password" className="btn btn-secundario btn-mini">
            Contraseña
          </Link>
          <button className="btn btn-secundario btn-mini" onClick={salir}>
            Salir
          </button>
        </div>
      </header>
      <main className="contenido">{children}</main>
    </div>
  );
}
