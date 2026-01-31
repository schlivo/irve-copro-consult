import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import AdminView from './views/AdminView.vue'
import './style.css'

// Router with admin page as standalone
const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/admin',
      name: 'admin',
      component: AdminView,
      meta: { standalone: true }
    },
    // Catch-all for tunnel navigation
    { path: '/:pathMatch(.*)*', component: { template: '' } }
  ]
})

const app = createApp(App)
app.use(router)
app.mount('#app')
