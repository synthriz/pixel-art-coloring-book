<!--
  botao de exportar o canvas como arquivo png
  so fica ativo depois que o usuario pintou pelo menos uma celula
-->
<script setup>
import { useColoringStore } from '@/stores/coloring'

const store = useColoringStore()

function exportPng() {
  // pega o elemento canvas do dom pelo seletor de classe
  const canvas = document.querySelector('.coloring-canvas')
  if (!canvas) return

  // toBlob converte o canvas pra um arquivo de imagem
  // e assincrono — recebe um callback quando o blob estiver pronto
  canvas.toBlob((blob) => {
    // cria uma url temporaria pra o blob
    const url = URL.createObjectURL(blob)

    // cria um link invisivel e clica nele programaticamente pra triggar o download
    const link = document.createElement('a')
    link.download = 'coloring-book.png' // nome do arquivo que vai baixar
    link.href = url
    link.click()

    // libera a memoria da url temporaria depois que o download foi iniciado
    URL.revokeObjectURL(url)
  }, 'image/png')
}
</script>

<template>
  <!--
    :disabled impede o clique quando o progresso e 0 (nada pintado ainda)
    @click chama exportPng quando o usuario clica
  -->
  <button
    class="btn-primary btn-export"
    :disabled="store.progress === 0"
    @click="exportPng"
    title="Exportar resultado como PNG"
  >
    Exportar PNG
  </button>
</template>

<style scoped>
.btn-export {
  width: 100%;
  padding: 0.6rem;
}
</style>
