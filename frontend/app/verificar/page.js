"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, setSesion } from "../../lib/api";
import { useRecuadro } from "../../components/Modal";
import { IconoSobre } from "../../components/Iconos";

export default function VerificarPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [cargando, setCargando] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const { recuadro, exito, fallo, limpiar } = useRecuadro();

  // Pre-cargar el email que dejó la página de registro en la URL / sessionStorage.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const emailUrl = params.get("email") || sessionStorage.getItem("finanzas_verificar_email") || "";
    if (emailUrl) setEmail(emailUrl);
  }, []);

  async function enviar(e) {
    e.preventDefault();
    limpiar();
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
      fallo("No se pudo verificar", err.message);
      setCargando(false);
    }
  }

  async function reenviar() {
    limpiar();
    if (!email) {
      fallo("Falta el correo", "Escribe tu correo para reenviar el código.");
      return;
    }
    setReenviando(true);
    try {
      await api("/api/auth/reenviar-codigo", {
        method: "POST",
        body: { email },
      });
      exito("Código reenviado", "Revisa tu correo (revisa también spam).");
      setCodigo("");
    } catch (err) {
      fallo("No se pudo reenviar", err.message);
    } finally {
      setReenviando(false);
    }
  }

  return (
    <main className="auth">
      {recuadro}
      <div className="auth-card">
        <div className="logo">
          <IconoSobre size={36} />
        </div>
        <h1>Verificar cuenta</h1>
        <p className="sub">
          Ingresa el código de 6 dígitos que te enviamos a tu correo
        </p>

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
