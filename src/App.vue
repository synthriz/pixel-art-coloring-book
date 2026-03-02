<!--
  componente raiz do app — o "esqueleto" que organiza tudo
  ele controla qual "tela" mostrar baseado na fase atual da store:
  - fase 'idle' ou 'processing': mostra upload + configuracoes
  - fase 'ready': mostra a sidebar de pintura + o canvas
-->
<script setup>
import { ref, onMounted } from "vue";
import { useColoringStore } from "@/stores/coloring";
import UploadPanel from "@/components/UploadPanel.vue";
import ControlPanel from "@/components/ControlPanel.vue";
import PaletteSelector from "@/components/PaletteSelector.vue";
import ColoringCanvas from "@/components/ColoringCanvas.vue";
import ExportButton from "@/components/ExportButton.vue";
import { Moon, Sun } from "lucide-vue-next";

// acessa a store global
const store = useColoringStore();

// controla o tema claro/escuro e sincroniza com o data-theme do html
const isDark = ref(false);

onMounted(() => {
  const stored = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  isDark.value = stored ? stored === "dark" : prefersDark;
  // o index.html ja seta o data-theme antes do mount (prevencao de FOUC)
  // sincronizamos o ref aqui so pra o icone do botao ficar correto
});

// alterna entre claro e escuro, salva no localStorage
function toggleTheme() {
  isDark.value = !isDark.value;
  const t = isDark.value ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", t);
  localStorage.setItem("theme", t);
}
</script>

<template>
  <div class="app-layout">
    <!-- header fixo no topo -->
    <header class="app-header glass-surface--simple">
      <h1 class="app-title">Coloring Pixelbook =]</h1>
      <button
        class="btn-theme-toggle"
        @click="toggleTheme"
        :title="isDark ? 'Modo claro' : 'Modo escuro'"
        :aria-label="isDark ? 'Ativar modo claro' : 'Ativar modo escuro'"
      >
        <Sun v-if="isDark" aria-hidden="true" />
        <Moon v-else aria-hidden="true" />
      </button>
    </header>

    <!--
      fase de setup: aparece quando a fase e 'idle' (esperando imagem) ou 'processing' (worker rodando)
      v-if="store.phase !== 'ready'" = mostra se a fase NAO for 'ready'
    -->
    <div v-if="store.phase !== 'ready'" class="setup-view">
      <div class="setup-card glass-surface--deep">
        <h2 class="section-heading">1. Imagem</h2>
        <UploadPanel />

        <h2 class="section-heading" style="margin-top: var(--space-6)">
          2. Configurações
        </h2>
        <ControlPanel />

        <!-- spinner de carregamento enquanto o worker processa -->
        <div v-if="store.phase === 'processing'" class="status-processing">
          <span class="spinner" /> Processando imagem…
        </div>

        <!-- mensagem de erro se o worker falhar -->
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

      <aside class="paint-sidebar glass-surface">
        <!-- grade de swatches de cor — emite 'colorSelected' quando o usuario clica numa cor -->
        <!-- @color-selected="() => {}" = ouve o evento mas nao precisa fazer nada aqui no pai -->
        <PaletteSelector @color-selected="() => {}" />

        <!-- opcao de modo correto: so pinta celulas com a cor certa -->
        <div class="sidebar-option sidebar-option--mobile">
          <label class="toggle-label">
            <!--
              :checked sincroniza o estado do checkbox com a store
              @change chama toggleCorrectMode quando o usuario marca/desmarca
            -->
            <input
              type="checkbox"
              :checked="store.correctMode"
              @change="store.toggleCorrectMode()"
            />
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
          <button class="btn-secondary" @click="store.reset()">
            Nova imagem
          </button>
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
    <!-- footer fixo no canto inferior direito -->
    <footer class="app-footer glass-surface--simple">
      <a
        href="https://trizdev.vercel.app"
        target="_blank"
        rel="noopener noreferrer"
        class="footer-link"
      >
        made by Beatriz Tavares =]
      </a>
    </footer>
  </div>
</template>
