// composable que gerencia os eventos de mouse e toque no canvas
// traduz coordenadas de tela (pixels do monitor) em indices de celulas do grid
// tambem gerencia o modo pan (mover o canvas) quando espaco esta pressionado
// e o pinch-to-zoom com dois dedos no mobile

import { useColoringStore } from "@/stores/coloring";

// limites de zoom => espelhados do ColoringCanvas.vue pra usar no pinch
const MIN_ZOOM = 0.15;
const MAX_ZOOM = 4;

export function useMousePaint(
  canvasRef, // referencia ao elemento <canvas>
  onCellPainted, // callback chamado quando uma celula muda => passa o indice pra marcar como dirty
  displayCellSize = 24, // tamanho visual de cada celula em pixels
  zoomRef = null, // zoom atual => necessario pra calcular a posicao correta com transformacao css
  isPanModeRef = null, // true quando espaco esta pressionado (modo pan no desktop)
  panRefs = null, // { panX, panY } => refs do deslocamento do canvas
  viewportRef = null, // referencia ao div viewport => necessario pro pinch zoom centrado
) {
  const store = useColoringStore();

  // = estado de pintura e pan ========================

  let isPainting = false; // true enquanto o usuario esta pintando com 1 dedo/mouse
  let isPanning = false; // true enquanto o usuario esta arrastando pra mover (espaco+drag ou botao do meio)
  let lastPaintedIdx = -1; // ultimo indice pintado durante um arrasto (evita repintar a mesma celula)

  // pendingPaint: posicao do toque inicial aguardando o threshold de movimento
  // resolve dois problemas:
  // 1) pinch acidental => se um segundo dedo chegar antes do threshold, cancela sem pintar nada
  // 2) tap vs drag => so confirma a pintura depois de mover um pouco (ou ao levantar o dedo)
  let pendingPaint = null; // { x, y } ou null
  const PAINT_THRESHOLD = 6; // pixels que o dedo precisa mover antes de comecar a pintar

  // variaveis de pan => guardam o ponto de inicio do arrasto
  let panStartX = 0;
  let panStartY = 0;
  let panOriginX = 0; // valor de panX no momento que o arrasto comecou
  let panOriginY = 0;

  // = estado de pinch (zoom com dois dedos) ==========

  // map de ponteiros ativos: pointerId => { x, y }
  // cada dedo tem um id unico atribuido pelo browser
  const activePointers = new Map();

  let isPinching = false; // true quando ha 2 dedos no canvas ao mesmo tempo
  let pinchLastDist = 0; // distancia entre os dois dedos no evento anterior
  let pinchLastMidX = 0; // ponto medio entre os dois dedos (X) no evento anterior
  let pinchLastMidY = 0; // ponto medio entre os dois dedos (Y) no evento anterior

  // = conversao de coordenadas =======================

  // converte a posicao do mouse/dedo (em pixels do monitor) para o indice da celula no grid
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

  // = logica de pintura ==========================

  // tenta pintar a celula na posicao do mouse/dedo
  // isDrag indica se e um movimento de arrasto (true) ou um clique/tap novo (false)
  function tryPaint(clientX, clientY, isDrag = false) {
    if (!store.hasGrid || store.selectedColor === null) return;

    const cellIdx = getCellIndex(clientX, clientY);
    if (cellIdx === -1) return;

    // durante o arrasto, pula se a celula ja foi pintada nesse mesmo gesto
    // isso evita redesenhar a mesma celula dezenas de vezes enquanto o dedo fica em cima
    // no clique/tap (isDrag=false), nao deduplica => permite clicar na mesma celula pra apagar
    if (isDrag && cellIdx === lastPaintedIdx) return;

    lastPaintedIdx = cellIdx;

    const changed = store.paintCell(cellIdx); // tenta pintar na store
    if (changed) onCellPainted(cellIdx); // se mudou, avisa o canvas pra redesenhar
  }

  // = math do pinch-zoom ============================

  // atualiza zoom e pan com base no movimento dos dois dedos
  // scaleFactor: quanto o zoom deve mudar (dist_atual / dist_anterior)
  // midX/midY: ponto medio dos dois dedos em coordenadas do viewport
  // deltaMidX/deltaMidY: quanto o ponto medio se moveu desde o evento anterior
  function applyPinch(scaleFactor, midX, midY, deltaMidX, deltaMidY) {
    if (!zoomRef || !panRefs) return;

    // clamp no scaleFactor pra evitar saltos quando os dedos estao muito proximos
    const clampedScale = Math.min(Math.max(scaleFactor, 0.85), 1.15);
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomRef.value * clampedScale));

    // zoom centrado no ponto medio dos dedos
    // mesma formula do onWheel em ColoringCanvas.vue
    // o ponto embaixo dos dedos fica fixo enquanto o zoom muda
    let originX = midX;
    let originY = midY;

    if (viewportRef && viewportRef.value) {
      const rect = viewportRef.value.getBoundingClientRect();
      originX = midX - rect.left; // posicao relativa ao viewport
      originY = midY - rect.top;
    }

    const actualScale = newZoom / zoomRef.value;
    panRefs.panX.value = originX - actualScale * (originX - panRefs.panX.value);
    panRefs.panY.value = originY - actualScale * (originY - panRefs.panY.value);
    zoomRef.value = newZoom;

    // pan pelo movimento do ponto medio dos dedos (arrastar com dois dedos)
    panRefs.panX.value += deltaMidX;
    panRefs.panY.value += deltaMidY;
  }

  // = handlers de evento ==========================

  function onPointerDown(e) {
    e.preventDefault(); // evita selecao de texto e outros comportamentos padrao do browser

    // registra esse ponteiro no map
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // setPointerCapture: o canvas continua recebendo eventos desse ponteiro
    // mesmo se o dedo/mouse sair da area do elemento
    // importante chamar pra todos os ponteiros, nao so durante o pan
    if (canvasRef.value) {
      canvasRef.value.setPointerCapture(e.pointerId);
    }

    // = dois dedos: entra no modo pinch ==============
    if (activePointers.size >= 2) {
      // cancela qualquer pintura ou pan que estava em andamento
      // pendingPaint = null garante que nao vai pintar nada ao sair do pinch
      isPainting = false;
      isPanning = false;
      pendingPaint = null;
      lastPaintedIdx = -1;

      // inicia o pinch: salva distancia e ponto medio iniciais
      isPinching = true;
      const [p1, p2] = [...activePointers.values()];
      pinchLastDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      pinchLastMidX = (p1.x + p2.x) / 2;
      pinchLastMidY = (p1.y + p2.y) / 2;
      return;
    }

    // = um dedo/mouse: pan ou pintura ================

    const inPanMode = isPanModeRef && isPanModeRef.value; // espaco pressionado?
    const isMiddle = e.button === 1; // botao do meio do mouse?
    const shouldPan = isMiddle || inPanMode; // vai fazer pan?

    if (shouldPan) {
      // inicia o pan => registra o ponto de origem
      isPanning = true;
      panStartX = e.clientX;
      panStartY = e.clientY;
      panOriginX = panRefs ? panRefs.panX.value : 0;
      panOriginY = panRefs ? panRefs.panY.value : 0;
      if (canvasRef.value) canvasRef.value.style.cursor = "grabbing";
      return;
    }

    // no desktop, ignora botoes que nao sejam o esquerdo
    // no touch (pointerType === 'touch'), button sempre e 0, entao passa direto
    if (e.button !== 0 && e.pointerType !== "touch") return;

    // inicia pintura => guarda a posicao inicial mas NAO pinta ainda
    // so vai pintar quando o dedo mover alem do threshold, ou ao levantar (tap)
    // isso evita pintura acidental durante pinch: se um segundo dedo chegar
    // antes do threshold, o pendingPaint e cancelado sem pintar nada
    isPainting = true;
    pendingPaint = { x: e.clientX, y: e.clientY };
    lastPaintedIdx = -1;
  }

  function onPointerMove(e) {
    // atualiza a posicao desse ponteiro no map
    if (!activePointers.has(e.pointerId)) return;
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // = modo pinch: dois dedos ========================
    if (isPinching && activePointers.size === 2) {
      const [p1, p2] = [...activePointers.values()];

      // distancia atual entre os dois dedos
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      // ponto medio atual entre os dois dedos
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;

      // so aplica se a distancia anterior for valida e razoavel (evita divisao por zero e saltos)
      if (pinchLastDist > 10) {
        // scaleFactor > 1 = dedos afastando = zoom in
        // scaleFactor < 1 = dedos juntando  = zoom out
        const scaleFactor = dist / pinchLastDist;
        const deltaMidX = midX - pinchLastMidX; // quanto o centro se moveu em X
        const deltaMidY = midY - pinchLastMidY; // quanto o centro se moveu em Y

        applyPinch(scaleFactor, midX, midY, deltaMidX, deltaMidY);
      }

      // salva pra proxima comparacao
      pinchLastDist = dist;
      pinchLastMidX = midX;
      pinchLastMidY = midY;
      return;
    }

    // = modo pan: espaco+arrasto ou botao do meio ====
    if (isPanning && panRefs) {
      panRefs.panX.value = panOriginX + (e.clientX - panStartX);
      panRefs.panY.value = panOriginY + (e.clientY - panStartY);
      return;
    }

    // = modo pintura: arrasto normal ================
    if (!isPainting) return;

    // se ainda esta aguardando o threshold, verifica se o dedo moveu o suficiente
    if (pendingPaint) {
      const dx = e.clientX - pendingPaint.x;
      const dy = e.clientY - pendingPaint.y;
      if (Math.hypot(dx, dy) < PAINT_THRESHOLD) return; // ainda nao moveu o suficiente

      // threshold atingido: pinta a celula inicial e libera o drag normal
      tryPaint(pendingPaint.x, pendingPaint.y, false);
      pendingPaint = null;
    }

    tryPaint(e.clientX, e.clientY, true); // true = e um arrasto, deduplica celulas repetidas
  }

  function onPointerUp(e) {
    // remove esse ponteiro do map
    activePointers.delete(e.pointerId);

    // = saindo do pinch ==============================
    if (isPinching) {
      if (activePointers.size < 2) {
        // voltou pra 1 ou 0 dedos: encerra o pinch
        isPinching = false;
        pinchLastDist = 0;

        // nao retoma pintura automaticamente quando um dedo levanta do pinch
        // o usuario precisa tocar de novo pra pintar => evita pintura acidental
        isPainting = false;
        lastPaintedIdx = -1;
      }
      return;
    }

    // = saindo do pan ================================
    if (isPanning) {
      isPanning = false;
      const inPanMode = isPanModeRef && isPanModeRef.value;
      if (canvasRef.value) {
        canvasRef.value.style.cursor = inPanMode ? "grab" : "crosshair";
      }
    }

    // tap rapido: o dedo levantou sem ter atingido o threshold de movimento
    // pinta a celula do toque original (comportamento de clique/tap normal)
    if (isPainting && pendingPaint) {
      tryPaint(pendingPaint.x, pendingPaint.y, false);
    }

    // encerra pintura
    pendingPaint = null;
    isPainting = false;
    lastPaintedIdx = -1;
  }

  // pointercancel: o browser cancelou o gesto (ex: notificacao apareceu por cima)
  // trata igual ao pointerup pra limpar tudo corretamente
  function onPointerCancel(e) {
    onPointerUp(e);
  }

  // pointerleave: o ponteiro saiu do canvas
  // com setPointerCapture ativo, esse evento nao dispara durante captura
  // mas se disparar sem captura (ex: mouse sem botao pressionado saindo), limpa o estado
  function onPointerLeave(e) {
    if (!activePointers.has(e.pointerId)) return; // nao estava rastreando esse ponteiro
    onPointerUp(e);
  }

  // = registrar / remover eventos =====================

  // registra todos os listeners no elemento canvas
  // chamado quando o componente e montado
  function attach() {
    const el = canvasRef.value;
    if (!el) return;
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerCancel);
    el.addEventListener("pointerleave", onPointerLeave);
    // sem touchstart/touchmove/touchend:
    // a Pointer Events API ja cobre mouse, caneta e toque numa interface unificada
  }

  // remove todos os listeners => chamado quando o componente e desmontado
  function detach() {
    const el = canvasRef.value;
    if (!el) return;
    el.removeEventListener("pointerdown", onPointerDown);
    el.removeEventListener("pointermove", onPointerMove);
    el.removeEventListener("pointerup", onPointerUp);
    el.removeEventListener("pointercancel", onPointerCancel);
    el.removeEventListener("pointerleave", onPointerLeave);
  }

  return { attach, detach };
}
