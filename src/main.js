import "./assets/main.css";

import { createApp } from "vue";
import { createPinia } from "pinia"; // pinia e o gerenciador de estado (contexto)
import App from "./App.vue";
import { useColoringStore } from "./stores/coloring";

const app = createApp(App);
app.use(createPinia()); // registra o pinia no app pra todos os componentes conseguirem usar a store
// restaura o progresso salvo antes de montar o app
const store = useColoringStore();
store.loadFromStorage();

app.mount("#app"); // injeta o app dentro da div#app que ta no index.html
