<!--
  componente de upload de imagem
  o usuario pode clicar na area ou arrastar uma imagem pra cima dela
  aceita so jpg e png — valida antes de processar
-->
<script setup>
import { ref } from 'vue'
import { useColoringStore } from '@/stores/coloring'
import { Image } from 'lucide-vue-next'

const store = useColoringStore()

// ref pro input de arquivo — usado pra clicar nele programaticamente
const fileInputRef = ref(null)

// controla se o usuario ta arrastando um arquivo por cima da area de drop
const isDragOver = ref(false)

// url temporaria pra mostrar o preview da imagem (gerada com createObjectURL)
const previewUrl = ref(null)

// dispara o clique no input de arquivo escondido
function triggerFileInput() {
  fileInputRef.value?.click() // ?. evita erro se o ref ainda nao existir
}

// logica central: valida e processa o arquivo selecionado
async function handleFile(file) {
  // valida se e jpg ou png
  if (!file || !file.type.match(/^image\/(png|jpeg)$/)) {
    alert('Por favor, selecione uma imagem JPG ou PNG.')
    return
  }

  // revoga a url anterior pra liberar memoria do browser
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)

  // cria uma url temporaria pra mostrar o preview da imagem
  previewUrl.value = URL.createObjectURL(file)

  // converte o arquivo pra ImageBitmap — formato otimizado pra uso com canvas
  // await porque isso e assincrono (decodifica a imagem em background)
  const bitmap = await createImageBitmap(file)

  // salva na store o arquivo bruto + o bitmap + as dimensoes
  store.setSourceFile(file, bitmap, bitmap.width, bitmap.height)
}

// chamado quando o usuario seleciona um arquivo pelo input
function onFileChange(e) {
  handleFile(e.target.files[0])
}

// quando arrasta um arquivo por cima — previne o comportamento padrao do browser
// (que seria abrir o arquivo na aba)
function onDragOver(e) {
  e.preventDefault()
  isDragOver.value = true
}

function onDragLeave() {
  isDragOver.value = false
}

// quando solta o arquivo na area de drop
function onDrop(e) {
  e.preventDefault()
  isDragOver.value = false
  handleFile(e.dataTransfer.files[0]) // pega o primeiro arquivo arrastado
}
</script>

<template>
  <!--
    a div principal e a area de drop
    :class adiciona a classe de highlight quando esta arrastando
    os eventos @dragover, @dragleave e @drop controlam o drag-and-drop
  -->
  <div
    class="upload-panel glass-surface--simple"
    :class="{ 'upload-panel--dragover': isDragOver }"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <!-- input de arquivo escondido — ativado programaticamente -->
    <input
      ref="fileInputRef"
      type="file"
      accept="image/png,image/jpeg"
      class="upload-input"
      @change="onFileChange"
    />

    <!-- estado vazio: mostra icone e texto de instrucao -->
    <div v-if="!store.sourceBitmap" class="upload-placeholder" @click="triggerFileInput">
      <div class="upload-icon"><Image/></div>
      <p class="upload-text">Clique ou arraste uma imagem (JPG / PNG)</p>
    </div>

    <!-- estado com imagem: mostra preview + dimensoes + botao de trocar -->
    <div v-else class="upload-preview">
      <img :src="previewUrl" class="preview-img" alt="Preview" />
      <div class="preview-meta">
        {{ store.sourceWidth }} × {{ store.sourceHeight }} px
      </div>
      <button class="btn-secondary btn-sm" @click="triggerFileInput">Trocar imagem</button>
    </div>
  </div>
</template>

<!-- todo o css desse componente foi movido pra base.css -->
