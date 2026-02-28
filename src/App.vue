<!--
  componente raiz do app — o "esqueleto" que organiza tudo
  ele controla qual "tela" mostrar baseado na fase atual da store:
  - fase 'idle' ou 'processing': mostra upload + configuracoes
  - fase 'ready': mostra a sidebar de pintura + o canvas
-->
<script setup>
import { useColoringStore } from '@/stores/coloring'
import UploadPanel from '@/components/UploadPanel.vue'
import ControlPanel from '@/components/ControlPanel.vue'
import PaletteSelector from '@/components/PaletteSelector.vue'
import ColoringCanvas from '@/components/ColoringCanvas.vue'
import ExportButton from '@/components/ExportButton.vue'

// acessa a store global
const store = useColoringStore()
</script>

<template>
  <div class="app-layout">

    <!-- cabecalho fixo no topo -->
    <header class="app-header">
      <h1 class="app-title">Coloring pixelbook =]</h1>
    </header>

    <!--
      fase de setup: aparece quando a fase e 'idle' (esperando imagem) ou 'processing' (worker rodando)
      v-if="store.phase !== 'ready'" = mostra se a fase NAO for 'ready'
    -->
    <div v-if="store.phase !== 'ready'" class="setup-view">
      <div class="setup-card">

        <h2 class="section-heading">1. Imagem</h2>
        <UploadPanel />

        <h2 class="section-heading" style="margin-top: 1.5rem">2. Configurações</h2>
        <ControlPanel />

        <!-- spinner de carregamento enquanto o worker processa -->
        <div v-if="store.phase === 'processing'" class="status-processing">
          <span class="spinner" /> Processando imagem…
        </div>

        <!-- mensagem de erro se algo deu errado no worker -->
        <div v-if="store.workerError" class="status-error">
          Erro: {{ store.workerError }}
        </div>

      </div>
    </div>

    <!--
      fase de pintura: aparece quando o grid esta pronto
      v-else = mostra quando o v-if acima for falso (ou seja, fase === 'ready')
    -->
    <div v-else class="paint-view">

      <!-- sidebar: paleta, opcoes e acoes -->
      <aside class="paint-sidebar">

        <!-- grade de swatches de cor — emite 'colorSelected' quando o usuario clica numa cor -->
        <!-- @color-selected="() => {}" = ouve o evento mas nao precisa fazer nada aqui no pai -->
        <PaletteSelector @color-selected="() => {}" />

        <!-- opcao de modo correto: so pinta celulas com a cor certa -->
        <div class="sidebar-option">
          <label class="toggle-label">
            <!--
              :checked sincroniza o estado do checkbox com a store
              @change chama toggleCorrectMode quando o usuario marca/desmarca
            -->
            <input type="checkbox" :checked="store.correctMode" @change="store.toggleCorrectMode()" />
            Apenas cores corretas
          </label>
          <p class="option-hint">
            Ativado: só pinta se a cor selecionada for a certa para a célula.
          </p>
        </div>

        <!-- botoes de acao -->
        <div class="sidebar-actions">
          <ExportButton />

          <!-- botao de resolver: pinta tudo de uma vez com as cores corretas -->
          <!-- :disabled desabilita quando ja esta 100% completo -->
          <button
            class="btn-solve"
            @click="store.solveAll()"
            :disabled="store.progress >= 1"
            title="Pinta todas as células com as cores corretas"
          >
            Resolver tudo
          </button>

          <!-- volta pra tela de setup e reseta tudo -->
          <button class="btn-secondary" @click="store.reset()">Nova imagem</button>
        </div>

        <!-- informacoes do grid atual -->
        <div class="sidebar-info">
          <div class="info-row">
            <span>Grid</span>
            <span>{{ store.gridCols }} × {{ store.gridRows }}</span>
          </div>
          <div class="info-row">
            <span>Células</span>
            <span>{{ store.totalCells }}</span>
          </div>
        </div>

      </aside>

      <!-- area principal: o canvas de pintura -->
      <main class="paint-main">
        <ColoringCanvas />
      </main>

    </div>
  </div>
</template>

<style scoped>
.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column; /* empilha header + conteudo verticalmente */
}
.app-header {
  padding: 0.75rem 1.5rem;
  background: #18181b;
  color: #FAFAFA;
  flex-shrink: 0; /* nao encolhe quando o espaco e curto */
}
.app-title {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 700;
  letter-spacing: 0.03em;
}

/* = tela de setup = */
.setup-view {
  display: flex;
  justify-content: center; /* centraliza o card na tela */
  padding: 2rem 1rem;
}
.setup-card {
  width: 100%;
  max-width: 480px;
  background: #FAFAFA;
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  padding: 1.5rem;
  box-shadow: 0 2px 12px rgba(0,0,0,0.07);
}
.section-heading {
  font-size: 1rem;
  font-weight: 700;
  margin: 0 0 0.75rem;
  color: #18181b;
}
.status-processing {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1rem;
  color: #12743e;
  font-weight: 600;
}
/* animacao do spinner: um circulo girando infinitamente */
.spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid #12743e;
  border-top-color: transparent; /* um lado transparente cria o efeito de "girando"  */
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.status-error {
  margin-top: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: #FAFAFA;
  border: 1px solid #ffaaaa;
  border-radius: 4px;
  color: #cc2222;
  font-size: 0.9rem;
}

/* = tela de pintura = */
.paint-view {
  display: grid;
  grid-template-columns: 220px 1fr; /* sidebar fixa de 220px + canvas ocupa o resto */
  gap: 0;
  flex: 1; /* ocupa todo o espaco vertical restante (abaixo do header) */
  min-height: 0; /* necessario pra o flex/grid funcionar corretamente com overflow */
}
.paint-sidebar {
  padding: 1rem;
  background: #f5f5f7;
  border-right: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  overflow-y: auto; /* scroll na sidebar se tiver muito conteudo */
}
.paint-main {
  padding: 1rem;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.sidebar-option {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.toggle-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
}
.option-hint {
  font-size: 0.76rem;
  color: #888;
  margin: 0;
  line-height: 1.4;
}
.sidebar-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
/* botao "resolver tudo" — cor laranja/amarelado pra diferencia do primario   */
.btn-solve {
  width: 100%;
  padding: 0.55rem 1rem;
  font-size: 0.9rem;
  font-weight: 600;
  background: #FAFAFA;
  border: 1px solid #09a753;
  color: #0c5033;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-solve:hover:not(:disabled) {
  background: #a1d0ad;
}
.btn-solve:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.sidebar-info {
  font-size: 0.8rem;
  color: #666;
  border-top: 1px solid #ddd;
  padding-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.info-row {
  display: flex;
  justify-content: space-between;
}
</style>
