import { createRouter, createWebHistory } from 'vue-router'

import DetectView from '@/views/DetectView.vue'
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'detect',
      component: DetectView
    }
  ]
})

export default router
