import { portfolio } from '@/lib/portfolio'
import { band, BAND_COLOR, pct } from '@/lib/format'
import { useModel } from '@/lib/model'
import { Label, Meter, Panel, PanelHeader } from '@/components/ui/primitives'

const SOURCES = [
  ['Copernicus DEM GLO-30', 'Terrain', 'European Space Agency · free and open', '30 m DSM'],
  ['Overture Buildings', 'Footprints', 'CDLA-Permissive-2.0 · ODbL', '470,294 buildings'],
  ['ERA5 via Open-Meteo', 'Heat baseline', 'Copernicus / CC BY 4.0', '2015–2024 daily'],
  ['OpenFreeMap', 'Basemap', 'MIT · OpenStreetMap ODbL', 'vector tiles'],
  ['Hazus-style depth-damage', 'Vulnerability', 'FEMA methodology, hand-calibrated', '7 occupancy curves'],
]

const LIMITS = [
  'Screening-level: a terrain susceptibility surface, not a 2-D hydraulic flood model. There is no drainage-network routing and no rainfall–runoff hydrograph.',
  'A 30 m DEM resolves the ground, not the pipes. Dubai’s April 2024 flooding was driven as much by drainage capacity as by terrain, so depth is calibrated to observed ponding rather than simulated.',
  'Depth is mapped from the susceptibility index through a monotone lookup anchored on April 2024 observations (0.2–2.0 m). It is a screening depth, not a surveyed one.',
  'Heat is a regional ERA5 projection modulated by built-up density. It is not a building-scale microclimate model.',
  'Exposure, valuation and margins are illustrative. The engine runs unchanged against a real loan book.',
]

