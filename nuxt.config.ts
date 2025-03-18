export default defineNuxtConfig({
  devtools: { enabled: true },

  app: {
    head: {
      title: 'My Network Visualization',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
    },
  },

  build: {
    transpile: ['three']
  },

  compatibilityDate: '2025-01-16',
});
