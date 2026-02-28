<!--
  barra de progresso que mostra quantas celulas foram pintadas corretamente
  recebe um valor de 0 a 1 como prop e exibe em percentual
-->
<script setup>
import { computed } from 'vue'

// defineProps declara as props que esse componente aceita do pai
const props = defineProps({
  value: {
    type: Number,
    default: 0, // se o pai nao passar nada, comeca em 0
  },
})

// computed = valor calculado que se atualiza automaticamente quando props.value muda
// converte 0.75 -> 75, limita a 100 pra nao quebrar o layout
const pct = computed(() => Math.min(100, Math.round(props.value * 100)))
</script>

<template>
  <div class="progress-wrapper">

    <!-- trilha cinza de fundo -->
    <div class="progress-track">
      <!-- barra colorida que cresce conforme o progresso — :style aplica a largura dinamicamente -->
      <div class="progress-fill" :style="{ width: pct + '%' }" />
    </div>

    <div class="progress-labels">
      <span class="progress-pct">{{ pct }}% completo</span>
      <!-- v-if so mostra a mensagem de parabens quando chega a 100% -->
      <span v-if="pct === 100" class="progress-done">Vapo!</span>
    </div>

  </div>
</template>

<style scoped>
.progress-wrapper {
  padding: 0.5rem 0;
}
.progress-track {
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden; /* garante que a barra nao vaze fora da trilha */
}
.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #12743e, #34c77a); /*   -> verde */
  border-radius: 4px;
  transition: width 0.3s ease; /* anima suavemente quando o progresso muda */
}
.progress-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 0.25rem;
  font-size: 0.8rem;
}
.progress-pct {
  color: #555;
}
.progress-done {
  color: #34c77a;
  font-weight: 700;
}
</style>
