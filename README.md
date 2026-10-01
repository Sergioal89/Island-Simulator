# 🏝️ Island Simulator

Un pequeño **juego-simulación económica** (PoC) sobre una isla cuya población
tiene que prosperar. El objetivo educativo es tocar conceptos de economía
—sobre todo **inflación / deflación**, oferta y demanda, y política monetaria—
de forma visual y jugable.

Cada **turno = 1 día**. Pulsa *Avanzar día* o activa *Auto* y observa cómo
evoluciona la isla.

## Cómo ejecutar

No necesita build ni dependencias. Tienes dos opciones:

- **Abrir directamente** `index.html` en el navegador (doble clic).
- O servirlo por HTTP (recomendado, evita restricciones de `file://`):

```bash
python -m http.server 8123
```

Y abre <http://localhost:8123>.

## Cómo se juega

- **Avanzar día / Auto / Reiniciar** controlan el tiempo.
- Pestañas:
  - **📈 Mercados** — precios, masa monetaria e inflación + gráficas.
  - **🌳 Árbol genealógico** — linaje de todas las familias (vivos y †).
  - **👥 Habitantes** — tabla con edad, etapa, caracolas y estado.
- **Medidas del gobierno** (panel derecho):
  - **Pensión a los viejos** — caracolas/día a los mayores de 60.
  - **Renta universal (RBU)** — caracolas/día a todo el mundo.
  - **Esfuerzo en construir viviendas** — qué parte de los adultos construye.

## El modelo económico

> **Idea central:** el *pescado* es el bien real (producción) y la *caracola* es
> el dinero. El precio sale, en esencia, de la **teoría cuantitativa del
> dinero**: `Precio ≈ (Dinero · Velocidad) / Pescado disponible` (M·V = P·Q).

- **Imprimir dinero** (pensión / RBU) sin que crezca la pesca → sube la masa
  monetaria → **inflación**. 🔺
- **Producir más pescado** con el dinero fijo → **deflación**. 🔻
- Una **sequía** reduce la pesca → escasez → **inflación por oferta**.

La masa monetaria (M) **solo cambia por las decisiones del gobierno**: el resto
de transacciones (comprar pescado) mueven caracolas de unos a otros sin crear ni
destruir dinero. Eso hace nítida la relación entre imprimir dinero y los precios.

### Demografía

- Esperanza de vida ≈ 80–110 días. **Niño** (0–20), **adulto** (20–60),
  **viejo** (+60).
- Solo los **adultos producen**: pescan (más en abundancia, menos en sequía).
- Consumo diario: niños y viejos **1 pescado**, adultos **2**.
- La **familia** mantiene a sus dependientes (hijos, pareja). Por eso un viejo
  **sin familia** depende de sus ahorros… o de la **pensión**: ahí se ve el
  valor (y el coste inflacionario) de la política social.
- Quien no come durante varios días seguidos muere de hambre.

### Los dos mercados

1. **Pescado** — se almacena en la *lonja*. Precio por oferta (stock) y demanda
   (bocas a alimentar), modulado por la masa monetaria.
2. **Vivienda** — un adulto tarda **20 días** en construir una casa. Dos adultos
   solteros + una casa libre → forman **familia** y pueden tener hijos. El precio
   de la vivienda se mueve por oferta (casas libres) y demanda (solteros).

## Estructura del código

| Archivo | Qué hace |
|---|---|
| `index.html` | Estructura y estilos de la interfaz. |
| `engine.js`  | Motor de simulación (economía + demografía). Sin UI. |
| `app.js`     | Render de la isla, gráficas, árbol genealógico y controles. |

Todos los parámetros ajustables están en el objeto `CFG` al principio de
`engine.js` (natalidad, pesca base, duración de la construcción, etc.).

## Ideas para ampliar (siguiente iteración)

- Un tercer bien o un impuesto para cerrar el círculo monetario.
- Agentes que *decidan* construir/pescar según precios (oferta endógena).
- Eventos (tormentas, pesca milagrosa) y objetivos de partida.
- Guardado de partidas y comparación de políticas.
