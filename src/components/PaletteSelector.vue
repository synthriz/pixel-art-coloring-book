<!--
  grade de swatches (quadradinhos coloridos) da paleta gerada
  o usuario clica em um pra selecionar a cor que quer usar pra pintar
  o swatch ativo fica com uma borda   em destaque
-->
<script setup>
import { computed } from 'vue'
import { useColoringStore } from '@/stores/coloring'

const store = useColoringStore()

// defineEmits declara os eventos que esse componente pode emitir pro pai
// nao e estritamente necessario aqui, mas e boa pratica documentar
const emit = defineEmits(['colorSelected'])

// chamado quando o usuario clica num swatch
function selectColor(idx) {
  store.setSelectedColor(idx)   // atualiza a store
  emit('colorSelected', idx)    // avisa o componente pai (App.vue)
}

// decide se o numero no swatch deve ser preto ou branco
// baseado na luminancia percebida da cor de fundo
// a formula pesa o verde mais alto pq o olho humano e mais sensivel a ele
function textColor([r, g, b]) {
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.55 ? '#333333' : '#FAFAFA' // fundo claro = texto escuro, e vice-versa
}
</script>

<template>
  <div class="palette-selector">
    <h3 class="palette-title">Paleta</h3>

    <!--
      v-for cria um botao pra cada cor da paleta
      :key e obrigatorio no v-for — o vue usa pra identificar cada elemento de forma unica
      :style aplica estilos dinamicos com a cor de fundo e a cor do texto
      :class aplica a classe 'active' no swatch selecionado
    -->
    <div class="palette-swatches">
      <button
        v-for="entry in store.palette"
        :key="entry.index"
        class="swatch"
        :class="{ 'swatch--active': store.selectedColor === entry.index }"
        :style="{
          backgroundColor: entry.hex,
          color: textColor(entry.rgb),
        }"
        :title="`Cor ${entry.index + 1}: ${entry.hex}`"
        @click="selectColor(entry.index)"
      >
        {{ entry.index + 1 }} <!-- mostra 1-based pra ser mais intuitivo pro usuario -->
      </button>
    </div>
  </div>
</template>

<style scoped>
.palette-selector {
  user-select: none; /* evita selecionar o texto dos numeros ao clicar rapido */
}
.palette-title {
  font-size: 0.9rem;
  font-weight: 700;
  margin: 0 0 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #555;
}
.palette-swatches {
  display: grid;
  grid-template-columns: repeat(4, 1fr); /* 4 colunas, se adapta ao espaco disponivel */
  gap: 4px;
}
.swatch {
  aspect-ratio: 1; /* mantem o quadrado independente do tamanho */
  border: 2px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.1s, border-color 0.1s;
}
.swatch:hover {
  transform: scale(1.08);
}
.swatch--active {
  border-color: #222;
  box-shadow: 0 0 0 2px #12743e; /* anel   indicando selecao */
  transform: scale(1.12);
}
</style>
