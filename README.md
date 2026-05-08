# Pixel Art Coloring Book

Projeto de estudo para praticar **Vue 3** e técnicas de **glassmorphism**.

A ideia do app é simples: você envia uma imagem, o app transforma em um grid com paleta reduzida e vira um puzzle de colorir por células, que nem aqueles livrinhos relaxantes de colorir

## O que este projeto cobre

- Upload de imagem (JPG/PNG) por clique ou drag-and-drop
- Geração de puzzle com ajuste de:
  - tamanho da célula
  - quantidade de cores (6, 8, 12 ou 16)
- Pintura no canvas com progresso em tempo real
- Modo "apenas cores corretas"
- Zoom, pan, encaixar na tela e reset de visualização
- Botão "resolver tudo"
- Exportação PNG do resultadi
- Persistência por `localStorage`

## Tecnologias usadas

- Vue 3
- Vite
- Pinia (para o estado global)
- Web Worker (processamento pesado fora da thread principal)
- `image-q` (quantização de cores)

## Como rodar localmente

### Pré-requisitos

- Node.js `^20.19.0 || >=22.12.0`
- Yarn 1.x (recomendado neste repo)

### Instalação

```bash
yarn
```

### Ambiente de desenvolvimento

```bash
yarn dev
```

### Build de produção

```bash
yarn build
```

### Preview do build

```bash
yarn preview
```

## Fluxo da aplicação, em resumo

1. O usuário envia uma imagem.
2. A UI manda o arquivo para um Web Worker.
3. O worker redimensiona para o grid, reduz as cores e monta o "gabarito" (`targetGrid`).
4. A store (Pinia) controla pintura, progresso, paleta e estado da sessão.
5. O canvas renderiza o resultado e responde à interação de pintura/zoom/pan.

## Como o algoritmo transforma a imagem, em resumo

1. Recebe a imagem e define o tamanho do grid com base no `cellSize`.
2. Redimensiona a imagem para esse grid (cada pixel vira uma célula do puzzle).
3. Usa quantização (`image-q` + `WuQuant`) para reduzir para N cores (`paletteSize`).
4. Para cada célula, escolhe a cor da paleta mais próxima e salva no `targetGrid`.
5. O `targetGrid` vira o gabarito: o canvas desenha números/guias e valida a pintura.
6. Durante a pintura, só células alteradas são redesenhadas (para melhor performance).

## Estrutura principal do código

```text
src/
  components/     # UI (upload, controles, paleta, canvas, exportar)
  composables/    # lógica reutilizável (worker, canvas, mouse paint)
  stores/         # regra de negócio e estado global (Pinia)
  workers/        # processamento de imagem em background
  assets/         # tokens visuais e estilos globais
```

## Sobre o glassmorphism neste projeto

O foco não foi só "deixar bonito", mas entender como "aplicar vidro" em CSS de forma consistente:

- Tokens de tema (claro/escuro) para cor, blur, borda, sombra e contraste.
- Fundo em camada separada (`#bg-layer`) para o `backdrop-filter` funcionar de forma estavel
- Superfícies com níveis diferentes (`glass-surface`, `--simple`, `--deep`) para criar hierarquia visual
- Persistência de tema no `localStorage`
