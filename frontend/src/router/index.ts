import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

// All five views are now served by the SPA (Faza 3 complete).
// The catch-all below only matches paths the SPA genuinely doesn't know,
// falling back to Flask via a full page load.
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'dashboard',
    component: () => import('@/views/DashboardView.vue'),
  },
  {
    path: '/calendar',
    name: 'calendar',
    component: () => import('@/views/CalendarView.vue'),
  },
  {
    path: '/radio',
    name: 'radio',
    component: () => import('@/views/RadioView.vue'),
  },
  {
    path: '/transport',
    name: 'transport',
    component: () => import('@/views/TransportView.vue'),
  },
  {
    path: '/history',
    name: 'history',
    component: () => import('@/views/HistoryView.vue'),
  },
  // Catch-all: anything not handled here falls through to Flask via window.location.
  {
    path: '/:pathMatch(.*)*',
    name: 'legacy',
    component: { render: () => null },
    beforeEnter(to) {
      window.location.assign(to.fullPath);
      return false;
    },
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
