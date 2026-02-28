<!--
  componente de upload de imagem
  o usuario pode clicar na area ou arrastar uma imagem pra cima dela
  aceita so jpg e png — valida antes de processar
-->
<script setup>
import { ref } from 'vue'
import { useColoringStore } from '@/stores/coloring'

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
    class="upload-panel"
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
      <div class="upload-icon">Sua imagem</div>
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

<style scoped>
/* scoped = esse css so afeta esse componente, nao vaza pra fora */
.upload-panel {
  border: 2px dashed #bbb;
  border-radius: 8px;
  padding: 1.5rem;
  text-align: center;
  transition: border-color 0.2s, background 0.2s;
  cursor: pointer;
}
.upload-panel--dragover {
  border-color: #12743e;
  background: rgba(79, 142, 247, 0.07);
}
.upload-input {
  display: none; /* esconde o input feio do browser */
}
.upload-icon {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
}
.upload-text {
  color: #666;
  margin: 0;
}
.upload-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}
.preview-img {
  max-width: 100%;
  max-height: 200px;
  border-radius: 4px;
  object-fit: contain;
  border: 1px solid #ddd;
}
.preview-meta {
  font-size: 0.8rem;
  color: #888;
}
</style>
