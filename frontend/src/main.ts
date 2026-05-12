import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router';
import { i18n, currentLocale } from './i18n';

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(i18n);

document.documentElement.lang = currentLocale();

app.mount('#app');
