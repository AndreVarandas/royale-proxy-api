// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },

  runtimeConfig: {
    CLASH_ROYALE_API_TOKEN: process.env.CLASH_ROYALE_API_TOKEN,
  },
});
