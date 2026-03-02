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

    // array de booleanos: colorDone[i] = true quando a cor i esta 100% completa
    // e um array reativo normal (nao Uint8Array) pra o vue detectar mudancas automaticamente
    // o vue nao consegue rastrear mutacao direta em Uint8Array, entao usamos isso
    colorDone: [],

    // contador que incrementa quando solveAll() e chamado
    // serve pra o componente do canvas detectar que precisa redesenhar tudo de uma vez
    // (precisamos disso pq o Uint8Array e mutado direto, sem reatividade automatica do vue)
    paintRevision: 0,

    // true enquanto o worker ta processando
    workerBusy: false,

    // mensagem de erro do worker (null = sem erro)
    workerError: null,
  }),

  // = getters ================================
  // no vue sao tipo propriedades computadas => calculadas na hora, com cache automatico
  getters: {
    // true se a fase for 'ready' e o grid existir — checagem rapida usada em varios lugares
    hasGrid: (state) => state.phase === "ready" && state.targetGrid !== null,

    // total de celulas do grid (colunas vezes linhas)
    totalCells: (state) => state.gridCols * state.gridRows,

    // retorna uma funcao que verifica se uma celula especifica foi pintada certo
    // ex: store.isCellCorrect(42) retorna true ou false
    isCellCorrect: (state) => (cellIdx) =>
      state.paintedGrid !== null &&
      state.targetGrid !== null &&
      state.paintedGrid[cellIdx] === state.targetGrid[cellIdx],
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

      // inicializa todas as cores como nao-completas
      this.colorDone = new Array(palette.length).fill(false);

      this.phase = "ready";
      this.workerBusy = false;
      this.workerError = null;
    },

    // tenta pintar uma celula com a cor selecionada
    // retorna true se algo mudou (para o canvas saber que precisa redesenhar)
    paintCell(cellIdx) {
      if (this.selectedColor === null || !this.targetGrid || !this.paintedGrid)
        return false;
      if (cellIdx < 0 || cellIdx >= this.targetGrid.length) return false;

      const target = this.targetGrid[cellIdx]; // cor correta dessa celula
      const current = this.paintedGrid[cellIdx]; // cor que esta pintada agora (255 = vazia)

      // celula ja esta correta => nao pode ser apagada nem repintada
      if (current === target) return false;

      // se modo correto ativado e a cor selecionada nao e a certa, bloqueia
      if (this.correctMode && this.selectedColor !== target) return false;

      // se ja tem exatamente a cor selecionada (e errada), nao faz nada
      if (current === this.selectedColor) return false;

      // pinta a celula com a cor selecionada
      this.paintedGrid[cellIdx] = this.selectedColor;
      this._recalc();

      // se essa pintura completou a cor atual, avanca pra proxima incompleta
      if (this.colorDone[this.selectedColor]) {
        this._nextColor();
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
      this._recalc();
      // incrementa o contador de revisao pra avisar o canvas que precisa redesenhar tudo
      // (o vue nao detecta mutacao direta em Uint8Array, entao usamos esse truque)
      this.paintRevision++;
    },

    // recalcula o progresso geral e o colorDone de cada cor
    // percorre o grid uma unica vez calculando tudo junto — mais eficiente do que duas passadas
    // chamado toda vez que uma celula e pintada ou apagada
    _recalc() {
      if (!this.paintedGrid || !this.targetGrid) return;

      const nColors = this.palette.length;
      const total = new Array(nColors).fill(0); // quantas celulas tem cada cor
      const correct = new Array(nColors).fill(0); // quantas estao certas por cor
      let allRight = 0;

      for (let i = 0; i < this.paintedGrid.length; i++) {
        const t = this.targetGrid[i];
        total[t]++;
        if (this.paintedGrid[i] === t) {
          correct[t]++;
          allRight++;
        }
      }

      this.progress = allRight / this.totalCells; // ex: 0.75 = 75% completo

      // atualiza colorDone — array reativo normal, o vue detecta a mudanca automaticamente
      for (let c = 0; c < nColors; c++) {
        // total[c] > 0 garante que a cor existe no grid (paleta pode ter cores sem celulas)
        this.colorDone[c] = total[c] > 0 && correct[c] === total[c];
      }
    },

    // avanca pra proxima cor incompleta, em ordem circular
    // ex: se esta na cor 3 e ela foi completada, vai pra 4, 5... voltando pro 0 se precisar
    _nextColor() {
      const n = this.palette.length;
      for (let offset = 1; offset <= n; offset++) {
        const candidate = (this.selectedColor + offset) % n;
        if (!this.colorDone[candidate]) {
          this.selectedColor = candidate;
          return;
        }
      }
      // se todas as cores estiverem completas, nao muda nada
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
      this.colorDone = [];
      this.paintRevision = 0;
      this.workerBusy = false;
      this.workerError = null;
    },
  },
});
