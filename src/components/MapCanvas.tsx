import { useEffect, useRef, useState } from 'react'
import {
  Map as MlMap,
  Marker,
  NavigationControl,
  Popup,
  type GeoJSONSource,
  type ImageSource,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { cn } from '@/lib/utils'
import { BAND_COLOR, band, ramp } from '@/lib/format'
import type { Scenario } from '@/lib/types'

export interface MapFacility {
  id: string
  customerId: string
  customerName: string
  name: string
  district: string
  lon: number
  lat: number
  floodScore: number
  heatScore: number
  depth100M: number
  heightM: number
  ring: [number, number][]
}

interface Props {
  facilities: MapFacility[]
  overlay: 'flood' | 'heat' | 'none'
  scenario: Scenario
  onPickCustomer?: (id: string) => void
  className?: string
  compact?: boolean
  focus?: [number, number] | null
  selectedCustomer?: string | null
}

const STYLE_URL = 'https://tiles.openfreemap.org/styles/dark'

interface GridMeta {
  x0: number
  y0: number
  z: number
  width: number
  height: number
}

/** Tile-aligned mosaic -> WGS84 corner coordinates for the raster overlay. */
function gridBounds(g: GridMeta) {
  const n = 2 ** g.z * 256
  const toLon = (px: number) => (px / n) * 360 - 180
  const toLat = (py: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * py) / n))) * 180) / Math.PI
  return {
    west: toLon(g.x0 * 256),
    east: toLon(g.x0 * 256 + g.width),
    north: toLat(g.y0 * 256),
    south: toLat(g.y0 * 256 + g.height),
  }
}

const EMPTY = { type: 'FeatureCollection' as const, features: [] as unknown[] }

