<!--
  painel de configuracoes antes de gerar o puzzle
  contem o slider de tamanho de celula, os botoes de quantidade de cores
  e o botao de gerar que dispara o worker
-->
<script setup>
import { useColoringStore } from '@/stores/coloring'
import { useWorker } from '@/composables/useWorker'

const store = useColoringStore()
const { process } = useWorker() // pega so a funcao process do composable

// opcoes disponiveis para tamanho da paleta
const paletteSizeOptions = [6, 8, 12, 16]

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
  <div class="control-panel">

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

<style scoped>
.control-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.control-row {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.control-label {
  font-weight: 600;
  font-size: 0.9rem;
  display: flex;
  justify-content: space-between;
}
.control-value {
  font-weight: 400;
  color: #555;
}
.slider {
  width: 100%;
  accent-color: #12743e;
}
.slider-hints {
  display: flex;
  justify-content: space-between;
  font-size: 0.72rem;
  color: #999;
}
.palette-size-options {
  display: flex;
  gap: 0.4rem;
}
.btn-option {
  padding: 0.3rem 0.7rem;
  border: 2px solid #ccc;
  border-radius: 4px;
  background: #FAFAFA;
  cursor: pointer;
  font-size: 0.9rem;
  transition: border-color 0.15s, background 0.15s;
}
.btn-option--active {
  border-color: #12743e;
  background: #eef4ff;
  font-weight: 700;
}
.btn-generate {
  margin-top: 0.5rem;
  padding: 0.7rem 1.2rem;
  font-size: 1rem;
}
</style>
