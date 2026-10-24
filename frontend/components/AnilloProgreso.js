"use client";

/**
 * Anillo de progreso en SVG con el porcentaje al centro.
 *
 * Sustituye a la barra plana de las metas: el porcentaje se escanea de un
 * vistazo (la barra se reserva para presupuestos, donde el eje sí es
 * "límite vs gastado").
 *
 * estado: "en_buen_dia" | "en_riesgo" | "vencida" | "completada" (define el
 * color del avance).
 */
export default function AnilloProgreso({
  porcentaje = 0,
  estado = "en_buen_dia",
  tamano = 96,
  grosor = 10,
  etiqueta,
}) {
  const avance = Math.max(0, Math.min(100, Number(porcentaje) || 0));
  const radio = (tamano - grosor) / 2;
  const circunferencia = 2 * Math.PI * radio;
  const centro = tamano / 2;

  return (
    <div className={`anillo ${estado}`} style={{ width: tamano, height: tamano }}>
      <svg
        width={tamano}
        height={tamano}
        viewBox={`0 0 ${tamano} ${tamano}`}
        role="img"
        aria-label={`${Math.round(avance)}% del objetivo alcanzado`}
      >
        <circle
          className="anillo-pista"
          cx={centro}
          cy={centro}
          r={radio}
          fill="none"
          strokeWidth={grosor}
        />
        <circle
          className="anillo-avance"
          cx={centro}
          cy={centro}
          r={radio}
          fill="none"
          strokeWidth={grosor}
          strokeLinecap="round"
          strokeDasharray={circunferencia}
          strokeDashoffset={circunferencia * (1 - avance / 100)}
          transform={`rotate(-90 ${centro} ${centro})`}
        />
      </svg>
      <div className="anillo-centro">
        <strong>{Math.round(avance)}%</strong>
        {etiqueta ? <span>{etiqueta}</span> : null}
      </div>
    </div>
  );
}
