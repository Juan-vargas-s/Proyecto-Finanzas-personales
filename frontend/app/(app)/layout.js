"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  api,
  cerrarSesion,
  getUsuario,
  getToken,
  nombreUsuario,
  setUsuario,
  usuarioId,
} from "../../lib/api";
import { MONEDAS } from "../../lib/monedas";
import Notificaciones from "../../components/Notificaciones";
import Selector from "../../components/Selector";

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
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [moneda, setMoneda] = useState("");
  const [estadoMoneda, setEstadoMoneda] = useState("");
  const menuRef = useRef(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    setUid(usuarioId());
    setNombre(nombreUsuario() || "Usuario");
    setMoneda(getUsuario()?.monedaPreferida || "");
    setListo(true);
  }, [router]);

  // Cierra el menú del perfil al hacer clic fuera de él
  useEffect(() => {
    if (!menuAbierto) return;
    function clicFuera(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuAbierto(false);
      }
    }
    document.addEventListener("mousedown", clicFuera);
    return () => document.removeEventListener("mousedown", clicFuera);
  }, [menuAbierto]);

  // Al navegar a otra página, deja el menú cerrado
  useEffect(() => {
    setMenuAbierto(false);
  }, [pathname]);

  function salir() {
    cerrarSesion();
    router.replace("/login");
  }

  /** Guarda la moneda preferida del usuario en su perfil. */
  async function cambiarMoneda(nueva) {
    setMoneda(nueva);
    setEstadoMoneda("Guardando…");
    try {
      const usuario = await api("/api/auth/perfil", {
        method: "PUT",
        body: { monedaPreferida: nueva },
      });
      if (usuario) setUsuario(usuario);
      setEstadoMoneda("");
    } catch (err) {
      setEstadoMoneda(err.message);
    }
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
        <div className="usuario" ref={menuRef}>
          <Notificaciones usuarioId={uid} />
          <button
            type="button"
            className={`nombre-usuario${menuAbierto ? " abierto" : ""}`}
            onClick={() => setMenuAbierto((v) => !v)}
          >
            <span aria-hidden="true">👤</span>
            <span className="nombre-texto">{nombre}</span>
            <span aria-hidden="true" className="flecha">
              ▾
            </span>
          </button>
          <button className="btn btn-secundario btn-mini" onClick={salir}>
            Salir
          </button>

          {menuAbierto && (
            <div className="menu-usuario">
              <div className="menu-seccion">
                <span className="menu-titulo">Moneda preferida</span>
                <Selector
                  id="moneda-preferida"
                  valor={moneda}
                  onChange={cambiarMoneda}
                  placeholder="Seleccionar moneda"
                  opciones={MONEDAS.map((m) => ({ valor: m, etiqueta: m }))}
                />
                {estadoMoneda && (
                  <span className="menu-aviso">{estadoMoneda}</span>
                )}
              </div>
              <hr className="menu-separador" />
              <Link
                href="/cambiar-password"
                className="menu-item"
                onClick={() => setMenuAbierto(false)}
              >
                🔑 Cambiar contraseña
              </Link>
            </div>
          )}
        </div>
      </header>
      <main className="contenido">{children}</main>
    </div>
  );
}
