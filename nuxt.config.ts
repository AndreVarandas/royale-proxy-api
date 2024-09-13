// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: process.env.NODE_ENV === "development" },
  compatibilityDate: "2024-09-13",

  runtimeConfig: {
    CLASH_ROYALE_API_TOKEN: process.env.CLASH_ROYALE_API_TOKEN,
  },
});
