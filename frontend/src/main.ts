import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router';
import { vuetify } from './plugins/vuetify';
import '@mdi/font/css/materialdesignicons.css';
import 'vuetify/styles';
import './styles/app.scss';

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(vuetify);
app.mount('#app');
