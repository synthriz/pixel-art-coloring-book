// composable responsavel por toda a renderizacao no canvas
// ele controla o loop de animacao (RAF) e desenha cada celula do grid
// a sacada principal e o "dirty set", uma lista de celulas que mudaram
// assim a gente so redesenha o que mudou, nao o canvas inteiro a cada pincelada

import { useColoringStore } from "@/stores/coloring";

export function useCanvas(canvasRef, displayCellSize = 24) {
  // canvasRef = referencia ao elemento <canvas> do DOM
  // displayCellSize = quantos pixels na tela cada celula ocupa (fixo em 24px)

  const store = useColoringStore();

  let ctx = null; // contexto 2d do canvas => e o objeto que a gente usa pra desenhar
  let rafId = null; // id do requestAnimationFrame atual (null = nenhum agendado)
  const dirtySet = new Set(); // conjunto de indices de celulas que precisam ser redesenhadas
  let fullRedrawNeeded = false; // flag: precisa redesenhar o canvas inteiro?

  // = inicializacao ============================─

  // chama isso uma vez quando o componente e montado
  function init() {
    ctx = canvasRef.value.getContext("2d"); // pega o contexto de desenho 2d
    scheduleFullRedraw(); // agenda um redesenho completo inicial
  }

  // = agendamento de frames ========================─

  // marca que precisa redesenhar tudo na proxima oportunidade
  function scheduleFullRedraw() {
    fullRedrawNeeded = true;
    scheduleFrame();
  }

  // marca uma celula especifica como "suja" (precisa ser redesenhada)
  // chamado pelo useMousePaint toda vez que uma celula e pintada
  function markDirty(cellIdx) {
    dirtySet.add(cellIdx);
    scheduleFrame();
  }

  // agenda um frame de animacao se ja nao tiver um agendado
  // requestAnimationFrame e a forma certa de desenhar no browser =>
  // ele sincroniza com o refresh da tela (60fps) e nao desperdicao frames
  function scheduleFrame() {
    if (rafId !== null) return; // ja tem um frame agendado, nao precisa agendar outro
    rafId = requestAnimationFrame(renderFrame);
  }

  // chamada automaticamente pelo browser quando e hora de desenhar
  function renderFrame() {
    rafId = null; // limpa o id pra poder agendar o proximo quando necessario

    if (!store.hasGrid || !ctx) return; // nao tem grid ainda, nao desenha nada

    if (fullRedrawNeeded) {
      renderAll(); // redesenha o canvas inteiro
      fullRedrawNeeded = false;
      dirtySet.clear(); // limpa o dirty set pq ja redesenhou tudo
    } else if (dirtySet.size > 0) {
      renderDirty(); // so redesenha as celulas que mudaram
    }
  }

  // = redesenho completo ==========================

  // redesenha o canvas inteiro do zero
  // chamado quando o grid chega do worker ou quando a cor selecionada muda
  function renderAll() {
    const { gridCols, gridRows } = store;
    const cs = displayCellSize;
    const w = gridCols * cs;
    const h = gridRows * cs;

    // redimensiona o canvas se as dimensoes mudaram
    // (isso limpa o canvas automaticamente)
    if (canvasRef.value.width !== w || canvasRef.value.height !== h) {
      canvasRef.value.width = w;
      canvasRef.value.height = h;
    }

    ctx.clearRect(0, 0, w, h); // limpa tudo

    // percorre todas as celulas e desenha cada uma
    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        drawCell(col, row, col + row * gridCols);
      }
    }

    // desenha todas as bordas por cima (separado pra nao sobrescrever o fundo das celulas)
    drawAllBorders();
  }

  // = redesenho parcial ==========================─

  // so redesenha as celulas que estao no dirtySet
  // muito mais eficiente durante a pintura => se arrastar o mouse por 50 celulas,
  // so essas 50 sao redesenhadas, nao as 10 mil do grid inteiro
  function renderDirty() {
    for (const cellIdx of dirtySet) {
      const col = cellIdx % store.gridCols; // coluna = resto da divisao
      const row = Math.floor(cellIdx / store.gridCols); // linha = parte inteira
      drawCell(col, row, cellIdx);
      drawCellBorders(col, row, cellIdx); // redesenha as bordas dessa celula tambem
    }
    dirtySet.clear();
  }

  // = desenho de uma celula ========================─

  // desenha o conteudo de uma celula: fundo, numero, highlight e overlay de erro
  function drawCell(col, row, cellIdx) {
    const cs = displayCellSize;
    const x = col * cs; // posicao x em pixels no canvas
    const y = row * cs; // posicao y em pixels no canvas

    const { targetGrid, paintedGrid, palette, selectedColor } = store;

    const targetIdx = targetGrid[cellIdx]; // cor correta dessa celula (gabarito)
    const paintedIdx = paintedGrid[cellIdx]; // cor que o usuario pintou (255 = vazia)
    const isPainted = paintedIdx !== 255; // foi pintada?
    const isCorrect = isPainted && paintedIdx === targetIdx; // foi pintada certo?

    // --- 1. fundo da celula ---
    if (!isPainted) {
      ctx.fillStyle = "#FAFAFA"; // vazia = branco
    } else {
      ctx.fillStyle = palette[paintedIdx]?.hex ?? "#FAFAFA"; // cor pintada
    }
    ctx.fillRect(x, y, cs, cs); // preenche o quadrado

    // --- 2. highlight amarelo nas celulas que pertencem a cor selecionada ---
    // quando o usuario seleciona uma cor na paleta, todas as celulas daquela cor ficam amarelas
    // so funciona em celulas nao pintadas
    if (!isPainted && selectedColor !== null && targetIdx === selectedColor) {
      ctx.fillStyle = "rgba(255, 230, 0, 0.30)"; // amarelo semi-transparente por cima
      ctx.fillRect(x, y, cs, cs);
    }

    // --- 3. numero da cor correta nas celulas nao pintadas ---
    // so mostra se a celula for grande o suficiente (>= 10px)
    if (!isPainted && cs >= 10) {
      const fontSize = Math.max(8, Math.floor(cs * 0.42)); // tamanho proporcional a celula
      ctx.fillStyle = "#444444";
      ctx.font = `${fontSize}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(targetIdx + 1), x + cs / 2, y + cs / 2); // +1 pq o indice e 0-based
    }

    // --- 4. overlay de erro: celula pintada com a cor errada ---
    // mostra um escurecimento + numero em vermelho em cima da cor errada
    if (isPainted && !isCorrect && cs >= 10) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.35)"; // escurece a cor errada
      ctx.fillRect(x, y, cs, cs);

      const fontSize = Math.max(8, Math.floor(cs * 0.48));
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // sombra branca atras do numero (deslocada 1px) pra dar legibilidade
      ctx.fillStyle = "#FAFAFA";
      ctx.fillText(String(targetIdx + 1), x + cs / 2 + 1, y + cs / 2 + 1);

      // numero em laranja/vermelho na frente
      ctx.fillStyle = "#ff4400";
      ctx.fillText(String(targetIdx + 1), x + cs / 2, y + cs / 2);
    }
  }

  // = bordas entre celulas =========================

  // desenha uma linha em cada lado da celula onde o vizinho tem cor diferente
  // isso e o que cria as "divisorias" do puzzle
  function drawCellBorders(col, row, cellIdx) {
    const { targetGrid, gridCols, gridRows } = store;
    const cs = displayCellSize;
    const x = col * cs;
    const y = row * cs;
    const targetIdx = targetGrid[cellIdx];

    // estilos top
    ctx.strokeStyle = "#999999";
    ctx.lineWidth = 0.5;

    // borda direita q so desenha se o vizinho da direita tem cor diferente
    if (col + 1 < gridCols && targetGrid[cellIdx + 1] !== targetIdx) {
      ctx.beginPath();
      ctx.moveTo(x + cs, y);
      ctx.lineTo(x + cs, y + cs);
      ctx.stroke();
    }

    // borda inferior q so desenha se o vizinho de baixo tem cor diferente
    if (row + 1 < gridRows && targetGrid[cellIdx + gridCols] !== targetIdx) {
      ctx.beginPath();
      ctx.moveTo(x, y + cs);
      ctx.lineTo(x + cs, y + cs);
      ctx.stroke();
    }

    // bordas externas do grid (as quatro bordas da borda total)
    if (col === 0) {
      // borda esquerda do grid
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + cs);
      ctx.stroke();
    }
    if (row === 0) {
      // borda superior do grid
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + cs, y);
      ctx.stroke();
    }
    if (col === store.gridCols - 1) {
      // borda direita do grid
      ctx.beginPath();
      ctx.moveTo(x + cs, y);
      ctx.lineTo(x + cs, y + cs);
      ctx.stroke();
    }
    if (row === store.gridRows - 1) {
      // borda inferior do grid
      ctx.beginPath();
      ctx.moveTo(x, y + cs);
      ctx.lineTo(x + cs, y + cs);
      ctx.stroke();
    }
  }

  // percorre todas as celulas e desenha as bordas de cada uma
  function drawAllBorders() {
    const { gridCols, gridRows } = store;
    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        drawCellBorders(col, row, col + row * gridCols);
      }
    }
  }

  // = limpeza ===============================─

  // chama isso quando o componente e desmontado pra nao deixar o RAF rodando
  function destroy() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  // expoe so o que os componentes precisam usar
  return { init, markDirty, scheduleFullRedraw, destroy };
}
