# 🏝️ Island Simulator

### ▶️ [Jugar ahora](https://sergioal89.github.io/Island-Simulator/)

Un pequeño **juego-simulación económica** (PoC) sobre una isla cuya población
tiene que prosperar. El objetivo educativo es tocar conceptos de economía
—**inflación / deflación**, oferta y demanda, política fiscal y monetaria, banca,
recursos naturales y pobreza— de forma visual y jugable.

Cada **turno = 1 año**. Pulsa *Avanzar año*, *+10 años* o activa *Auto* y
observa cómo evoluciona la isla. Con *Atrás / Adelante* puedes revisar años
pasados (solo lectura).

## Escenarios

Al abrir el juego eliges un escenario. Cada uno enseña **una sola idea**: solo
muestra sus controles y sus indicadores clave, y tiene una misión. El resto de
datos está a mano con «🔬 Ver todos los datos». Los escenarios guiados usan un
clima estable (sin estaciones ni sequías) para que solo se vea el efecto de tus
medidas.

| Escenario | Tipo | Controles | Lección |
|---|---|---|---|
| 🏝️ Primeros pasos | Tutorial | — | Pesca, lonja, precio y crecimiento de la isla |
| 🖨️ La imprenta | Experimento | Renta universal, imprimir | Imprimir dinero → inflación; no crea riqueza |
| 🎣 El mar | Reto | Cuota de pesca | Tragedia de los comunes |
| 👴 Las pensiones | Reto | Pensión, impuesto, jubilación | Envejecimiento: ninguna medida sola basta |
| 🏦 El banco | Reto | Tipo de interés | Muy alto: no pueden pagar la hipoteca. Muy bajo: nadie presta sus ahorros |
| 🏛️ El banco central | Reto | Tipo de interés | Subir los tipos frena la inflación (pero también la economía); bajarlos pronto la reaviva |
| 🧭 Isla libre | Sandbox | Todos | Todo a la vez, con clima real |

Al terminar cada escenario se explica qué ha pasado, con los números de tu
partida. Los escenarios están definidos en `scenarios.js`: fase de acción
(«haz esto»), de espera («deja pasar N años») o de objetivo (condiciones que se
deben cumplir siempre o al final).

## Cómo ejecutar

No necesita build ni dependencias:

- **Abrir directamente** `index.html` en el navegador (doble clic), o
- servirlo por HTTP:

```bash
python -m http.server 8123
```

Y abre <http://localhost:8123>.

## Qué se ve

- **La isla**: cada familia junto a su casa, con el apellido encima. Las parejas
  sin vivienda propia aparecen en casa de sus padres; los recién llegados sin
  casa, en la playa. La casa se dibuja según la riqueza **real** de la familia,
  medida en años de comida:
  - 🛖 **Choza**: ni contando la casa llegan a 3 años de comida.
  - 🏠 **Casa**: lo normal.
  - 🏰 **Mansión**: su dinero les da para 15 años o más sin trabajar. Si hay
    inflación, sus ahorros valen menos y la mansión puede volver a ser casa.
- **📈 Mercados**: precio del pescado (con la inflación en % al año, media de 10 años), lo
  que se quiere comprar frente a lo que hay en la lonja, precio de la vivienda,
  dinero en la calle y el banco.
- **💚 Bienestar**: medidores de **poder adquisitivo y pobreza**, todos medidos
  en **pescados** para ver la riqueza **real**, sin el efecto de la inflación:
  - Producción por habitante (🐟/año).
  - Riqueza por habitante (ahorro neto en 🐟).
  - Desigualdad (índice de Gini).
  - Tasa de pobreza y muertes por hambre en los últimos 10 años.
- **📊 Pirámide**, **🌳 Árbol genealógico** y **👥 Habitantes**.
- **🏛️ Tesoro público**: ingresos y gastos del año.

## Medidas del gobierno

| Medida | Qué hace | Qué enseña |
|---|---|---|
| 🧾 Impuesto sobre la lonja | % de cada venta va al tesoro | Para gastar hay que recaudar |
| 💰 Pensión / 🧺 Renta universal | Se pagan del tesoro | Financiar con impuestos no genera inflación |
| 🖨️ Imprimir dinero | Si el tesoro no llega, se imprime (si no, se recorta) | Imprimir → **inflación** |
| ♻️ Repartir el superávit | El tesoro reparte lo que le sobra | Dinero parado → **deflación** |
| 🏦 Tipo de interés | Lo pagan los hipotecados, lo cobran los ahorradores | Alto → se ahorra en vez de gastar (menos inflación) pero no se pueden pagar casas; bajo → se gasta más y nadie presta |
| 🎣 Cuota de pesca | Máximo que se puede pescar al año | Tragedia de los comunes: sin cuota, el mar colapsa |
| 👴 Edad de jubilación | A partir de ella no se produce | Menos trabajadores → más hambre |
| 👩‍🏭 Mujer trabajadora | Si no, marisquea para casa | Menos producción, más natalidad |

