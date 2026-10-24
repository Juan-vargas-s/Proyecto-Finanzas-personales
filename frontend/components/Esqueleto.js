export function Esqueleto({ className = "", alto, estilo }) {
  return (
    <div
      className={`esqueleto ${className}`.trim()}
      style={{ height: alto, ...estilo }}
      aria-hidden="true"
    />
  );
}

export function EsqueletoTarjetas({ cantidad = 4 }) {
  return (
    <div
      className="esqueleto-tarjetas"
      role="status"
      aria-label="Cargando indicadores"
    >
      {Array.from({ length: cantidad }).map((_, i) => (
        <Esqueleto key={i} className="esqueleto-tarjeta" />
      ))}
    </div>
  );
}

export function EsqueletoGrafica() {
  return (
    <div role="status" aria-label="Cargando gráfica">
      <Esqueleto className="esqueleto-grafica" />
    </div>
  );
}

export function EsqueletoTabla({ filas = 5 }) {
  return (
    <div role="status" aria-label="Cargando movimientos">
      {Array.from({ length: filas }).map((_, i) => (
        <div className="esqueleto-fila" key={i}>
          <Esqueleto className="esqueleto-linea" estilo={{ width: "22%" }} />
          <Esqueleto className="esqueleto-linea" estilo={{ width: "14%" }} />
          <Esqueleto className="esqueleto-linea" estilo={{ width: "18%" }} />
          <Esqueleto className="esqueleto-linea" estilo={{ width: "16%" }} />
          <Esqueleto className="esqueleto-linea" estilo={{ flex: 1 }} />
        </div>
      ))}
    </div>
  );
}

export function EsqueletoMetas({ cantidad = 3 }) {
  return (
    <div
      className="metas-grid"
      role="status"
      aria-label="Cargando metas"
    >
      {Array.from({ length: cantidad }).map((_, i) => (
        <Esqueleto key={i} className="esqueleto-meta" />
      ))}
    </div>
  );
}
