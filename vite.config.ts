import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
// @ts-expect-error The Vercel route handler is intentionally plain JavaScript.
import routeHandler from './api/maps/route.js'
// @ts-expect-error The Vercel route handler is intentionally plain JavaScript.
import staticMapHandler from './api/maps/static.js'
// @ts-expect-error The Vercel route handler is intentionally plain JavaScript.
import orderParseHandler from './api/orders/parse.js'

function getQueryEntries(searchParams: URLSearchParams) {
  const query: Record<string, string | string[]> = {}

  searchParams.forEach((value, key) => {
    const currentValue = query[key]

    if (Array.isArray(currentValue)) {
      currentValue.push(value)
    } else if (currentValue !== undefined) {
      query[key] = [currentValue, value]
    } else {
      query[key] = value
    }
  })

  return query
}

async function readJsonBody(request: import('node:http').IncomingMessage) {
  const chunks: Buffer[] = []

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  if (chunks.length === 0) {
    return {}
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  if (!process.env.VITE_GOOGLE_MAPS_API_KEY && env.VITE_GOOGLE_MAPS_API_KEY) {
    process.env.VITE_GOOGLE_MAPS_API_KEY = env.VITE_GOOGLE_MAPS_API_KEY
  }

  if (!process.env.OPENAI_API_KEY && env.OPENAI_API_KEY) {
    process.env.OPENAI_API_KEY = env.OPENAI_API_KEY
  }

  if (!process.env.OPENAI_ORDER_PARSER_MODEL && env.OPENAI_ORDER_PARSER_MODEL) {
    process.env.OPENAI_ORDER_PARSER_MODEL = env.OPENAI_ORDER_PARSER_MODEL
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

            if (!env.GOOGLE_MAPS_API_KEY) {
              const productionRouteUrl = new URL(
                '/api/maps/route',
                'https://dispatch.capitallumber.co',
              )
              productionRouteUrl.search = requestUrl.search

              try {
                const productionResponse = await fetch(productionRouteUrl)
                const responseBody = await productionResponse.text()

                response.statusCode = productionResponse.status
                response.setHeader(
                  'Content-Type',
                  productionResponse.headers.get('content-type') ||
                    'application/json',
                )
                response.end(responseBody)
              } catch (proxyError) {
                response.statusCode = 502
                response.setHeader('Content-Type', 'application/json')
                response.end(
                  JSON.stringify({
                    error:
                      proxyError instanceof Error
                        ? proxyError.message
                        : 'Unable to reach the production route service.',
                  }),
                )
              }

              return
            }

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
                query: getQueryEntries(requestUrl.searchParams),
              },
              responseAdapter,
            )
          })

          server.middlewares.use('/api/maps/static', async (request, response) => {
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
              send(payload: Uint8Array | string) {
                response.statusCode = responseStatus
                response.end(payload)
              },
              end(payload: Uint8Array | string) {
                response.statusCode = responseStatus
                response.end(payload)
              },
            }

            await staticMapHandler(
              {
                method: request.method,
                headers: request.headers,
                query: getQueryEntries(requestUrl.searchParams),
              },
              responseAdapter,
            )
          })

          server.middlewares.use('/api/orders/parse', async (request, response) => {
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

            try {
              const body = await readJsonBody(request)

              await orderParseHandler(
                {
                  method: request.method,
                  headers: request.headers,
                  body,
                },
                responseAdapter,
              )
            } catch (error) {
              response.statusCode = 400
              response.setHeader('Content-Type', 'application/json')
              response.end(
                JSON.stringify({
                  error:
                    error instanceof Error
                      ? error.message
                      : 'Unable to read the upload request.',
                }),
              )
            }
          })
        },
      },
    ],
  }
})
