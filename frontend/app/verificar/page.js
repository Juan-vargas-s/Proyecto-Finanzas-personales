"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, setSesion } from "../../lib/api";

export default function VerificarPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [cargando, setCargando] = useState(false);
  const [reenviando, setReenviando] = useState(false);

  // Pre-cargar el email y el código de desarrollo (si no hay SMTP) que dejó
  // la página de registro en sessionStorage y en la URL.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const emailUrl = params.get("email") || sessionStorage.getItem("finanzas_verificar_email") || "";
    if (emailUrl) setEmail(emailUrl);

    const codigoDev = sessionStorage.getItem("finanzas_codigo_dev");
    if (codigoDev) {
      setAviso(`Modo desarrollo (sin SMTP): tu código es ${codigoDev}`);
      setCodigo(codigoDev);
      // Se usa una sola vez: borrarlo para que un reenvío limpie el aviso
      sessionStorage.removeItem("finanzas_codigo_dev");
    }
  }, []);

  async function enviar(e) {
    e.preventDefault();
    setError("");
    setCargando(true);
    try {
      const data = await api("/api/auth/verificar-email", {
        method: "POST",
        body: { email, codigo },
      });
      sessionStorage.removeItem("finanzas_verificar_email");
      setSesion(data.token, data.usuario);
      router.replace("/dashboard");
    } catch (err) {
      setError(err.message);
      setCargando(false);
    }
  }

  async function reenviar() {
    setError("");
    setAviso("");
    if (!email) {
      setError("Escribe tu correo para reenviar el código");
      return;
    }
    setReenviando(true);
    try {
      const data = await api("/api/auth/reenviar-codigo", {
        method: "POST",
        body: { email },
      });
      if (data.codigo) {
        setAviso(`Modo desarrollo (sin SMTP): tu código es ${data.codigo}`);
        setCodigo(data.codigo);
      } else {
        setAviso("Código reenviado. Revisa tu correo (revisa también spam)");
        setCodigo("");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setReenviando(false);
    }
  }

  return (
    <main className="auth">
      <div className="auth-card">
        <div className="logo">✉️</div>
        <h1>Verificar cuenta</h1>
        <p className="sub">
          Ingresa el código de 6 dígitos que te enviamos a tu correo
        </p>

        {error && <div className="alerta alerta-error">{error}</div>}
        {aviso && <div className="alerta alerta-aviso">{aviso}</div>}

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
            />
          </div>
          <div className="campo">
            <label htmlFor="codigo">Código de verificación (6 dígitos)</label>
            <input
              id="codigo"
              className="codigo-input"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={codigo}
              onChange={(e) =>
                setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="000000"
              required
              autoFocus={email ? true : undefined}
            />
          </div>
          <button
            className="btn btn-ancho"
            type="submit"
            disabled={cargando || codigo.length !== 6 || !email}
          >
            {cargando ? "Verificando…" : "Verificar cuenta"}
          </button>
        </form>

        <button
          className="btn btn-secundario btn-ancho"
          onClick={reenviar}
          disabled={reenviando}
        >
          {reenviando ? "Reenviando…" : "Reenviar código"}
        </button>

        <p className="pie">
          ¿Ya verificaste tu cuenta? <Link href="/login">Inicia sesión</Link>
        </p>
      </div>
    </main>
  );
}
