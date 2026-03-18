type RuntimeAppConfig = {
  ZUT_PLAN_BASE_URL?: string
}

declare global {
  interface Window {
    __APP_CONFIG__?: RuntimeAppConfig
  }
}

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '')

const runtimeConfig = window.__APP_CONFIG__ ?? {}

const planBaseUrl = runtimeConfig.ZUT_PLAN_BASE_URL || import.meta.env.ZUT_PLAN_BASE_URL

if (!planBaseUrl) {
  throw new Error('Missing required environment variable: ZUT_PLAN_BASE_URL')
}

export const appConfig = {
  zutPlanBaseUrl: trimTrailingSlash(planBaseUrl),
}
