"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, setSesion } from "../../lib/api";
import { useRecuadro } from "../../components/Modal";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [noVerificado, setNoVerificado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const { recuadro, fallo, limpiar } = useRecuadro();

  async function enviar(e) {
    e.preventDefault();
    limpiar();
    setNoVerificado(false);
    setCargando(true);
    try {
      const data = await api("/api/auth/login", {
        method: "POST",
        body: { email, password },
      });
      setSesion(data.token, data.usuario);
      router.push("/dashboard");
    } catch (err) {
      fallo("No se pudo iniciar sesión", err.message);
      // Cuenta creada pero sin verificar el correo todavía
      if (err.status === 403) {
        setNoVerificado(true);
      }
      setCargando(false);
    }
  }

  return (
    <main className="auth">
      {recuadro}

      <div className="auth-card">
        <div className="logo">💰</div>
        <h1>Iniciar sesión</h1>
        <p className="sub">Accede a tus finanzas personales</p>

        {noVerificado && (
          <div className="alerta alerta-aviso">
            Cuenta sin verificar.{" "}
            <Link href={`/verificar?email=${encodeURIComponent(email)}`}>
              Verificar ahora
            </Link>
          </div>
        )}

        <form className="formulario" onSubmit={enviar}>
          <div className="campo">
            <label htmlFor="email">Correo electrónico</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="campo">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button className="btn btn-ancho" type="submit" disabled={cargando}>
            {cargando ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <p className="pie">
          ¿No tienes cuenta? <Link href="/registro">Regístrate</Link>
        </p>
      </div>
    </main>
  );
}
