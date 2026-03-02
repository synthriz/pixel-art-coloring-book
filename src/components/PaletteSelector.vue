<!--
  grade de swatches (quadradinhos coloridos) da paleta gerada
  o usuario clica em um pra selecionar a cor que quer usar pra pintar
  o swatch ativo fica com uma borda em destaque
  quando uma cor e completada, aparece um check e o swatch fica com opacidade menor
-->
<script setup>
import { useColoringStore } from "@/stores/coloring";
import { Check } from "lucide-vue-next";

const store = useColoringStore();

// defineEmits declara os eventos que esse componente pode emitir pro pai
const emit = defineEmits(["colorSelected"]);

// chamado quando o usuario clica num swatch
function selectColor(idx) {
  store.setSelectedColor(idx); // atualiza a store
  emit("colorSelected", idx); // avisa o componente pai (App.vue)
}

// decide se o numero no swatch deve ser preto ou branco
// baseado na luminancia percebida da cor de fundo
// a formula pesa o verde mais alto pq o olho humano e mais sensivel a ele
function textColor([r, g, b]) {
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? "#333333" : "#FAFAFA";
}
</script>

<template>
  <div class="palette-selector">
    <h3 class="palette-title">Paleta</h3>

    <!--
      v-for cria um botao pra cada cor da paleta
      :class aplica classes dinamicamente:
        swatch--active = cor selecionada atualmente
        swatch--done   = cor ja completada (todas celulas pintadas)
    -->
    <div class="palette-swatches">
      <button
        v-for="entry in store.palette"
        :key="entry.index"
        class="swatch"
        :class="{
          'swatch--active': store.selectedColor === entry.index,
          'swatch--done': store.colorDone[entry.index],
        }"
        :style="{
          backgroundColor: entry.hex,
          color: textColor(entry.rgb),
        }"
        :title="`Cor ${entry.index + 1}: ${entry.hex}`"
        @click="selectColor(entry.index)"
      >
        <!--
          se a cor esta completa, mostra o icone de check
          se nao, mostra o numero da cor (1-based, mais intuitivo)
        -->
        <Check v-if="store.colorDone[entry.index]" class="swatch-check" />
        <span v-else>{{ entry.index + 1 }}</span>
      </button>
    </div>
  </div>
</template>

<!-- todo o css desse componente foi movido pra base.css -->
