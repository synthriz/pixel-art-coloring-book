<!--
  componente principal de pintura => e aqui que tudo se junta
  ele hospeda o <canvas>, gerencia zoom/pan e conecta os composables de render e interacao
-->
<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useColoringStore } from '@/stores/coloring'
import { useCanvas } from '@/composables/useCanvas'
import { useMousePaint } from '@/composables/useMousePaint'
import ProgressBar from './ProgressBar.vue'

// quantos pixels na tela cada celula do grid ocupa
// fixo em 24px => o zoom e feito por transformacao css, nao mudando esse valor
const DISPLAY_CELL_SIZE = 24

const store = useColoringStore()

// ref pro elemento <canvas> => necessario pra passar pro useCanvas e useMousePaint
const canvasRef = ref(null)

// ref pro div "viewport" => necessario pra calcular a posicao do mouse no zoom
const viewportRef = ref(null)

// = estado de zoom e pan ===========================
// zoom: multiplicador de escala (1 = 100%, 2 = 200%, etc.)
// panX/panY: deslocamento em pixels (0,0 = canto superior esquerdo)
const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)
const MIN_ZOOM = 0.15 // 15% => limite minimo pra nao sumir
const MAX_ZOOM = 4    // 400% => limite maximo
const ZOOM_STEP = 0.12 // incremento por scroll

// modo pan => ativo quando espaco esta pressionado
// e uma ref porque o useMousePaint precisa ler ela de forma reativa
const isPanMode = ref(false)
let spaceDown = false // controle interno nao-reativo (nao precisa re-renderizar a tela)

// = inicializa os composables ========================─

// useCanvas: engine de render => expoe init, markDirty, scheduleFullRedraw, destroy
const { init, markDirty, scheduleFullRedraw, destroy } = useCanvas(canvasRef, DISPLAY_CELL_SIZE)

// useMousePaint: eventos de interacao => expoe attach e detach
// passamos tudo que o composable precisa: canvas, callback, tamanho, zoom, modo pan e refs de pan
const { attach, detach } = useMousePaint(
  canvasRef,
  markDirty,      // callback chamado quando uma celula muda => avisa o canvas pra redesenhar
  DISPLAY_CELL_SIZE,
  zoom,           // ref de zoom pra corrigir coordenadas do mouse
  isPanMode,      // ref do modo pan pra nao pintar enquanto esta movendo
  { panX, panY }, // refs de deslocamento pra o composable atualizar durante o pan
)

// = ciclo de vida do componente =======================─

// onMounted: executado depois que o componente e inserido no dom
// aqui o canvas ja existe, entao podemos inicializar tudo
onMounted(() => {
  init()    // inicializa o contexto 2d do canvas
  attach()  // registra os eventos de mouse/toque no canvas
  window.addEventListener('keydown', onKeyDown) // escuta espaco no nivel da janela
  window.addEventListener('keyup', onKeyUp)
})

// onUnmounted: executado quando o componente e removido do dom (ex: voltou pra tela de setup)
// importante limpar tudo pra nao vazar memoria ou ter listeners fantasma
onUnmounted(() => {
  detach()   // remove os eventos do canvas
  destroy()  // cancela o requestAnimationFrame pendente
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
})

// = watchers =================================
// watch observa uma propriedade reativa e executa um callback quando ela muda

// quando o grid muda (novo puzzle gerado pelo worker):
// reseta o zoom/pan e redesenha tudo
watch(() => store.targetGrid, () => {
  zoom.value = 1
  panX.value = 0
  panY.value = 0
  scheduleFullRedraw()
})

// quando a cor selecionada muda, redesenha tudo pra atualizar os highlights amarelos
watch(() => store.selectedColor, () => scheduleFullRedraw())

// quando solveAll() e chamado, o paintRevision incrementa
// como o Uint8Array nao e reativo pelo vue, usamos esse contador como sinal
watch(() => store.paintRevision, () => scheduleFullRedraw())

// = teclado =================================─

function onKeyDown(e) {
  // espaco ativa o modo pan => !e.repeat evita repetir enquanto segura
  if (e.code === 'Space' && !e.repeat) {
    spaceDown = true
    isPanMode.value = true
    if (canvasRef.value) canvasRef.value.style.cursor = 'grab'
    e.preventDefault() // evita o browser rolar a pagina com espaco
  }
}

function onKeyUp(e) {
  if (e.code === 'Space') {
    spaceDown = false
    isPanMode.value = false
    if (canvasRef.value) canvasRef.value.style.cursor = 'crosshair'
  }
}

// = zoom via scroll do mouse =========================

