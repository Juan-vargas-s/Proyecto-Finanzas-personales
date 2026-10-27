function crearIcono(nombre, contenido) {
  function Icono({ size = 20, strokeWidth = 1.8, className = "", ...props }) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
        focusable="false"
        {...props}
      >
        {contenido}
      </svg>
    );
  }
  Icono.displayName = nombre;
  return Icono;
}

export const IconoFinanzas = crearIcono(
  "IconoFinanzas",
  <>
    <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H17a3 3 0 0 1 3 3v11a3 3 0 0 1-3 3H6.5A2.5 2.5 0 0 1 4 19.5z" />
    <path d="M4 9h16" />
    <path d="M15 14h2" />
  </>
);

export const IconoDashboard = crearIcono(
  "IconoDashboard",
  <>
    <path d="M4 20h16" />
    <path d="M7 20v-6" />
    <path d="M12 20V8" />
    <path d="M17 20V10" />
  </>
);

export const IconoTransacciones = crearIcono(
  "IconoTransacciones",
  <>
    <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
    <path d="M9 8h6" />
    <path d="M9 12h6" />
    <path d="M9 16h3" />
  </>
);

export const IconoMetas = crearIcono(
  "IconoMetas",
  <>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="12" cy="12" r="1" />
  </>
);

export const IconoBuscar = crearIcono(
  "IconoBuscar",
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-4-4" />
  </>
);

export const IconoUsuario = crearIcono(
  "IconoUsuario",
  <>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </>
);

export const IconoLlave = crearIcono(
  "IconoLlave",
  <>
    <circle cx="7.5" cy="15.5" r="4.5" />
    <path d="m10.7 12.3 8.3-8.3" />
    <path d="m16 7 3 3" />
    <path d="m18.5 4.5 2 2" />
  </>
);

export const IconoSalir = crearIcono(
  "IconoSalir",
  <>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5" />
    <path d="M21 12H9" />
  </>
);

export const IconoIngreso = crearIcono(
  "IconoIngreso",
  <>
    <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M6 9.5h.01" />
    <path d="M18 14.5h.01" />
  </>
);

export const IconoGasto = crearIcono(
  "IconoGasto",
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 15.5 15.5 8.5" />
    <path d="M10 8.5h5.5V14" />
  </>
);

export const IconoBalance = crearIcono(
  "IconoBalance",
  <>
    <path d="M12 3v18" />
    <path d="M5 21h14" />
    <path d="M5 7h14" />
    <path d="M5 7 2 13h6z" />
    <path d="M19 7l-3 6h6z" />
  </>
);

export const IconoBalanza = IconoBalance;

export const IconoBanco = crearIcono(
  "IconoBanco",
  <>
    <path d="m3 10 9-6 9 6" />
    <path d="M5 10v9" />
    <path d="M9 10v9" />
    <path d="M15 10v9" />
    <path d="M19 10v9" />
    <path d="M3 21h18" />
  </>
);

export const IconoTendencia = crearIcono(
  "IconoTendencia",
  <>
    <path d="m3 17 6-6 4 4 8-8" />
    <path d="M15 7h6v6" />
  </>
);

export const IconoAlerta = crearIcono(
  "IconoAlerta",
  <>
    <path d="M10.3 3.9 2.2 18a2 2 0 0 0 1.7 3h16.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </>
);

export const IconoInfo = crearIcono(
  "IconoInfo",
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5" />
    <path d="M12 8h.01" />
  </>
);

export const IconoCheck = crearIcono("IconoCheck", <path d="m5 12 4 4L19 6" />);

export const IconoCheckCirculo = crearIcono(
  "IconoCheckCirculo",
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="m8 12 3 3 5-6" />
  </>
);

export const IconoMas = crearIcono(
  "IconoMas",
  <>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </>
);

export const IconoEditar = crearIcono(
  "IconoEditar",
  <>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
  </>
);

export const IconoDeshacer = crearIcono(
  "IconoDeshacer",
  <>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
  </>
);

export const IconoEliminar = crearIcono(
  "IconoEliminar",
  <>
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M19 6l-1 15H6L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </>
);

export const IconoCalendario = crearIcono(
  "IconoCalendario",
  <>
    <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
    <path d="M8 3v3" />
    <path d="M16 3v3" />
    <path d="M3 9h18" />
  </>
);

export const IconoSobre = crearIcono(
  "IconoSobre",
  <>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </>
);

export const IconoCerrar = crearIcono(
  "IconoCerrar",
  <>
    <path d="m6 6 12 12" />
    <path d="m18 6-12 12" />
  </>
);

export const IconoChevronAbajo = crearIcono(
  "IconoChevronAbajo",
  <path d="m6 9 6 6 6-6" />
);

export const IconoEtiqueta = crearIcono(
  "IconoEtiqueta",
  <>
    <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" />
    <circle cx="7.5" cy="7.5" r="1.5" />
  </>
);
