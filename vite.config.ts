import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function readRouteDurationSeconds(duration: unknown) {
  if (!duration || typeof duration !== 'string') {
    return 0
  }

  return Number(duration.replace('s', '')) || 0
}

function formatDuration(seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60))
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  if (hours > 0 && remainingMinutes > 0) {
    return `${hours} hr ${remainingMinutes} min`
  }

  if (hours > 0) {
    return `${hours} hr`
  }

  return `${minutes} min`
}

function formatDistance(meters: unknown) {
  const miles = Number(meters || 0) / 1609.344

  if (miles >= 10) {
    return `${Math.round(miles)} mi`
  }

  return `${miles.toFixed(1)} mi`
}

function sendJson(
  response: import('node:http').ServerResponse,
  statusCode: number,
  body: Record<string, unknown>,
) {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify(body))
}

function googleRouteDevApi(env: Record<string, string>) {
  const apiKey =
    env.GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    ''

  return {
    name: 'capital-dispatch-local-route-api',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use('/api/maps/route', async (request, response) => {
        if (request.method !== 'GET') {
          response.setHeader('Allow', 'GET')
          sendJson(response, 405, { error: 'Method not allowed' })
          return
        }

        const requestUrl = new URL(
          request.url || '',
          'http://localhost/api/maps/route',
        )
        const origin = String(requestUrl.searchParams.get('origin') || '').trim()
        const destination = String(
          requestUrl.searchParams.get('destination') || '',
        ).trim()
        const referer =
          request.headers.referer ||
          request.headers.origin ||
          'http://127.0.0.1:5174/'

        if (!apiKey) {
          sendJson(response, 500, {
            error:
              'Missing Google Maps server key. Add GOOGLE_MAPS_API_KEY for route ETA.',
          })
          return
        }

        if (!origin || !destination) {
          sendJson(response, 400, {
            error: 'Origin and destination are required.',
          })
          return
        }

        try {
          const routeResponse = await fetch(
            'https://routes.googleapis.com/directions/v2:computeRoutes',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask':
                  'routes.duration,routes.staticDuration,routes.distanceMeters,routes.polyline.encodedPolyline',
                Referer: String(referer),
              },
              body: JSON.stringify({
                origin: { address: origin },
                destination: { address: destination },
                travelMode: 'DRIVE',
                routingPreference: 'TRAFFIC_AWARE',
                computeAlternativeRoutes: false,
                units: 'IMPERIAL',
              }),
            },
          )
          const routeData = await routeResponse.json() as {
            error?: { message?: string }
            routes?: Array<{
              duration?: string
              staticDuration?: string
              distanceMeters?: number
              polyline?: { encodedPolyline?: string }
            }>
          }

          if (!routeResponse.ok) {
            sendJson(response, routeResponse.status, {
              error:
                routeData?.error?.message ||
                'Google Maps could not calculate this route.',
            })
            return
          }

          const route = Array.isArray(routeData.routes)
            ? routeData.routes[0]
            : null

          if (!route) {
            sendJson(response, 404, { error: 'No route found.' })
            return
          }

          const durationSeconds =
            readRouteDurationSeconds(route.duration) ||
            readRouteDurationSeconds(route.staticDuration)

          sendJson(response, 200, {
            durationSeconds,
            durationText: formatDuration(durationSeconds),
            distanceMeters: route.distanceMeters || 0,
            distanceText: formatDistance(route.distanceMeters),
            encodedPolyline: route.polyline?.encodedPolyline || '',
          })
        } catch (error) {
          console.error('Unable to calculate Google route locally:', error)
          sendJson(response, 500, { error: 'Unable to calculate route.' })
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      googleRouteDevApi(env),
      react(),
      tailwindcss(),
    ],
  }
})