function onWheel(e) {
  e.preventDefault()

  // scroll pra cima = zoom in (delta negativo), pra baixo = zoom out
  const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP
  const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom.value + delta))

  // zoom centrado no cursor do mouse:
  // calculamos quanto o canvas precisa se deslocar pra que o ponto embaixo do cursor
  // continue no mesmo lugar depois do zoom
  const rect = viewportRef.value.getBoundingClientRect()
  const mouseX = e.clientX - rect.left // posicao do mouse relativa ao viewport
  const mouseY = e.clientY - rect.top

  const scale = newZoom / zoom.value // fator de mudanca
  // ajusta o pan pra manter o ponto sob o cursor fixo
  panX.value = mouseX - scale * (mouseX - panX.value)
  panY.value = mouseY - scale * (mouseY - panY.value)
  zoom.value = newZoom
}

// = helpers de navegacao ===========================

// volta pra 100% sem deslocamento
function resetView() {
  zoom.value = 1
  panX.value = 0
  panY.value = 0
}

// ajusta o zoom pra o canvas inteiro caber no viewport (sem cortar)
// centraliza ele horizontalmente e verticalmente
function fitToViewport() {
  if (!canvasRef.value || !viewportRef.value) return
  const vw = viewportRef.value.clientWidth
  const vh = viewportRef.value.clientHeight
  const cw = canvasRef.value.width  // largura real do canvas em pixels
  const ch = canvasRef.value.height
  if (!cw || !ch) return

  // pega o menor fator que faz o canvas caber, limitado a 1 (nao amplia, so reduz)
  const scale = Math.min(vw / cw, vh / ch, 1)
  zoom.value = scale

  // centraliza o canvas no viewport
  panX.value = (vw - cw * scale) / 2
  panY.value = (vh - ch * scale) / 2
}
</script>

<template>
  <div class="canvas-container">

    <!-- barra de controles de zoom/pan -->
    <div class="view-controls">
      <!-- botoes de zoom in/out pelos botoes => cada clique e 3x o ZOOM_STEP -->
      <button class="btn-view" @click="zoom = Math.min(MAX_ZOOM, zoom + ZOOM_STEP * 3)">+</button>
      <span class="zoom-label">{{ Math.round(zoom * 100) }}%</span>
      <button class="btn-view" @click="zoom = Math.max(MIN_ZOOM, zoom - ZOOM_STEP * 3)">−</button>
      <button class="btn-view" @click="resetView" title="100%">1:1</button>
      <button class="btn-view" @click="fitToViewport" title="Encaixar">⊡</button>
      <span class="pan-hint">Scroll = zoom · Espaço+drag ou botão do meio = mover</span>
    </div>

    <!--
      viewport: a janela que mostra o canvas
      overflow: hidden corta o canvas quando ele e maior que o viewport
      o evento @wheel.prevent captura o scroll do mouse pra fazer zoom
    -->
    <div
      ref="viewportRef"
      class="canvas-viewport"
      @wheel.prevent="onWheel"
    >
      <!--
        camada de transformacao css
        aqui que o zoom e pan sao aplicados via transform
        transformOrigin: '0 0' faz o zoom partir do canto superior esquerdo
        (ajustamos o pan manualmente pra compensar e fazer zoom no cursor)
        will-change: transform avisa o browser que essa div vai animar, melhorando a performance
      -->
      <div
        class="canvas-transform-layer"
        :style="{
          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }"
      >
        <!-- o canvas em si => os composables gerenciam tudo que acontece nele -->
        <canvas ref="canvasRef" class="coloring-canvas" />
      </div>
    </div>

    <!-- barra de progresso abaixo do canvas -->
    <ProgressBar :value="store.progress" />

  </div>
</template>

<style scoped>
.canvas-container {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0; /* evita que o flex item estoure o container pai */
  height: 100%;
}
.view-controls {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  flex-shrink: 0; /* nao encolhe quando o espaco for curto */
}
.btn-view {
  padding: 0.2rem 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #FAFAFA;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  min-width: 28px;
  text-align: center;
}
.btn-view:hover {
  background: #f0f0f0;
}
.zoom-label {
  font-size: 0.8rem;
  color: #555;
  min-width: 36px;
  text-align: center;
}
.pan-hint {
  font-size: 0.72rem;
  color: #aaa;
  margin-left: 0.4rem;
}
.canvas-viewport {
  flex: 1; /* ocupa todo o espaco vertical disponivel */
  position: relative;
  overflow: hidden; /* corta o que sair do viewport */
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #e8e8e8;
  min-height: 200px;
}
.canvas-transform-layer {
  position: absolute;
  top: 0;
  left: 0;
  will-change: transform; /* hint pro browser otimizar a animacao de transform */
}
.coloring-canvas {
  display: block;
  cursor: crosshair;
  touch-action: none; /* evita o browser fazer scroll/zoom nativo com o toque */
  image-rendering: pixelated; /* renderizacao nitida sem suavizacao pra pixel art */
}
</style>