export function Evidence() {
  const { model, error } = useModel()

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <p className="text-[12.5px] font-medium text-ink">The model record could not be loaded</p>
        <p className="mono max-w-[420px] text-[11px] text-ink-3">{error}</p>
        <p className="text-[11px] text-ink-4">
          Expected at <span className="mono">/geo/model.json</span> — check the pipeline output was
          copied into <span className="mono">public/geo</span>.
        </p>
      </div>
    )
  }

  if (!model) {
    return (
      <div className="flex flex-1 items-center justify-center text-[12px] text-ink-3">
        Loading model record…
      </div>
    )
  }

  const v = model.validation
  const sortedSites = [...v.sites].sort((a, b) => b.flood - a.flood)

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1180px] space-y-4 px-5 py-5">
        <div>
          <h2 className="text-[19px] font-semibold tracking-[-0.025em] text-ink">
            Model &amp; evidence
          </h2>
          <p className="mt-1 max-w-[680px] text-[12.5px] leading-relaxed text-ink-3">
            Every figure in the product traces back to a documented source. This page is the audit
            trail an examiner — or a challenger — can pull apart.
          </p>
        </div>

        {/* headline validation */}
        <div className="grid grid-cols-3 gap-3">
          <Panel className="p-4">
            <Label>April 2024 agreement</Label>
            <div className="mt-2.5 flex items-baseline gap-1.5">
              <span className="mono text-[23px] leading-none text-ink">
                {v.captured_in_top_quartile}/{v.n_sites}
              </span>
              <span className="text-[10.5px] text-ink-3">reported districts</span>
            </div>
            <div className="mt-2.5">
              <Meter value={v.captured_in_top_quartile} max={v.n_sites} color="#34d399" height={4} />
            </div>
            <p className="mt-2 text-[11px] leading-snug text-ink-3">
              Land in the top quartile of built-up Dubai vs{' '}
              <span className="mono text-ink-2">{v.expected_by_chance}</span> expected by chance
            </p>
          </Panel>

          <Panel className="p-4">
            <Label>Median percentile rank</Label>
            <div className="mt-2.5 flex items-baseline gap-1.5">
              <span className="mono text-[23px] leading-none text-ink">
                {v.median_percentile_rank.toFixed(2)}
              </span>
              <span className="text-[10.5px] text-ink-3">of 1.00</span>
            </div>
            <div className="mt-2.5">
              <Meter value={v.median_percentile_rank} max={1} color="#38bdf8" height={4} />
            </div>
            <p className="mt-2 text-[11px] leading-snug text-ink-3">
              The typical flooded district sits at the{' '}
              {pct(v.median_percentile_rank, 0)} mark of the modelled surface
            </p>
          </Panel>

          <Panel className="p-4">
            <Label>Ground resolution</Label>
            <div className="mt-2.5 flex items-baseline gap-1.5">
              <span className="mono text-[23px] leading-none text-ink">
                {model.grid.meters_per_px.toFixed(1)}
              </span>
              <span className="text-[10.5px] text-ink-3">m / pixel</span>
            </div>
            <div className="mt-2.5">
              <Meter value={model.flood.resolution_m} max={60} color="#7c9cff" height={4} />
            </div>
            <p className="mt-2 text-[11px] leading-snug text-ink-3">
              {model.flood.dem} reprojected to a Web Mercator grid over Dubai
            </p>
          </Panel>
        </div>

        {v.tuning && (
          <Panel className="px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-risk-mod" />
              <Label>Read this before quoting the number</Label>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-ink-3">
              The weights were selected by sweeping{' '}
              <span className="mono text-ink-2">{v.tuning.configurations}</span> configurations
              against these same 20 districts, so the headline agreement is an{' '}
              <span className="text-ink-2">in-sample</span> figure. The winning configuration
              captures{' '}
              <span className="mono text-ink-2">{Math.round(v.tuning.capture_best * 20)}/20</span>;
              the median configuration captures{' '}
              <span className="mono text-ink-2">{Math.round(v.tuning.capture_median * 20)}/20</span>{' '}
              and the weakest{' '}
              <span className="mono text-ink-2">{Math.round(v.tuning.capture_worst * 20)}/20</span>. A
              held-out set of districts is the next validation step.
            </p>
          </Panel>
        )}

        <div className="grid grid-cols-2 gap-3">
          {/* flood model */}
          <Panel>
            <PanelHeader
              title="Pluvial model"
              hint="Terrain-based susceptibility screen — what drives the score"
            />
            <div className="mt-3 space-y-2">
              {Object.entries(model.flood.parameters.weights).map(([k, w]) => (
                <div key={k} className="flex items-center gap-3">
                  <span className="w-[168px] shrink-0 text-[11px] text-ink-2">
                    {k.replaceAll('_', ' ')}
                  </span>
                  <div className="flex-1">
                    <Meter value={w} max={0.4} color="#7c9cff" height={3} />
                  </div>
                  <span className="mono w-8 text-right text-[11px] text-ink-3">
                    {w.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            <dl className="mt-3.5 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line pt-3">
              <Cell k="Depression scale" v={`${model.flood.parameters.pond_scale_m} m @ 300 m`} />
              <Cell k="Basin scale" v={`${model.flood.parameters.basin_scale_m} m @ 1.2 km`} />
              <Cell k="Calibration" v="April 2024, 1-in-100yr" />
              <Cell k="Scenario multipliers" v="1.00 / 1.14 / 1.34" />
            </dl>
            <div className="mt-3 rounded-md border border-line bg-canvas/50 px-2.5 py-2">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-ink-4" />
                <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-4">
                  Tested and rejected
                </span>
              </div>
              {model.flood.rejected_terms.map((t) => (
                <p key={t} className="mt-1 text-[10.5px] leading-snug text-ink-3">
                  {t}
                </p>
              ))}
            </div>
          </Panel>

          {/* heat model */}
          <Panel>
            <PanelHeader
              title="Heat model"
              hint="ERA5 reanalysis baseline, projected with CMIP6 SSP2-4.5"
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Mini k="Mean daily max" v={`${model.heat.baseline.tmax_mean_c}°C`} />
              <Mini k="99th percentile" v={`${model.heat.baseline.tmax_p99_c}°C`} />
              <Mini k="Days over 40°C" v={String(model.heat.baseline.days_over_40c)} />
              <Mini k="Nights over 30°C" v={String(model.heat.baseline.nights_over_30c)} />
            </div>
            <table className="mt-3 w-full">
              <thead>
                <tr>
                  {['Scenario', 'Δ°C', '>40°C', '>45°C', 'Nights', 'Score'].map((h, i) => (
                    <th
                      key={h}
                      className={`py-1.5 text-[9.5px] font-medium uppercase tracking-[0.07em] text-ink-4 ${
                        i === 0 ? 'text-left' : 'text-right'
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(model.heat.detail).map(([k, d]) => (
                  <tr key={k} className="border-t border-line/70">
                    <td className="py-1.5 text-[11px] capitalize text-ink-2">
                      {k === 'now' ? 'Baseline' : k}
                    </td>
                    <td className="mono py-1.5 text-right text-[11px] text-ink-3">
                      +{d.delta_c}
                    </td>
                    <td className="mono py-1.5 text-right text-[11px] text-ink-2">
                      {d.days_over_40c}
                    </td>
                    <td className="mono py-1.5 text-right text-[11px] text-ink-2">
                      {d.days_over_45c}
                    </td>
                    <td className="mono py-1.5 text-right text-[11px] text-ink-2">
                      {d.nights_over_30c}
                    </td>
                    <td
                      className="mono py-1.5 text-right text-[11px]"
                      style={{ color: BAND_COLOR[band(d.score)] }}
                    >
                      {d.score}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2.5 border-t border-line pt-2.5 text-[10.5px] leading-relaxed text-ink-4">
              Threshold exceedance shifts with a uniform Δ°C translation of the observed
              temperature distribution; spatial variation comes from built-up density and elevation.
            </p>
          </Panel>
        </div>

        {/* validation sites */}
        <Panel flush>
          <div className="px-4 pb-3 pt-4">
            <PanelHeader
              title="Validation set"
              hint="20 districts reported flooded on 16–17 April 2024, scored blind by the screen"
              right={
                <span className="text-[10.5px] text-ink-4">
                  quartile cut-off <span className="mono text-ink-2">{v.built_up_quartile_threshold}</span>
                </span>
              }
            />
          </div>
          <div className="grid grid-cols-4 gap-px border-t border-line bg-line">
            {sortedSites.map((s) => (
              <div key={s.label} className="flex items-center gap-2 bg-surface px-3 py-2">
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: BAND_COLOR[band(s.flood)] }}
                />
                <span className="flex-1 truncate text-[10.5px] text-ink-2">{s.label}</span>
                <span className="mono text-[10.5px]" style={{ color: BAND_COLOR[band(s.flood)] }}>
                  {s.flood.toFixed(0)}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <div className="grid grid-cols-2 gap-3">
          <Panel flush>
            <div className="px-4 pb-2.5 pt-4">
              <PanelHeader title="Data sources" hint="All keyless, all reproducible" />
            </div>
            <table className="w-full">
              <tbody>
                {SOURCES.map(([name, use, licence, detail]) => (
                  <tr key={name} className="border-t border-line/70">
                    <td className="px-4 py-2">
                      <div className="text-[11.5px] text-ink">{name}</div>
                      <div className="text-[10px] text-ink-4">{licence}</div>
                    </td>
                    <td className="px-2 py-2 text-[10.5px] text-ink-3">{use}</td>
                    <td className="mono px-4 py-2 text-right text-[10px] text-ink-4">{detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <Panel>
            <PanelHeader title="Limitations" hint="Stated plainly, because an examiner will find them" />
            <ul className="mt-3 space-y-2">
              {LIMITS.map((l) => (
                <li key={l} className="flex gap-2">
                  <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-ink-4" />
                  <span className="text-[11px] leading-relaxed text-ink-3">{l}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <p className="pb-2 text-[10.5px] leading-relaxed text-ink-4">
          The hazard layer is deliberately swappable: replacing this screen with a licensed model
          (JBA, Climate X, Moody’s RMS) changes one input and leaves the exposure, vulnerability,
          financial and disclosure layers — and {portfolio.totals.facilities} facility records —
          untouched.
        </p>
      </div>
    </div>
  )
}

function Cell({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[9.5px] uppercase tracking-[0.07em] text-ink-4">{k}</dt>
      <dd className="mono mt-0.5 text-[11px] text-ink-2">{v}</dd>
    </div>
  )
}

function Mini({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-md border border-line bg-canvas/40 px-2.5 py-2">
      <div className="text-[9.5px] uppercase tracking-[0.07em] text-ink-4">{k}</div>
      <div className="mono mt-1 text-[14px] text-ink">{v}</div>
    </div>
  )
}
