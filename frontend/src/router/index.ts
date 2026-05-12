import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

// Incremental migration: only `/` is rendered by the SPA right now.
// Other routes (calendar, radio, transport, history) still live on Flask MPA;
// navigating to them forces a full page load so Flask can serve the legacy HTML.
const legacyRoutes = ['/calendar', '/radio', '/transport', '/history'];

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'dashboard',
    component: () => import('@/views/DashboardView.vue'),
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

export { legacyRoutes };
