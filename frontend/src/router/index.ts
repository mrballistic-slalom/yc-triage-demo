import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/board' },
  {
    path: '/board',
    name: 'board',
    component: () => import('@/views/BoardView.vue'),
  },
  {
    path: '/sprints',
    name: 'sprints',
    component: () => import('@/views/SprintsView.vue'),
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue'),
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