## El modelo económico

### Pesca y mercado
- El **mar** es un recurso finito que se regenera solo. Si se sobrepesca, se
  captura menos.
- Cada familia **come primero de lo que pesca**; **vende el excedente** en la
  lonja o **compra lo que le falta**. Los viejos viven de sus ahorros, de la
  pensión, de la renta universal o de la ayuda de sus hijos.
- Los pescadores no esquilman el mar para nada: pescan lo que su familia
  necesita y lo que la gente necesitó comprar el año anterior.
- **El precio sale de la oferta y la demanda**: si las familias quieren comprar
  más pescado del que hay en la lonja, sube; si sobra, baja. Quien tiene ahorros
  de sobra gasta parte en pescado extra, así que **más dinero en los bolsillos =
  más demanda = precios más altos**.
- El pescado de la lonja se estropea poco a poco (es perecedero).

### Dinero, tesoro y banco
- El dinero solo **entra** en la isla si el gobierno imprime (o lo traen los
  inmigrantes). Lo demás lo mueve de unos bolsillos a otros.
- El **tesoro** cobra impuestos, vende viviendas públicas y recibe las herencias
  sin heredero. Paga pensiones, renta universal y la obra pública.
- El **banco** guarda los **depósitos** de las familias y los presta como
  hipotecas: es un intermediario, no crea dinero. Solo concede hipotecas que la
  pareja pueda pagar. Si un hipotecado muere y la venta de su casa no cubre la
  deuda, los ahorradores pierden esa parte.
- **Política monetaria**: cada año las familias deciden cuánto de lo que les
  sobra meten en el banco según el tipo de interés (al 0% nada, a partir del 8%
  todo; los depósitos se mueven poco a poco). Lo que está en el banco **sin
  prestar no se gasta**: con tipos altos hay menos dinero en la calle y quien
  tiene ahorros gasta menos, así que los precios se enfrían. Con tipos bajos
  pasa lo contrario. El tipo «normal» es el 5%.
- 🎩 **Rentistas**: una familia cuyo dinero le da para 15 años de comida deja de
  trabajar y vive de sus ahorros y de los intereses del banco (solo si en la lonja
  sobra pescado, porque tiene que comprarlo todo). Si su colchón baja de 8 años o
  pasa hambre, vuelve a trabajar.

### Familias, vivienda y población
- **Economía familiar**: todos los de una casa viven de una bolsa común. Si muere
  el último miembro, su dinero lo heredan los hogares de sus hijos (o el tesoro).
- **Vivienda**: obra pública. Un constructor tarda 5 años en hacer una casa,
  cobrando un jornal del tesoro. Las parejas la compran con hipoteca. Si no
  pueden, se casan igual y **viven con sus padres** hasta conseguirla.
- **Natalidad**: la mujer de la familia, si es fértil (menos de 45 años), puede
  tener hijos si la familia **no es pobre ni pasa hambre**; el ahorro y tener
  casa propia la hacen más probable. Si la isla se acerca a su límite de comida
  (por brazos o por cuota de pesca), nacen menos niños.
- **Hambre**: dentro de una familia comen antes los niños, luego los adultos y
  por último los viejos. Quien pasa 3 años seguidos sin comer lo suficiente muere.
- **Inmigración**: si la isla tiene casas libres, el mar sano y poca pobreza,
  llega gente buscando una vida mejor.

### Lecciones que aparecen solas
- **Inflación monetaria**: imprimir para pagar ayudas dispara los precios, pero
  no crea pescado: la riqueza real no sube.
- **Inflación por escasez**: una sequía o un mar esquilmado suben el precio sin
  que nadie imprima.
- **Política monetaria**: subir los tipos frena la inflación, pero también las
  hipotecas y la natalidad. Bajarlos demasiado pronto la reaviva.
- **Deflación**: si el tesoro acumula sin gastar, falta dinero en la calle.
- **Trampa maltusiana**: si la producción no crece, la población crece hasta el
  límite de la comida y la pobreza persiste. Las ayudas reparten la riqueza,
  pero no la crean.
- **Tragedia de los comunes**: sin cuota de pesca, el mar se agota.

## Estructura del código

| Archivo | Qué hace |
|---|---|
| `index.html` | Estructura y estilos de la interfaz. |
| `engine.js`  | Motor de simulación (economía + demografía). Sin UI. |
| `scenarios.js` | Escenarios guiados: misiones, indicadores clave y lecciones. Sin UI. |
| `app.js`     | Render de la isla, misión, gráficas, pirámide, árbol y controles. |

Todos los parámetros ajustables están en el objeto `CFG` al principio de
`engine.js`.

## Ideas para ampliar

- Un segundo bien (artesanía, servicios) para que la riqueza no sea solo comida.
- Mejoras de productividad (barcas, redes) para escapar de la trampa maltusiana.
- Eventos (tormentas, pesca milagrosa) y objetivos de partida.
- Guardado de partidas y comparación de políticas.
