// store central do app, tipo contexto global
// o pinia cuida de avisar o vue quando algo muda pra re-renderizar a tela

import { defineStore } from "pinia";

// tipos pra doc
/**
 * @typedef {'idle' | 'processing' | 'ready'} Phase
 * @typedef {{ index: number, rgb: [number,number,number], hex: string }} PaletteEntry
 */

export const useColoringStore = defineStore("coloring", {
  // = state =================================
  // tudo que o app precisa guardar, e o "estado" da aplicacao
  state: () => ({
    // fase atual do app:
    // 'idle'       = nenhuma imagem carregada ainda
    // 'processing' = worker ta processando a imagem
    // 'ready'      = grid pronto, usuario pode pintar
    /** @type {Phase} */
    phase: "idle",

    // tamanho de cada celula em pixels da imagem original (slider de 4 a 32)
    // quanto menor, mais celulas, mais detalhe no grid
    cellSize: 16,

    // quantas cores a paleta vai ter (6, 8, 12 ou 16)
    paletteSize: 12,

    // arquivo bruto da imagem que o usuario fez upload
    // guardamos o File original porque o bitmap pode ser transferido ao worker e "destruido"
    /** @type {File | null} */
    sourceFile: null,

    // versao processada da imagem como ImageBitmap (usado so pra preview)
    /** @type {ImageBitmap | null} */
    sourceBitmap: null,

    // dimensoes originais da imagem em pixels
    sourceWidth: 0,
    sourceHeight: 0,

    // numero de colunas e linhas do grid gerado
    gridCols: 0,
    gridRows: 0,

    // grid "gabarito" — o indice da cor correta de cada celula (0-based)
    // e um Uint8Array: array de numeros inteiros de 8 bits (0 a 255)
    // o indice da paleta cabe em 8 bits porque no maximo temos 16 cores
    /** @type {Uint8Array | null} */
    targetGrid: null,

    // grid "pintado" — o que o usuario pintou em cada celula
    // 255 significa "nao pintada ainda" (usamos 255 como sentinela pq nenhuma paleta tem 255 cores)
    /** @type {Uint8Array | null} */
    paintedGrid: null,

    // paleta de cores gerada pelo worker
    // cada entrada e { index: 0, rgb: [r, g, b], hex: '#rrggbb' }
    /** @type {PaletteEntry[]} */
    palette: [],

    // indice da cor atualmente selecionada pelo usuario (null = nenhuma)
    /** @type {number | null} */
    selectedColor: null,

    // modo "so acerta" — se true, so pinta se a cor selecionada for a correta da celula
    correctMode: false,

    // progresso de 0.0 a 1.0 (porcentagem de celulas pintadas corretamente)
    progress: 0,

    // contador que incrementa quando solveAll() e chamado
    // serve pra o componente do canvas detectar que precisa redesenhar tudo
    // (precisamos disso pq o Uint8Array e mutado direto, sem reatividade automatica do vue)
    paintRevision: 0,

    // contador que incrementa a cada pintura individual (paintCell)
    // usado pelo getter completedColors pra saber quando recalcular
    // separado do paintRevision pra nao triggerar redraw total do canvas a cada pincelada
    paletteRevision: 0,

    // array de booleanos: completedColorFlags[i] = true se a cor i ja foi 100% pintada
    // e um array reativo normal (nao Uint8Array) pra o vue detectar mudancas automaticamente
    // atualizado explicitamente nas actions em vez de ser calculado como getter
    /** @type {boolean[]} */
    completedColorFlags: [],

    // true enquanto o worker ta processando
    workerBusy: false,

    // mensagem de erro do worker (null = sem erro)
    /** @type {string | null} */
    workerError: null,
  }),

  // = getters ================================
  //  no vue sao tipo propriedades computadas calculadas na hora, com cache automatico
  getters: {
    // true se a fase for 'ready' e o grid existir — checagem rapida usada em varios lugares
    hasGrid: (state) => state.phase === "ready" && state.targetGrid !== null,

    // total de celulas do grid (colunas vezes linhas)
    totalCells: (state) => state.gridCols * state.gridRows,

    // conta quantas celulas o usuario pintou com a cor correta
    correctCells: (state) => {
      if (!state.paintedGrid || !state.targetGrid) return 0;
      let count = 0;
      for (let i = 0; i < state.paintedGrid.length; i++) {
        if (state.paintedGrid[i] === state.targetGrid[i]) count++;
      }
      return count;
    },

    // retorna uma funcao que verifica se uma celula especifica foi pintada certo
    // ex: store.isCellCorrect(42) retorna true ou false
    /** @returns {(cellIdx: number) => boolean} */
    isCellCorrect: (state) => (cellIdx) => {
      return (
        state.paintedGrid !== null &&
        state.targetGrid !== null &&
        state.paintedGrid[cellIdx] === state.targetGrid[cellIdx]
      );
    },

    // retorna um Set com os indices das cores completadas
    // construido a partir do array reativo completedColorFlags
    // o Set e so pra facilitar o .has() no template — O(1) em vez de array[i]
    completedColors: (state) => {
      const done = new Set();
      for (let i = 0; i < state.completedColorFlags.length; i++) {
        if (state.completedColorFlags[i]) done.add(i);
      }
      return done;
    },
  },

  // = actions ================================
  // funcoes que modificam o estado, a unica forma "oficial" de alterar a store
  actions: {
    // chamada pelo UploadPanel quando o usuario seleciona uma imagem
    // guarda o arquivo bruto e o bitmap para uso posterior
    setSourceFile(file, bitmap, width, height) {
      this.sourceFile = file;
      this.sourceBitmap = bitmap;
      this.sourceWidth = width;
      this.sourceHeight = height;
      this.workerError = null; // limpa erro anterior se existia
    },

    setCellSize(v) {
      this.cellSize = Number(v);
    },

    setPaletteSize(v) {
      this.paletteSize = Number(v);
    },

    setSelectedColor(idx) {
      this.selectedColor = idx;
    },

    // avanca automaticamente pra proxima cor que ainda tem celulas pra pintar
    // e chamado logo apos uma cor ser completada
    // parte da cor atual e vai pra frente, ciclando pela paleta
    // se todas as cores estiverem completas, nao faz nada
    advanceToNextColor() {
      if (this.selectedColor === null || this.palette.length === 0) return;

      const total = this.palette.length;
      const done  = this.completedColors; // o getter que calculamos acima

      // tenta cada cor a partir da proxima, em ordem circular
      for (let offset = 1; offset <= total; offset++) {
        const candidate = (this.selectedColor + offset) % total;
        if (!done.has(candidate)) {
          this.selectedColor = candidate;
          return;
        }
      }
      // se chegou aqui, todas as cores estao completas — nao muda nada
    },

    toggleCorrectMode() {
      this.correctMode = !this.correctMode;
    },

    // chamada pelo useWorker quando o worker termina de processar e manda o resultado
    // aqui a gente "aplica" o resultado na store e muda a fase pra 'ready'
    applyProcessedResult({ gridCols, gridRows, targetGridBuffer, palette }) {
      this.gridCols = gridCols;
      this.gridRows = gridRows;

      // o worker nos manda um ArrayBuffer transferido (zero-copy)
      // a gente envolve ele num Uint8Array pra poder acessar por indice
      this.targetGrid = new Uint8Array(targetGridBuffer);

      // cria o grid de pintura zerado — fill(255) significa "tudo nao pintado"
      this.paintedGrid = new Uint8Array(gridCols * gridRows).fill(255);

      this.palette = palette;
      this.selectedColor = 0; // ja seleciona a primeira cor por padrao
      this.progress = 0;
      // inicializa o array de flags com false pra cada cor da paleta
      this.completedColorFlags = new Array(palette.length).fill(false);
      this.phase = "ready";
      this.workerBusy = false;
      this.workerError = null;
    },

    // tenta pintar uma celula com a cor selecionada
    // retorna true se algo mudou (para o canvas saber que precisa redesenhar)
    // tambem avanca automaticamente pra proxima cor se a atual for completada
    paintCell(cellIdx) {
      if (this.selectedColor === null || !this.targetGrid || !this.paintedGrid)
        return false;
      if (cellIdx < 0 || cellIdx >= this.targetGrid.length) return false;

      const target  = this.targetGrid[cellIdx];  // cor correta dessa celula
      const current = this.paintedGrid[cellIdx]; // cor que esta pintada agora (255 = vazia)

      // se modo correto ativado e a cor selecionada nao e a certa, bloqueia
      if (this.correctMode && this.selectedColor !== target) return false;

      // se a celula esta pintada errado (tem cor, mas nao e a certa)
      // clicar nela de novo apaga — funciona como toggle
      const isWrong = current !== 255 && current !== target;
      if (isWrong) {
        this.paintedGrid[cellIdx] = 255; // volta pra vazia
        this._recalcProgress();
        return true;
      }

      // se ja tem exatamente a cor selecionada, nao faz nada
      if (current === this.selectedColor) return false;

      // pinta a celula com a cor selecionada
      this.paintedGrid[cellIdx] = this.selectedColor;
      this._recalcProgress();

      // verifica se essa pintura completou a cor atual
      // o getter completedColors recalcula na hora, entao ja reflete essa ultima pintura
      if (this.completedColors.has(this.selectedColor)) {
        this.advanceToNextColor();
      }

      return true;
    },

    // pinta TODAS as celulas com as cores corretas de uma vez
    // o botao "resolver tudo" chama isso
    solveAll() {
      if (!this.targetGrid || !this.paintedGrid) return;
      for (let i = 0; i < this.targetGrid.length; i++) {
        this.paintedGrid[i] = this.targetGrid[i]; // copia o gabarito pro grid pintado
      }
      // _recalcProgress ja atualiza progress, completedColorFlags e paletteRevision
      this._recalcProgress();
      // paintRevision avisa o canvas que precisa redesenhar tudo do zero
      this.paintRevision++;
    },

    // recalcula o progresso e as flags de cores completas
    // chamado internamente toda vez que uma celula e pintada
    _recalcProgress() {
      const total = this.totalCells;
      if (total === 0) {
        this.progress = 0;
        return;
      }

      // percorre o grid uma unica vez calculando tudo junto
      const colorTotal   = new Array(this.palette.length).fill(0);
      const colorCorrect = new Array(this.palette.length).fill(0);
      let correct = 0;

      for (let i = 0; i < this.paintedGrid.length; i++) {
        const targetColor = this.targetGrid[i];
        colorTotal[targetColor]++;
        if (this.paintedGrid[i] === targetColor) {
          correct++;
          colorCorrect[targetColor]++;
        }
      }

      this.progress = correct / total;

      // atualiza o array reativo de flags — o vue detecta mudanca em array normal
      // isso e mais confiavel do que tentar fazer um getter depender de Uint8Array
      for (let c = 0; c < this.palette.length; c++) {
        this.completedColorFlags[c] = colorTotal[c] > 0 && colorCorrect[c] === colorTotal[c];
      }

      this.paletteRevision++; // mantemos o contador pra compatibilidade
    },

    // reseta tudo pro estado inicial — botao "nova imagem" chama isso
    reset() {
      this.phase = "idle";
      this.sourceFile = null;
      this.sourceBitmap = null;
      this.sourceWidth = 0;
      this.sourceHeight = 0;
      this.gridCols = 0;
      this.gridRows = 0;
      this.targetGrid = null;
      this.paintedGrid = null;
      this.palette = [];
      this.selectedColor = null;
      this.correctMode = false;
      this.progress = 0;
      this.workerBusy = false;
      this.workerError = null;
      this.paintRevision = 0;
      this.paletteRevision = 0;
      this.completedColorFlags = [];
    },
  },
});
