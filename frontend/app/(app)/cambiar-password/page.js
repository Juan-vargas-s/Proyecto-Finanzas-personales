"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, cerrarSesion } from "../../../lib/api";
import { useRecuadro } from "../../../components/Modal";

export default function CambiarPasswordPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    passwordActual: "",
    passwordNueva: "",
    passwordConfirm: "",
  });
  const [exito, setExito] = useState("");
  const [cargando, setCargando] = useState(false);
  const { recuadro, exito: mostrarExito, fallo } = useRecuadro();

  function cambiar(campo) {
    return (e) => setForm({ ...form, [campo]: e.target.value });
  }

  async function enviar(e) {
    e.preventDefault();
    setExito("");

    // La nueva contraseña y su confirmación deben coincidir
    if (form.passwordNueva !== form.passwordConfirm) {
      fallo("Las contraseñas no coinciden", "La nueva contraseña y su confirmación deben ser iguales.");
      return;
    }
    // La nueva debe ser distinta a la actual
    if (form.passwordActual === form.passwordNueva) {
      fallo("Contraseña repetida", "La nueva contraseña debe ser distinta a la actual.");
      return;
    }

    setCargando(true);
    try {
      await api("/api/auth/cambiar-password", { method: "PUT", body: form });
      setExito("Contraseña actualizada correctamente");
      setForm({ passwordActual: "", passwordNueva: "", passwordConfirm: "" });
    } catch (err) {
      fallo("No se pudo cambiar la contraseña", err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <>
      {recuadro}

      <div className="pagina-titulo">
        <div>
          <h1>Cambiar contraseña</h1>
          <p>Ingresa tu contraseña actual y la nueva contraseña</p>
        </div>
      </div>

      {exito ? (
        <div className="panel centrado">
          <div className="alerta alerta-ok">{exito}</div>
          <p>
            Por seguridad, cierra tu sesión y vuelve a iniciar con la nueva
            contraseña.
          </p>
          <button
            className="btn"
            onClick={() => {
              cerrarSesion();
              router.replace("/login");
            }}
          >
            Ir a iniciar sesión
          </button>
        </div>
      ) : (
        <div className="panel centrado">
          <form className="formulario" onSubmit={enviar}>
            <div className="campo">
              <label htmlFor="passwordActual">Contraseña actual</label>
              <input
                id="passwordActual"
                type="password"
                autoComplete="current-password"
                value={form.passwordActual}
                onChange={cambiar("passwordActual")}
                required
                autoFocus
              />
            </div>
            <div className="campo">
              <label htmlFor="passwordNueva">
                Nueva contraseña (mín. 6 caracteres)
              </label>
              <input
                id="passwordNueva"
                type="password"
                autoComplete="new-password"
                value={form.passwordNueva}
                onChange={cambiar("passwordNueva")}
                minLength={6}
                required
              />
            </div>
            <div className="campo">
              <label htmlFor="passwordConfirm">Confirmar nueva contraseña</label>
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
            <button className="btn btn-ancho" type="submit" disabled={cargando}>
              {cargando ? "Actualizando…" : "Cambiar contraseña"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
