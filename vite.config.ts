import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
// @ts-expect-error The Vercel route handler is intentionally plain JavaScript.
import routeHandler from './api/maps/route.js'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  if (!process.env.VITE_GOOGLE_MAPS_API_KEY && env.VITE_GOOGLE_MAPS_API_KEY) {
    process.env.VITE_GOOGLE_MAPS_API_KEY = env.VITE_GOOGLE_MAPS_API_KEY
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'capital-local-maps-api',
        configureServer(server) {
          server.middlewares.use('/api/maps/route', async (request, response) => {
            const requestUrl = new URL(
              request.url || '/',
              'http://localhost',
            )
            let responseStatus = 200
            const responseAdapter = {
              setHeader(name: string, value: string) {
                response.setHeader(name, value)
              },
              status(statusCode: number) {
                responseStatus = statusCode
                return responseAdapter
              },
              json(payload: unknown) {
                response.statusCode = responseStatus
                response.setHeader('Content-Type', 'application/json')
                response.end(JSON.stringify(payload))
              },
            }

            await routeHandler(
              {
                method: request.method,
                headers: request.headers,
                query: Object.fromEntries(requestUrl.searchParams.entries()),
              },
              responseAdapter,
            )
          })
        },
      },
    ],
  }
})
