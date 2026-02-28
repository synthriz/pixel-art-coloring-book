// composable que gerencia os eventos de mouse e toque no canvas
// traduz coordenadas de tela (pixels do monitor) em indices de celulas do grid
// tambem gerencia o modo pan (mover o canvas) quando espaco esta pressionado

import { useColoringStore } from "@/stores/coloring";

export function useMousePaint(
  canvasRef, // referencia ao elemento <canvas>
  onCellPainted, // callback chamado quando uma celula muda => passa o indice pra marcar como dirty
  displayCellSize = 24, // tamanho visual de cada celula em pixels
  zoomRef = null, // zoom atual => necessario pra calcular a posicao correta com transformacao css
  isPanModeRef = null, // true quando espaco esta pressionado (modo pan)
  panRefs = null, // { panX, panY } => refs do deslocamento do canvas
) {
  const store = useColoringStore();

  let isPainting = false; // true enquanto o usuario esta com o botao pressionado pintando
  let isPanning = false; // true enquanto o usuario esta arrastando pra mover o canvas
  let lastPaintedIdx = -1; // ultimo indice pintado durante um arrasto (pra evitar repintar a mesma celula)

  // variaveis de pan => guardam o ponto de inicio do arrasto
  let panStartX = 0;
  let panStartY = 0;
  let panOriginX = 0; // valor de panX no momento que o arrasto comecou
  let panOriginY = 0;

  // = conversao de coordenadas =======================

  // converte a posicao do mouse (em pixels do monitor) para o indice da celula no grid
  // isso e complicado porque o canvas pode estar com zoom e deslocamento css aplicados
  function getCellIndex(clientX, clientY) {
    const canvas = canvasRef.value;
    if (!canvas) return -1;

    // getBoundingClientRect retorna a posicao e tamanho do canvas na tela
    // quando ha zoom css, o rect ja vem redimensionado
    const rect = canvas.getBoundingClientRect();

    // o zoom css escala o canvas visualmente mas nao muda os pixels internos
    // entao a gente precisa dividir pelo zoom pra converter de "pixels de tela" pra "pixels do canvas"
    const currentZoom = zoomRef ? zoomRef.value : 1;

    const x = (clientX - rect.left) / currentZoom; // posicao x dentro do canvas real
    const y = (clientY - rect.top) / currentZoom; // posicao y dentro do canvas real

    // converte pixels do canvas pra indices de celula
    const col = Math.floor(x / displayCellSize);
    const row = Math.floor(y / displayCellSize);

    // se clicou fora do grid, retorna -1
    if (col < 0 || col >= store.gridCols || row < 0 || row >= store.gridRows)
      return -1;

    // indice flat: col + row * gridCols
    // ex: celula na coluna 3, linha 2 de um grid de 10 colunas = 3 + 2*10 = 23
    return col + row * store.gridCols;
  }

  // = logica de pintura ==========================─

  // tenta pintar a celula na posicao do mouse
  // isDrag indica se e um movimento de arrasto (true) ou um clique novo (false)
  function tryPaint(clientX, clientY, isDrag = false) {
    if (!store.hasGrid || store.selectedColor === null) return;

    const cellIdx = getCellIndex(clientX, clientY);
    if (cellIdx === -1) return;

    // durante o arrasto, pula se a celula ja foi pintada nesse mesmo gesto
    // isso evita redesenhar a mesma celula dezenas de vezes enquanto o mouse fica em cima
    // no clique (isDrag=false), nao deduplica => permite clicar na mesma celula pra apagar
    if (isDrag && cellIdx === lastPaintedIdx) return;

    lastPaintedIdx = cellIdx;

    const changed = store.paintCell(cellIdx); // tenta pintar na store
    if (changed) onCellPainted(cellIdx); // se mudou, avisa o canvas pra redesenhar
  }

  // = handlers de evento ==========================

  function onPointerDown(e) {
    e.preventDefault(); // evita selecao de texto e outros comportamentos padrao do browser

    const inPanMode = isPanModeRef && isPanModeRef.value; // espaco pressionado?
    const isMiddle = e.button === 1; // botao do meio?
    const shouldPan = isMiddle || inPanMode; // vai fazer pan?

    if (shouldPan) {
      // inicia o pan => registra o ponto de origem
      isPanning = true;
      panStartX = e.clientX;
      panStartY = e.clientY;
      panOriginX = panRefs ? panRefs.panX.value : 0;
      panOriginY = panRefs ? panRefs.panY.value : 0;
      // setPointerCapture faz o canvas continuar recebendo eventos mesmo se o mouse sair dele
      canvasRef.value.setPointerCapture(e.pointerId);
      canvasRef.value.style.cursor = "grabbing";
      return;
    }

    // clique com botao esquerdo = pintura
    if (e.button !== 0) return;
    isPainting = true;
    lastPaintedIdx = -1; // reseta pra permitir pintar a mesma celula de novo
    tryPaint(e.clientX, e.clientY, false); // false = clique novo, nao e arrasto
  }

  function onPointerMove(e) {
    if (isPanning && panRefs) {
      // atualiza o deslocamento do canvas baseado em quanto o mouse moveu
      panRefs.panX.value = panOriginX + (e.clientX - panStartX);
      panRefs.panY.value = panOriginY + (e.clientY - panStartY);
      return;
    }

    if (!isPainting) return;
    tryPaint(e.clientX, e.clientY, true); // true = e um arrasto, deduplica celulas repetidas
  }

  function onPointerUp(e) {
    if (isPanning) {
      isPanning = false;
      // volta o cursor pro correto dependendo se espaco ainda esta pressionado
      const inPanMode = isPanModeRef && isPanModeRef.value;
      canvasRef.value.style.cursor = inPanMode ? "grab" : "crosshair";
    }
    isPainting = false;
    lastPaintedIdx = -1;
  }

  // handlers de toque (mobile) q funcionam igual ao pointer mas com touch events
  function onTouchStart(e) {
    isPainting = true;
    lastPaintedIdx = -1;
    const t = e.touches[0]; // pega o primeiro dedo
    tryPaint(t.clientX, t.clientY, false);
  }

  function onTouchMove(e) {
    if (!isPainting) return;
    const t = e.touches[0];
    tryPaint(t.clientX, t.clientY, true);
  }

  function onTouchEnd() {
    isPainting = false;
    lastPaintedIdx = -1;
  }

  // = registrar / remover eventos =====================─

  // registra todos os listeners no elemento canvas
  // chamado quando o componente e montado
  function attach() {
    const el = canvasRef.value;
    if (!el) return;
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointerleave", onPointerUp); // trata sair do canvas como soltar o botao
    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false }); // passive: false pra poder chamar preventDefault
    el.addEventListener("touchend", onTouchEnd);
  }

  // remove todos os listeners => chamado quando o componente e desmontado
  function detach() {
    const el = canvasRef.value;
    if (!el) return;
    el.removeEventListener("pointerdown", onPointerDown);
    el.removeEventListener("pointermove", onPointerMove);
    el.removeEventListener("pointerup", onPointerUp);
    el.removeEventListener("pointerleave", onPointerUp);
    el.removeEventListener("touchstart", onTouchStart);
    el.removeEventListener("touchmove", onTouchMove);
    el.removeEventListener("touchend", onTouchEnd);
  }

  return { attach, detach };
}
