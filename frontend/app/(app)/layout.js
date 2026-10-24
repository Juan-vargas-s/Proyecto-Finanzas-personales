"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { MonedaProvider } from "../../lib/dinero";
import Notificaciones from "../../components/Notificaciones";
import Selector from "../../components/Selector";

const PAGINAS = [
  { ruta: "/dashboard", etiqueta: "Dashboard", icono: "📊" },
  { ruta: "/transacciones", etiqueta: "Transacciones", icono: "🧾" },
  { ruta: "/metas", etiqueta: "Metas", icono: "🎯" },
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
  const [busqueda, setBusqueda] = useState("");
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

  const mesActual = useMemo(() => {
    const texto = new Date().toLocaleDateString("es", {
      month: "long",
      year: "numeric",
    });
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }, []);

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

  /** Lleva la búsqueda del topbar a Transacciones. */
  function buscar(e) {
    e.preventDefault();
    const texto = busqueda.trim();
    router.push(texto ? `/transacciones?q=${encodeURIComponent(texto)}` : "/transacciones");
    window.dispatchEvent(new CustomEvent("finanzas:buscar", { detail: texto }));
  }

  if (!listo) {
    return <div className="pantalla-carga">Cargando…</div>;
  }

  return (
    <MonedaProvider moneda={moneda}>
      <div className="app">
        <aside className="sidebar">
          <Link href="/dashboard" className="marca">
            <span aria-hidden="true">💰</span>
            <span className="marca-texto">Finanzas</span>
          </Link>
          <nav className="side-nav" aria-label="Principal">
            {PAGINAS.map((p) => (
              <Link
                key={p.ruta}
                href={p.ruta}
                aria-current={pathname === p.ruta ? "page" : undefined}
                className={pathname === p.ruta ? "activo" : ""}
              >
                <span className="side-icono" aria-hidden="true">
                  {p.icono}
                </span>
                <span className="side-etiqueta">{p.etiqueta}</span>
              </Link>
            ))}
          </nav>
          <div className="sidebar-pie">Finanzas personales · v1.0</div>
        </aside>

        <div className="app-cuerpo">
          <header className="topbar">
            <div className="topbar-contexto">
              <span className="etiqueta-contexto">Periodo</span>
              <span className="chip-mes">{mesActual}</span>
            </div>

            <form className="buscador" role="search" onSubmit={buscar}>
              <span className="buscador-icono" aria-hidden="true">
                🔎
              </span>
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar movimientos…"
                aria-label="Buscar movimientos"
              />
            </form>

            <div className="usuario" ref={menuRef}>
              <Notificaciones usuarioId={uid} />
              <button
                type="button"
                className={`nombre-usuario${menuAbierto ? " abierto" : ""}`}
                onClick={() => setMenuAbierto((v) => !v)}
                aria-expanded={menuAbierto}
                aria-haspopup="menu"
                aria-label={`Menú de ${nombre}`}
              >
                <span aria-hidden="true">👤</span>
                <span className="nombre-texto">{nombre}</span>
                <span aria-hidden="true" className="flecha">
                  ▾
                </span>
              </button>

              {menuAbierto && (
                <div className="menu-usuario" role="menu">
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
                  <button type="button" className="menu-item" onClick={salir}>
                    🚪 Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          </header>
          <main className="contenido">{children}</main>
        </div>
      </div>
    </MonedaProvider>
  );
}
