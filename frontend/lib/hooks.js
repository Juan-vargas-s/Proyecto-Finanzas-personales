"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Cierra un panel (menú, calendario, modal) cuando el usuario hace clic
 * fuera de él o presiona la tecla Escape.
 *
 * refExtra sirve para los menús que se pintan en un portal (fuera del árbol
 * del contenedor): sin él, el clic dentro del menú contaría como "fuera".
 */
export function useClicFuera(ref, abierto, alCerrar, refExtra) {
  const guardado = useRef(alCerrar);
  guardado.current = alCerrar;

  useEffect(() => {
    if (!abierto) return;

    function clicFuera(e) {
      const dentro =
        (ref.current && ref.current.contains(e.target)) ||
        (refExtra && refExtra.current && refExtra.current.contains(e.target));
      if (!dentro) guardado.current();
    }

    function tecla(e) {
      if (e.key !== "Escape") return;
      guardado.current();
      // El foco vuelve al disparador: si estaba en una opción del portal,
      // al desmontarse el menú se perdería en el body.
      const boton = ref.current && ref.current.querySelector("button");
      if (boton) boton.focus();
    }

    document.addEventListener("mousedown", clicFuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", clicFuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [ref, refExtra, abierto]);
}

/**
 * Posiciona un panel flotante (menú de categorías, calendario) respecto a su
 * botón. Se pinta con position:fixed y en un portal, así no lo recorta ningún
 * panel con overflow ni se sale de la pantalla: si no cabe abajo, se abre
 * arriba, y su altura se limita al espacio real disponible.
 */
export function usePopover(abierto, alCerrar, altoMax = 280, anchoMin = 0) {
  const refBoton = useRef(null);
  const refMenu = useRef(null);
  const [estilo, setEstilo] = useState(null);

  const calcular = useCallback(() => {
    const boton = refBoton.current;
    if (!boton) return;

    const margen = 8;
    const hueco = 6;
    const r = boton.getBoundingClientRect();
    const menu = refMenu.current;
    const altoPreferido = menu
      ? menu.getBoundingClientRect().height || menu.scrollHeight
      : altoMax;
    const alto = Math.min(altoPreferido, altoMax);

    const abajo = window.innerHeight - r.bottom - margen - hueco;
    const arriba = r.top - margen - hueco;
    const abrirArriba = abajo < alto && arriba > abajo;
    const disponible = abrirArriba ? arriba : abajo;
    const maxAlto = Math.max(140, Math.min(altoMax, disponible));

    const ancho = Math.min(
      Math.max(r.width, anchoMin),
      window.innerWidth - margen * 2
    );
    const left = Math.min(
      Math.max(margen, r.left),
      window.innerWidth - ancho - margen
    );
    const top = abrirArriba
      ? Math.max(margen, r.top - Math.min(alto, maxAlto) - hueco)
      : Math.min(r.bottom + hueco, window.innerHeight - maxAlto - margen);

    setEstilo({
      position: "fixed",
      top: Math.round(top),
      left: Math.round(left),
      width: Math.round(ancho),
      maxHeight: Math.round(maxAlto),
      zIndex: 1000,
    });
  }, [altoMax, anchoMin]);

  useEffect(() => {
    if (!abierto) {
      setEstilo(null);
      return;
    }
    calcular();
    // Segunda medida cuando el menú ya está montado (su altura real decide
    // si se abre hacia arriba o hacia abajo).
    const id = requestAnimationFrame(calcular);
    window.addEventListener("resize", calcular);
    window.addEventListener("scroll", calcular, true);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", calcular);
      window.removeEventListener("scroll", calcular, true);
    };
  }, [abierto, calcular]);

  useClicFuera(refBoton, abierto, alCerrar, refMenu);

  return { refBoton, refMenu, estilo };
}
