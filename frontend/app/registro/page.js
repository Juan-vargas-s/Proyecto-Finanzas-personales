"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "../../lib/api";

const MONEDAS = ["MXN", "USD", "EUR", "COP", "ARS", "PEN", "CLP"];

export default function RegistroPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    nombre: "",
    email: "",
    password: "",
    passwordConfirm: "",
    monedaPreferida: "MXN",
  });
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  function cambiar(campo) {
    return (e) => setForm({ ...form, [campo]: e.target.value });
  }

  async function enviar(e) {
    e.preventDefault();
    setError("");

    // Validación cliente: la confirmación debe coincidir con la contraseña
    if (form.password !== form.passwordConfirm) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setCargando(true);
    try {
      const data = await api("/api/auth/registro", {
        method: "POST",
        body: form,
      });
      // La cuenta queda pendiente de verificación por email
      if (data.email) {
        sessionStorage.setItem("finanzas_verificar_email", data.email);
        router.push(`/verificar?email=${encodeURIComponent(data.email)}`);
      } else {
        router.push("/verificar");
      }
    } catch (err) {
      setError(err.message);
      setCargando(false);
    }
  }

  return (
    <main className="auth">
      <div className="auth-card">
        <div className="logo">💰</div>
        <h1>Crear cuenta</h1>
        <p className="sub">Regístrate para comenzar a administrar tus finanzas</p>

        {error && <div className="alerta alerta-error">{error}</div>}

        <form className="formulario" onSubmit={enviar}>
          <div className="campo">
            <label htmlFor="nombre">Nombre completo</label>
            <input
              id="nombre"
              type="text"
              value={form.nombre}
              onChange={cambiar("nombre")}
              minLength={2}
              required
              autoFocus
            />
          </div>
          <div className="campo">
            <label htmlFor="email">Correo electrónico</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={cambiar("email")}
              required
            />
          </div>
          <div className="campo">
            <label htmlFor="password">Contraseña (mín. 6 caracteres)</label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={cambiar("password")}
              minLength={6}
              required
            />
          </div>
          <div className="campo">
            <label htmlFor="passwordConfirm">Confirmar contraseña</label>
            <input
              id="passwordConfirm"
              type="password"
              autoComplete="new-password"
              value={form.passwordConfirm}
              onChange={cambiar("passwordConfirm")}
              minLength={6}
              required
            />
          </div>
          <div className="campo">
            <label htmlFor="moneda">Moneda preferida</label>
            <select
              id="moneda"
              value={form.monedaPreferida}
              onChange={cambiar("monedaPreferida")}
            >
              {MONEDAS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <button className="btn btn-ancho" type="submit" disabled={cargando}>
            {cargando ? "Creando cuenta…" : "Registrarme"}
          </button>
        </form>

        <p className="pie">
          ¿Ya tienes cuenta? <Link href="/login">Inicia sesión</Link>
        </p>
      </div>
    </main>
  );
}
