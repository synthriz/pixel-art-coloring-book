// composable que gerencia o ciclo de vida do web worker
// "composable" em vue e basicamente um hook do react, uma funcao que encapsula logica reutilizavel
// esse aqui serve de ponte entre o componente e o worker: ele cria, mata e escuta o worker

import { useColoringStore } from "@/stores/coloring";

export function useWorker() {
  const store = useColoringStore(); // acessa a store global
  let worker = null; // referencia pro worker (null = sem worker ativo)

  // garante que temos um worker novo e limpo
  // se ja existia um, mata ele primeiro (evita ficar com workers zumbis em background)
  function ensureWorker() {
    if (worker) {
      worker.terminate(); // para o worker anterior
      worker = null;
    }

    // cria um novo worker
    // o vite resolve o caminho e empacota o arquivo separado
    // { type: 'module' } permite usar import/export dentro do worker
    worker = new Worker(
      new URL("../workers/imageProcessor.worker.js", import.meta.url),
      { type: "module" },
    );

    // registra os listeners de mensagem e erro
    worker.onmessage = handleMessage;
    worker.onerror = (e) => {
      // se o worker crashar por qualquer motivo, volta pra idle e mostra o erro
      store.workerBusy = false;
      store.workerError = e.message || "Worker error";
      store.phase = "idle";
    };
  }

  // processa cada mensagem que o worker manda de volta
  function handleMessage(event) {
    const msg = event.data;

    switch (msg.type) {
      case "PROGRESS":
        // por enquanto so usamos o workerBusy como indicador visual
        // mas o worker manda valores de 0 a 1 caso queira fazer uma barra mais detalhada
        break;

      case "RESULT":
        // worker terminou — aplica o resultado na store
        // isso vai mudar a fase pra 'ready' e o canvas vai aparecer
        store.applyProcessedResult({
          gridCols: msg.gridCols,
          gridRows: msg.gridRows,
          targetGridBuffer: msg.targetGridBuffer, // ArrayBuffer com o gabarito
          palette: msg.palette,
        });
        break;

      case "ERROR":
        // algo deu errado no worker — mostra o erro e volta pra tela de configuracao
        store.workerBusy = false;
        store.workerError = msg.message;
        store.phase = "idle";
        break;
    }
  }

  // funcao principal q eh chamada pelo ControlPanel quando o usuario clica em "Gerar"
  // recebe um ImageBitmap e o manda pro worker junto com as configuracoes da store
  function process(bitmap) {
    store.workerBusy = true;
    store.workerError = null;
    store.phase = "processing"; // mostra o spinner na tela

    ensureWorker(); // cria (ou reinicia) o worker

    // manda a mensagem pro worker com os dados necessarios
    // o segundo argumento [bitmap] e a lista de transferaveis:
    // o bitmap e "transferido" pra thread do worker sem copiar a memoria
    // depois dessa linha, nao podemos mais usar o bitmap aqui na thread principal
    worker.postMessage(
      {
        type: "PROCESS",
        bitmap,
        cellSize: store.cellSize,
        paletteSize: store.paletteSize,
      },
      [bitmap], // transfere a posse do bitmap pro worker
    );
  }

  // para o worker manualmente se necessario (cleanup)
  function terminate() {
    worker?.terminate();
    worker = null;
  }

  // expoe so o que o componente precisa usar
  return { process, terminate };
}