export function MapCanvas({
  facilities,
  overlay,
  scenario,
  onPickCustomer,
  className,
  compact,
  focus,
  selectedCustomer,
}: Props) {
  const host = useRef<HTMLDivElement | null>(null)
  const map = useRef<MlMap | null>(null)
  const [ready, setReady] = useState(false)
  const [pitch3d, setPitch3d] = useState(false)
  const [sample, setSample] = useState<{ flood: number; heat: number } | null>(null)
  const pin = useRef<Marker | null>(null)

  // Latest props, readable from handlers registered once on load.
  const live = useRef({ overlay, scenario, onPickCustomer, facilities })
  live.current = { overlay, scenario, onPickCustomer, facilities }

  const grid = useRef<{ meta: GridMeta; flood: number[]; heat: number[]; w: number; h: number } | null>(
    null,
  )

  // ---- one-time init -------------------------------------------------
  useEffect(() => {
    if (!host.current || map.current) return
    const m = new MlMap({
      container: host.current,
      style: STYLE_URL,
      center: [55.245, 25.13],
      zoom: compact ? 11.5 : 10.35,
      pitch: 0,
      bearing: 0,
      attributionControl: { compact: true },
      dragRotate: false,
      maxZoom: 17.5,
      minZoom: 8.6,
    })
    map.current = m
    m.addControl(new NavigationControl({ showCompass: false }), 'bottom-right')

    // Keep the canvas in sync with the panel as it resizes.
    const ro = new ResizeObserver(() => m.resize())
    ro.observe(host.current)

    // The OpenFreeMap style references sprite icons it no longer ships. Supply a
    // transparent pixel for any of them so no layer fails to render.
    m.setMissingStyleImageResolver((id) => {
      if (m.hasImage(id)) return
      m.addImage(id, { width: 1, height: 1, data: new Uint8Array([0, 0, 0, 0]) })
    })

    const addLayers = () => {
      const firstSymbol = m.getStyle().layers?.find((l) => l.type === 'symbol')?.id
      const b = gridBounds({ x0: 5348, y0: 3498, z: 13, width: 3072, height: 3328 })

      m.addSource('hazard', {
        type: 'image',
        url: `/geo/${live.current.overlay}_${live.current.scenario}.png`,
        coordinates: [
          [b.west, b.north],
          [b.east, b.north],
          [b.east, b.south],
          [b.west, b.south],
        ],
      })
      m.addLayer(
        {
          id: 'hazard',
          type: 'raster',
          source: 'hazard',
          paint: { 'raster-opacity': 1, 'raster-fade-duration': 380 },
        },
        firstSymbol,
      )

      m.addSource('fac-foot', { type: 'geojson', data: EMPTY as never })
      m.addSource('fac-pt', { type: 'geojson', data: EMPTY as never })
      m.addSource('pt-hi', { type: 'geojson', data: EMPTY as never })

      m.addLayer(
        {
          id: 'fac-extrude',
          type: 'fill-extrusion',
          source: 'fac-foot',
          paint: {
            'fill-extrusion-color': [
              'interpolate',
              ['linear'],
              ['get', 'score'],
              0,
              '#1d6a58',
              40,
              '#24708f',
              62,
              '#b8912f',
              80,
              '#c4513f',
              100,
              '#b03427',
            ],
            'fill-extrusion-height': ['get', 'heightM'],
            'fill-extrusion-base': 0,
            'fill-extrusion-opacity': 0.9,
          },
        },
        firstSymbol,
      )

      m.addLayer({
        id: 'fac-dot',
        type: 'circle',
        source: 'fac-pt',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 2.4, 14, 5.2],
          'circle-color': [
            'interpolate',
            ['linear'],
            ['get', 'score'],
            0,
            '#34d399',
            40,
            '#38bdf8',
            62,
            '#fbbf24',
            80,
            '#fb7185',
            100,
            '#f04438',
          ],
          'circle-stroke-width': 1.1,
          'circle-stroke-color': '#08090b',
        },
      })

      m.addLayer({
        id: 'pt-halo',
        type: 'circle',
        source: 'pt-hi',
        paint: {
          'circle-radius': 13,
          'circle-color': 'transparent',
          'circle-stroke-width': 1,
          'circle-stroke-opacity': 0.5,
          'circle-stroke-color': ['get', 'color'],
        },
      })

      m.addLayer({
        id: 'fac-label',
        type: 'symbol',
        source: 'fac-pt',
        minzoom: 12.6,
        layout: {
          'text-field': ['get', 'customerName'],
          'text-size': 10,
          'text-offset': [0, 1.05],
          'text-anchor': 'top',
          'text-max-width': 9,
          'text-allow-overlap': false,
          'text-padding': 6,
        },
        paint: {
          'text-color': '#c9cfd9',
          'text-halo-color': '#08090b',
          'text-halo-width': 1.5,
        },
      })

      m.on('click', 'fac-dot', (e) => {
        const f = e.features?.[0]
        if (!f) return
        e.preventDefault()
        const p = f.properties as Record<string, string | number>
        const s = Number(p.score)
        new Popup({ offset: 13, closeButton: false, maxWidth: '270px' })
          .setLngLat((f.geometry as { coordinates: [number, number] }).coordinates)
          .setHTML(
            `<div style="padding:11px 13px;font-family:Inter,system-ui,sans-serif">
               <div style="font-size:9px;letter-spacing:.09em;text-transform:uppercase;color:#6b7280">${p.district}</div>
               <div style="font-size:13px;font-weight:600;color:#eceef1;margin-top:3px">${p.customerName}</div>
               <div style="font-size:11px;color:#8b929e;margin-top:2px">${p.name}</div>
               <div style="display:flex;gap:18px;margin-top:10px">
                 <div><div style="font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:#5b616b">Risk score</div>
                   <div style="font-family:'JetBrains Mono',monospace;font-size:16px;color:${BAND_COLOR[band(s)]}">${s.toFixed(0)}</div></div>
                 <div><div style="font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:#5b616b">1-in-100 depth</div>
                   <div style="font-family:'JetBrains Mono',monospace;font-size:16px;color:#eceef1">${Number(p.depth100M).toFixed(2)}<span style="font-size:10px;color:#737b87"> m</span></div></div>
               </div>
             </div>`,
          )
          .addTo(m)
        live.current.onPickCustomer?.(String(p.customerId))
      })

      m.on('mouseenter', 'fac-dot', () => {
        m.getCanvas().style.cursor = 'pointer'
      })
      m.on('mouseleave', 'fac-dot', () => {
        m.getCanvas().style.cursor = ''
      })

      // Bare-map click: sample the hazard field at that point.
      m.on('click', async (e) => {
        if (m.queryRenderedFeatures(e.point, { layers: ['fac-dot'] }).length) return
        if (!grid.current) {
          try {
            const [model, fl, ht] = await Promise.all([
              fetch('/geo/model.json').then((r) => r.json()),
              fetch('/geo/grid_flood.json').then((r) => r.json()),
              fetch('/geo/grid_heat.json').then((r) => r.json()),
            ])
            grid.current = { meta: model.grid, flood: fl.v, heat: ht.v, w: fl.w, h: fl.h }
          } catch {
            return
          }
        }
        const g = grid.current
        if (!g) return
        const n = 2 ** g.meta.z * 256
        const px = ((e.lngLat.lng + 180) / 360) * n
        const latR = (e.lngLat.lat * Math.PI) / 180
        const py = ((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2) * n
        const ix = Math.floor((px - g.meta.x0 * 256) / (g.meta.width / g.w))
        const iy = Math.floor((py - g.meta.y0 * 256) / (g.meta.height / g.h))
        if (ix < 0 || iy < 0 || ix >= g.w || iy >= g.h) return
        setSample({ flood: g.flood[iy * g.w + ix], heat: g.heat[iy * g.w + ix] })

        pin.current?.remove()
        const el = document.createElement('div')
        el.style.cssText =
          'width:9px;height:9px;border-radius:50%;border:1.5px solid #eceef1;background:rgba(236,238,241,0.12);box-shadow:0 0 0 5px rgba(236,238,241,0.08)'
        pin.current = new Marker({ element: el }).setLngLat(e.lngLat).addTo(m)
      })

      setReady(true)
    }

    if (m.isStyleLoaded()) addLayers()
    else m.once('style.load', addLayers)

    return () => {
      ro.disconnect()
      pin.current?.remove()
      pin.current = null
      m.remove()
      map.current = null
      setReady(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- hazard overlay swap -------------------------------------------
  useEffect(() => {
    const m = map.current
    if (!m || !ready) return
    if (overlay === 'none') {
      m.setLayoutProperty('hazard', 'visibility', 'none')
      return
    }
    m.setLayoutProperty('hazard', 'visibility', 'visible')
    const src = m.getSource('hazard') as ImageSource | undefined
    src?.updateImage({ url: `/geo/${overlay}_${scenario}.png` })
  }, [overlay, scenario, ready])

  // ---- facility data --------------------------------------------------
  useEffect(() => {
    const m = map.current
    if (!m || !ready) return
    const key = overlay === 'heat' ? 'heatScore' : 'floodScore'
    ;(m.getSource('fac-foot') as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: facilities.map((f) => ({
        type: 'Feature' as const,
        geometry: { type: 'Polygon' as const, coordinates: [f.ring] },
        properties: { heightM: f.heightM, score: f[key] },
      })),
    } as never)
    ;(m.getSource('fac-pt') as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: facilities.map((f) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [f.lon, f.lat] },
        properties: {
          id: f.id,
          customerId: f.customerId,
          customerName: f.customerName,
          name: f.name,
          district: f.district,
          depth100M: f.depth100M,
          score: f[key],
        },
      })),
    } as never)
  }, [facilities, overlay, ready])

  // ---- highlight the selected customer --------------------------------
  useEffect(() => {
    const m = map.current
    if (!m || !ready) return
    const f = selectedCustomer ? facilities.filter((x) => x.customerId === selectedCustomer) : []
    ;(m.getSource('pt-hi') as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: f.map((x) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [x.lon, x.lat] },
        properties: { color: BAND_COLOR[band(x.floodScore)] },
      })),
    } as never)
  }, [facilities, ready, selectedCustomer])

  // ---- 3D toggle ------------------------------------------------------
  useEffect(() => {
    map.current?.easeTo({ pitch: pitch3d ? 50 : 0, duration: 750 })
  }, [pitch3d])

  // ---- external focus -------------------------------------------------
  useEffect(() => {
    const m = map.current
    if (!m || !focus) return
    m.easeTo({ center: focus, zoom: Math.max(m.getZoom(), 13.4), duration: 900 })
  }, [focus])

  return (
    <div className={cn('relative overflow-hidden bg-canvas', className)}>
      {/* MapLibre's own stylesheet forces .maplibregl-map to position:relative, so the
          host must be sized explicitly rather than inset-positioned. */}
      <div ref={host} className="h-full w-full" />
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_130px_30px_rgba(8,9,11,0.7)]" />

      {!compact && (
        <div className="absolute left-3 top-3 flex items-center gap-1.5">
          <button
            onClick={() => setPitch3d((v) => !v)}
            className={cn(
              'rounded-md border px-2.5 py-1.5 text-[11px] font-medium backdrop-blur-md transition-colors',
              pitch3d
                ? 'border-accent/35 bg-accent/15 text-accent'
                : 'border-line-2 bg-canvas/85 text-ink-2 hover:text-ink',
            )}
          >
            {pitch3d ? '3D on' : '3D'}
          </button>
          <div className="rounded-md border border-line-2 bg-canvas/85 px-2.5 py-1.5 text-[11px] text-ink-3 backdrop-blur-md">
            Click to sample
          </div>
        </div>
      )}

      {sample && (
        <div className="absolute bottom-4 left-4 w-[214px] rounded-lg border border-line-2 bg-canvas/93 p-3 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-[0.09em] text-ink-3">
              Point sample
            </span>
            <button
              onClick={() => {
                setSample(null)
                pin.current?.remove()
                pin.current = null
              }}
              className="text-ink-4 transition-colors hover:text-ink"
              aria-label="Clear sample"
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className="mt-2.5 space-y-2">
            <SampleRow label="Pluvial" value={sample.flood} />
            <SampleRow label="Heat" value={sample.heat} />
          </div>
          <p className="mt-2.5 border-t border-line pt-2 text-[10.5px] leading-snug text-ink-4">
            Susceptibility index, 30 m terrain screen.
          </p>
        </div>
      )}
    </div>
  )
}

function SampleRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-ink-3">{label}</span>
      <div className="flex items-center gap-2">
        <div className="h-[3px] w-16 overflow-hidden rounded-full bg-white/[0.07]">
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.min(100, value)}%`, background: ramp(value) }}
          />
        </div>
        <span className="mono w-6 text-right text-[11.5px] text-ink">{value.toFixed(0)}</span>
      </div>
    </div>
  )
}
