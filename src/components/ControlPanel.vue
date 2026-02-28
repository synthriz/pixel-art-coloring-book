<!--
  painel de configuracoes antes de gerar o puzzle
  contem o slider de tamanho de celula, os botoes de quantidade de cores
  e o botao de gerar que dispara o worker
-->
<script setup>
import { computed } from 'vue'
import { useColoringStore } from '@/stores/coloring'
import { useWorker } from '@/composables/useWorker'

const store = useColoringStore()
const { process } = useWorker() // pega so a funcao process do composable

// opcoes disponiveis para tamanho da paleta
const paletteSizeOptions = [6, 8, 12, 16]

// percentual do slider pra preencher a trilha no WebKit via CSS custom property
const sliderPct = computed(() =>
  ((store.cellSize - 4) / (32 - 4)) * 100
)

// chamada quando o usuario clica em "Gerar Puzzle"
async function generate() {
  if (!store.sourceFile) return

  // criamos um ImageBitmap novo a partir do arquivo original
  // fazemos isso porque o bitmap anterior pode ter sido transferido ao worker (e "destruido")
  // o arquivo File original permanece intacto na store, entao conseguimos recriar
  const bitmap = await createImageBitmap(store.sourceFile)

  // manda pro worker processar — isso muda a fase pra 'processing' e mostra o spinner
  process(bitmap)
}
</script>

<template>
  <div class="control-panel glass-surface">

    <!-- slider: tamanho da celula em pixels da imagem original -->
    <!-- quanto menor o valor, mais celulas, mais detalhe mas mais dificil de pintar -->
    <div class="control-row">
      <label class="control-label">
        Tamanho da célula
        <span class="control-value">{{ store.cellSize }}px</span>
      </label>
      <input
        type="range"
        min="4"
        max="32"
        step="2"
        :value="store.cellSize"
        @input="store.setCellSize($event.target.value)"
        class="slider"
        :style="{ '--slider-pct': sliderPct + '%' }"
      />
      <div class="slider-hints">
        <span>mais detalhe</span><span>menos detalhe</span>
      </div>
    </div>

    <!-- botoes: quantidade de cores da paleta -->
    <!-- v-for gera um botao pra cada opcao -->
    <!-- :class aplica a classe 'active' no botao da opcao selecionada -->
    <div class="control-row">
      <label class="control-label">Cores da paleta</label>
      <div class="palette-size-options">
        <button
          v-for="n in paletteSizeOptions"
          :key="n"
          class="btn-option"
          :class="{ 'btn-option--active': store.paletteSize === n }"
          @click="store.setPaletteSize(n)"
        >
          {{ n }}
        </button>
      </div>
    </div>

    <!-- botao de gerar q fica desabilitado se nao tem imagem ou esta processando -->
    <button
      class="btn-primary btn-generate"
      :disabled="!store.sourceBitmap || store.phase === 'processing'"
      @click="generate"
    >
      <!-- v-if/v-else mostra texto diferente dependendo do estado -->
      <span v-if="store.phase === 'processing'">Processando…</span>
      <span v-else>Gerar Puzzle</span>
    </button>
  </div>
</template>

<!-- todo o css desse componente foi movido pra base.css -->
