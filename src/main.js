import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import 'element-plus/theme-chalk/dark/css-vars.css';
import 'uno.css';
import { useAppStore } from './store';

// Initialize the app
const app = createApp(App);

// Add Pinia store
const pinia = createPinia();
app.use(pinia);
app.use(router);
app.use(ElementPlus);

// Initialize database and mount app when ready
async function initApp() {
  try {
    // Mount app
    app.mount('#app');

    // Initialize the app store (which will initialize the database)
    const appStore = useAppStore();
    await appStore.initializeApp();

    console.log('Application initialized successfully');
  } catch (error) {
    console.error('Failed to initialize application:', error);

    // Show error message in DOM
    const appElement = document.getElementById('app');
    if (appElement) {
      appElement.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #e74c3c;">
          <h2>Application Initialization Error</h2>
          <p>${error.message}</p>
          <button id="retry-btn" style="padding: 10px 20px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer;">
            Retry
          </button>
        </div>
      `;

      // Add retry button handler
      document.getElementById('retry-btn').addEventListener('click', () => {
        window.location.reload();
      });
    }
  }
}

// Start the app
initApp();
