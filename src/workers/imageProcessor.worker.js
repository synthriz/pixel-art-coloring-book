// web worker => roda em uma thread separada do navegador
// isso e importante porque o processamento de imagem e pesado
// se rodasse na thread principal, a pagina travaria enquanto processa
// aqui a gente recebe a imagem, quantiza as cores e manda o grid de volta

import * as iq from "image-q"; // biblioteca de quantizacao de cores

// = funcoes auxiliares ============================

// calcula a distancia ao quadrado entre duas cores rgb
// "ao quadrado" porque evita a raiz quadrada (mais rapido, e so pra comparar)
// ex: vermelho (255,0,0) vs laranja (255,128,0) = 0 + 16384 + 0 = 16384
function rgbDistSq(r1, g1, b1, r2, g2, b2) {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return dr * dr + dg * dg + db * db;
}

// dado um pixel rgb, acha qual cor da paleta e a mais proxima
// percorre toda a paleta e retorna o indice da menor distancia
function nearestPaletteIndex(r, g, b, palette) {
  let bestIdx = 0;
  let bestDist = Infinity; // comeca com distancia infinita

  for (let j = 0; j < palette.length; j++) {
    const [pr, pg, pb] = palette[j].rgb;
    const d = rgbDistSq(r, g, b, pr, pg, pb);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = j; // essa e a melhor ate agora
    }
  }
  return bestIdx;
}

// = listener de mensagens ==========================─

// o worker fica esperando mensagens da thread principal
// quando receber uma mensagem do tipo 'PROCESS', executa o pipeline
self.onmessage = async (event) => {
  const { type, bitmap, cellSize, paletteSize } = event.data;

  // ignora qualquer mensagem que nao seja 'PROCESS'
  if (type !== "PROCESS") return;

  try {
    // passo 1: calcula quantas celulas o grid vai ter
    // dividimos as dimensoes da imagem pelo tamanho de celula escolhido no slider
    // ex: imagem 800x600, cellSize 16 -> grid de 50x37 celulas
    const gridCols = Math.max(1, Math.floor(bitmap.width / cellSize));
    const gridRows = Math.max(1, Math.floor(bitmap.height / cellSize));

    // passo 2: redimensiona a imagem para o tamanho do grid
    // OffscreenCanvas e um canvas que funciona fora da tela (dentro do worker)
    // desenhamos a imagem original num canvas do tamanho exato do grid
    // cada pixel resultante representa uma celula inteira — e a "media" daquela regiao
    const canvas = new OffscreenCanvas(gridCols, gridRows);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, gridCols, gridRows); // redimensiona automaticamente
    const imageData = ctx.getImageData(0, 0, gridCols, gridRows); // pega os pixels
    bitmap.close(); // nao precisa mais do bitmap original, libera memoria

    // avisa a thread principal que chegamos em 20% do processo
    self.postMessage({ type: "PROGRESS", value: 0.2 });

    // passo 3: prepara os pixels para a biblioteca image-q
    // o image-q trabalha com um objeto chamado PointContainer
    // a gente passa o array de pixels (RGBA flat) e as dimensoes
    const container = iq.utils.PointContainer.fromUint8Array(
      imageData.data, // Uint8ClampedArray com [r,g,b,a, r,g,b,a, ...] de cada pixel
      gridCols,
      gridRows,
    );

    self.postMessage({ type: "PROGRESS", value: 0.4 });

    // passo 4: quantizacao — reduz a imagem para N cores
    // usamos o algoritmo WuQuant (Xiaolin Wu) porque ele e otimo pra paletas pequenas
    // ele analisa a distribuicao de cores e escolhe as N cores que melhor representam a imagem
    // diferente de algoritmos que precisam de multiplas iteracoes, o WuQuant e deterministico e rapido
    const palette = iq.buildPaletteSync([container], {
      colors: paletteSize, // quantas cores queremos (6, 8, 12 ou 16)
      paletteQuantization: "wuquant",
      colorDistanceFormula: "euclidean-bt709", // formula de distancia de cor mais precisa
    });

    self.postMessage({ type: "PROGRESS", value: 0.65 });

    // passo 5: extrai as cores da paleta como objetos simples
    // o image-q retorna objetos internos dele, a gente converte pra { index, rgb, hex }
    const palettePoints = palette.getPointContainer().getPointArray();
    const paletteEntries = palettePoints.map((point, i) => {
      // arredonda os valores float que o image-q retorna para inteiros 0-255
      const r = Math.round(point.r);
      const g = Math.round(point.g);
      const b = Math.round(point.b);
      // converte para hex — ex: [255, 128, 0] -> '#ff8000'
      // padStart(2, '0') garante que '9' vira '09' pra nao quebrar o hex
      const hex =
        "#" +
        [r, g, b]
          .map((c) =>
            Math.max(0, Math.min(255, c)).toString(16).padStart(2, "0"),
          )
          .join("");
      return { index: i, rgb: [r, g, b], hex };
    });

    self.postMessage({ type: "PROGRESS", value: 0.75 });

    // passo 6: monta o targetGrid — o "gabarito" do puzzle
    // para cada celula (pixel do canvas redimensionado), achamos qual cor da paleta e a mais proxima
    // e guardamos o indice dessa cor no array
    const pixels = imageData.data; // array flat de rgba: [r,g,b,a, r,g,b,a, ...]
    const targetGrid = new Uint8Array(gridCols * gridRows); // array de indices (0-15)

    for (let i = 0; i < gridCols * gridRows; i++) {
      const r = pixels[i * 4]; // vermelho do pixel i
      const g = pixels[i * 4 + 1]; // verde
      const b = pixels[i * 4 + 2]; // azul (ignoramos o alpha * 4 + 3)
      targetGrid[i] = nearestPaletteIndex(r, g, b, paletteEntries);
    }

    self.postMessage({ type: "PROGRESS", value: 1.0 });

    // passo 7: manda o resultado de volta pra thread principal
    // o segundo argumento de postMessage e a lista de "transferaveis"
    // passar o buffer assim e "zero-copy" — o worker cede a memoria sem copiar
    // depois disso, o worker nao pode mais usar targetGrid
    const transferBuffer = targetGrid.buffer;
    self.postMessage(
      {
        type: "RESULT",
        gridCols,
        gridRows,
        targetGridBuffer: transferBuffer, // o gabarito como ArrayBuffer
        palette: paletteEntries, // as cores da paleta
      },
      [transferBuffer], // transfere a posse do buffer (sem copiar)
    );
  } catch (err) {
    // se qualquer coisa der errado, manda o erro de volta
    self.postMessage({ type: "ERROR", message: err.message || String(err) });
  }
};
