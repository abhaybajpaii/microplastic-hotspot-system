import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'

gsap.registerPlugin(ScrollTrigger)

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

const navigation = [
  { id: 'dashboard', label: 'Dashboard', icon: '◫' },
  { id: 'live-monitoring', label: 'Live Monitoring', icon: '◎' },
  { id: 'hotspot-analysis', label: 'Hotspot Analysis', icon: '⌖' },
  { id: 'data-insights', label: 'Data Insights', icon: '◇' },
]

const asNumber = (value) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

const isHotspot = (sensor) => Number(sensor.cluster) !== -1

const formatNumber = (value, decimals = 0) =>
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(asNumber(value))

const formatConcentration = (value) => {
  const numericValue = asNumber(value)
  return formatNumber(numericValue, numericValue > 0 && numericValue < 10 ? 2 : 0)
}

const formatCoordinate = (value) =>
  Number.isFinite(Number(value)) ? Number(value).toFixed(4) : 'Unavailable'

function AnimatedValue({ value, decimals = 0, suffix = '' }) {
  const elementRef = useRef(null)
  const playedRef = useRef(false)
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    const element = elementRef.current
    const target = asNumber(value)
    let animationFrame
    let observer
    playedRef.current = false

    const animate = () => {
      const startedAt = performance.now()
      const duration = 1100

      const update = (now) => {
        const progress = Math.min((now - startedAt) / duration, 1)
        const eased = 1 - (1 - progress) ** 3
        setDisplayValue(target * eased)

        if (progress < 1) {
          animationFrame = requestAnimationFrame(update)
        }
      }

      animationFrame = requestAnimationFrame(update)
    }

    const startOnce = () => {
      if (playedRef.current) return
      playedRef.current = true
      animate()
    }

    if (!element || !('IntersectionObserver' in window)) {
      startOnce()
    } else {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            startOnce()
            observer.disconnect()
          }
        },
        { threshold: 0.35 }
      )
      observer.observe(element)
    }

    return () => {
      observer?.disconnect()
      cancelAnimationFrame(animationFrame)
    }
  }, [value])

  return (
    <span ref={elementRef}>
      {formatNumber(displayValue, decimals)}
      {suffix}
    </span>
  )
}

function MapViewport({ sensors }) {
  const map = useMap()

  useEffect(() => {
    const points = sensors
      .filter(
        (sensor) =>
          Number.isFinite(Number(sensor.latitude)) &&
          Number.isFinite(Number(sensor.longitude))
      )
      .map((sensor) => [Number(sensor.latitude), Number(sensor.longitude)])

    if (points.length > 1) {
      map.fitBounds(points, { padding: [42, 42], maxZoom: 7 })
    } else if (points.length === 1) {
      map.setView(points[0], 7)
    }
  }, [map, sensors])

  return null
}

function SensorPopup({ sensor, hotspot }) {
  const details = [
    ['Concentration', formatConcentration(sensor.microplastic_concentration)],
    [
      'Cluster',
      hotspot ? `Cluster ${Number(sensor.cluster) + 1}` : 'Unclustered',
    ],
    ['Latitude', formatCoordinate(sensor.latitude)],
    ['Longitude', formatCoordinate(sensor.longitude)],
  ]

  if (sensor.particle_size !== undefined && sensor.particle_size !== null) {
    details.push(['Particle size', formatConcentration(sensor.particle_size)])
  }

  if (sensor.timestamp) {
    details.push(['Recorded', String(sensor.timestamp)])
  }

  return (
    <div className="sensor-popup">
      <div className="sensor-popup__header">
        <span className={`sensor-popup__signal ${hotspot ? 'danger' : ''}`} />
        <div>
          <span className="sensor-popup__label">Sensor telemetry</span>
          <strong>{sensor.sensor_id ? `Sensor ${sensor.sensor_id}` : 'Sensor ID unavailable'}</strong>
        </div>
      </div>
      <p className={`sensor-popup__state ${hotspot ? 'danger' : ''}`}>
        {hotspot ? 'Cluster-associated reading' : 'Unclustered reading'}
      </p>
      <div className="sensor-popup__rows">
        {details.map(([label, detail]) => (
          <div className="sensor-popup__row" key={label}>
            <span>{label}</span>
            <strong>{detail}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

function RiskDial({ risk }) {
  return (
    <div className={`risk-dial-wrap ${risk.label.toLowerCase()}`}>
      <div
        className={`risk-dial ${risk.label.toLowerCase()}`}
        style={{ '--risk-score': `${risk.score * 3.6}deg` }}
        aria-label={`Derived risk level: ${risk.label}, ${risk.score} percent`}
      >
        <span className="risk-dial__sweep" aria-hidden="true" />
        <span className="risk-dial__orbit" aria-hidden="true" />
        <div className="risk-dial__core">
          <strong>
            <AnimatedValue value={risk.score} suffix="%" />
          </strong>
          <span>Derived risk</span>
        </div>
      </div>
      <div className="risk-dial-copy">
        <span className="eyebrow">Current assessment</span>
        <h3>{risk.label}</h3>
        <p>{risk.description}</p>
      </div>
    </div>
  )
}

function App() {
  const appRef = useRef(null)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mapFilter, setMapFilter] = useState('all')
  const [activeSection, setActiveSection] = useState('dashboard')

  const loadAnalysis = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${API_BASE_URL}/analyze`)

      if (!response.ok) {
        throw new Error(`Analysis request failed (${response.status})`)
      }

      const result = await response.json()

      if (!Array.isArray(result?.data)) {
        throw new Error('The analysis response did not include sensor readings.')
      }

      setData(result)
    } catch (requestError) {
      setError(requestError.message || 'Unable to load analysis data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const requestTimer = window.setTimeout(loadAnalysis, 0)
    return () => window.clearTimeout(requestTimer)
  }, [loadAnalysis])

  useEffect(() => {
    const sectionIds = navigation.map((item) => item.id)
    const updateActiveSection = () => {
      const cursor = window.scrollY + Math.min(window.innerHeight * 0.32, 240)
      const current = sectionIds.reduce((selected, id) => {
        const section = document.getElementById(id)
        return section && cursor >= section.offsetTop ? id : selected
      }, 'dashboard')

      setActiveSection(current)
    }

    window.addEventListener('scroll', updateActiveSection, { passive: true })
    window.addEventListener('resize', updateActiveSection)
    updateActiveSection()

    return () => {
      window.removeEventListener('scroll', updateActiveSection)
      window.removeEventListener('resize', updateActiveSection)
    }
  }, [])

  const sensors = useMemo(() => (Array.isArray(data?.data) ? data.data : []), [data])
  const validSensors = useMemo(
    () =>
      sensors.filter(
        (sensor) =>
          Number.isFinite(Number(sensor.latitude)) &&
          Number.isFinite(Number(sensor.longitude))
      ),
    [sensors]
  )
  const hotspotSensors = useMemo(() => sensors.filter(isHotspot), [sensors])
  const filteredSensors = useMemo(() => {
    if (mapFilter === 'hotspots') return validSensors.filter(isHotspot)
    if (mapFilter === 'normal') return validSensors.filter((sensor) => !isHotspot(sensor))
    return validSensors
  }, [mapFilter, validSensors])

  const concentrationStats = useMemo(() => {
    const concentrations = sensors
      .map((sensor) => Number(sensor.microplastic_concentration))
      .filter(Number.isFinite)

    if (!concentrations.length) {
      return { average: 0, maximum: 0, minimum: 0 }
    }

    const total = concentrations.reduce((sum, value) => sum + value, 0)
    return {
      average: total / concentrations.length,
      maximum: Math.max(...concentrations),
      minimum: Math.min(...concentrations),
    }
  }, [sensors])

  const clusters = useMemo(() => {
    const grouped = new Map()

    hotspotSensors.forEach((sensor) => {
      const key = Number(sensor.cluster)
      const current = grouped.get(key) ?? {
        id: key,
        members: [],
        totalConcentration: 0,
        maximumConcentration: 0,
      }
      const concentration = asNumber(sensor.microplastic_concentration)
      current.members.push(sensor)
      current.totalConcentration += concentration
      current.maximumConcentration = Math.max(current.maximumConcentration, concentration)
      grouped.set(key, current)
    })

    return [...grouped.values()]
      .map((cluster) => ({
        ...cluster,
        averageConcentration: cluster.totalConcentration / cluster.members.length,
      }))
      .sort((a, b) => b.maximumConcentration - a.maximumConcentration)
  }, [hotspotSensors])

  const risk = useMemo(() => {
    const clusterCoverage = sensors.length ? hotspotSensors.length / sensors.length : 0
    const concentrationIntensity = concentrationStats.maximum
      ? Math.min(1, concentrationStats.average / concentrationStats.maximum)
      : 0
    const score = Math.round((clusterCoverage * 70 + concentrationIntensity * 30) * 100)
    const label = score >= 67 ? 'High' : score >= 34 ? 'Medium' : 'Low'
    const description =
      hotspotSensors.length > 0
        ? `Based on ${formatNumber(hotspotSensors.length)} cluster-associated readings and the observed concentration distribution.`
        : 'No DBSCAN cluster-associated readings are present in the current analysis.'

    return { score, label, description }
  }, [concentrationStats, hotspotSensors.length, sensors.length])

  const clusterBarMax = useMemo(() => Math.max(...clusters.map((cluster) => cluster.maximumConcentration), 1), [clusters])

  const alerts = useMemo(() => {
    const derivedAlerts = []

    if (clusters.length) {
      derivedAlerts.push({
        level: risk.label === 'High' ? 'danger' : 'warning',
        icon: '▲',
        title: `${formatNumber(clusters.length)} spatial cluster${clusters.length === 1 ? '' : 's'} detected`,
        message: `${formatNumber(hotspotSensors.length)} readings are associated with DBSCAN clusters.`,
        meta: 'Derived from current analysis',
      })
    }

    if (concentrationStats.maximum > 0) {
      derivedAlerts.push({
        level: 'info',
        icon: '◌',
        title: 'Peak concentration identified',
        message: `Highest current reading: ${formatConcentration(concentrationStats.maximum)}.`,
        meta: 'Measured telemetry',
      })
    }

    if (sensors.length) {
      derivedAlerts.push({
        level: 'success',
        icon: '✓',
        title: 'Analysis payload available',
        message: `${formatNumber(sensors.length)} sensor readings were returned by the analysis endpoint.`,
        meta: 'API response verified',
      })
    }

    return derivedAlerts
  }, [clusters.length, concentrationStats.maximum, hotspotSensors.length, risk.label, sensors.length])

  useLayoutEffect(() => {
    if (!data || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined
    }

    const cleanupListeners = []
    const ctx = gsap.context(() => {
      const intro = gsap.timeline({ defaults: { ease: 'power3.out' } })
      intro
        .from('.sidebar', { opacity: 0, x: -28, duration: 0.7 })
        .from('.nav-item', { opacity: 0, x: -14, stagger: 0.06, duration: 0.35 }, '-=0.32')
        .from('.hero-kicker, .hero-status', { opacity: 0, y: 14, duration: 0.45 }, '-=0.12')
        .from('.hero-line', { scaleX: 0, transformOrigin: 'left center', duration: 0.8 }, '-=0.18')
        .from('.hero-title__line', { opacity: 0, y: 42, stagger: 0.12, duration: 0.65 }, '-=0.5')
        .from('.hero-description, .hero-meta', { opacity: 0, y: 16, duration: 0.45, stagger: 0.08 }, '-=0.24')

      gsap.utils.toArray('.section-reveal').forEach((section) => {
        gsap.from(section, {
          opacity: 0,
          y: 32,
          duration: 0.68,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: section,
            start: 'top 88%',
            once: true,
          },
        })
      })

      const attachTilt = (element) => {
        const rotationX = gsap.quickTo(element, 'rotationX', { duration: 0.35, ease: 'power3.out' })
        const rotationY = gsap.quickTo(element, 'rotationY', { duration: 0.35, ease: 'power3.out' })
        const scale = gsap.quickTo(element, 'scale', { duration: 0.35, ease: 'power3.out' })
        const onMove = (event) => {
          const bounds = element.getBoundingClientRect()
          const x = (event.clientX - bounds.left) / bounds.width
          const y = (event.clientY - bounds.top) / bounds.height
          rotationY((x - 0.5) * 5)
          rotationX((0.5 - y) * 4)
          element.style.setProperty('--pointer-x', `${x * 100}%`)
          element.style.setProperty('--pointer-y', `${y * 100}%`)
        }
        const onEnter = () => scale(1.012)
        const onLeave = () => {
          rotationX(0)
          rotationY(0)
          scale(1)
        }
        element.addEventListener('pointermove', onMove)
        element.addEventListener('pointerenter', onEnter)
        element.addEventListener('pointerleave', onLeave)
        cleanupListeners.push(() => {
          element.removeEventListener('pointermove', onMove)
          element.removeEventListener('pointerenter', onEnter)
          element.removeEventListener('pointerleave', onLeave)
        })
      }

      const attachMagnetic = (element) => {
        const x = gsap.quickTo(element, 'x', { duration: 0.3, ease: 'power3.out' })
        const y = gsap.quickTo(element, 'y', { duration: 0.3, ease: 'power3.out' })
        const onMove = (event) => {
          const bounds = element.getBoundingClientRect()
          x(((event.clientX - bounds.left) / bounds.width - 0.5) * 5)
          y(((event.clientY - bounds.top) / bounds.height - 0.5) * 5)
        }
        const onLeave = () => {
          x(0)
          y(0)
        }
        element.addEventListener('pointermove', onMove)
        element.addEventListener('pointerleave', onLeave)
        cleanupListeners.push(() => {
          element.removeEventListener('pointermove', onMove)
          element.removeEventListener('pointerleave', onLeave)
        })
      }

      gsap.utils.toArray('[data-tilt]').forEach(attachTilt)
      gsap.utils.toArray('[data-magnetic]').forEach(attachMagnetic)

      const nodes = gsap.utils.toArray('.pipeline-node')
      const cores = gsap.utils.toArray('.pipeline-node__core')
      const pulses = gsap.utils.toArray('.pipeline-pulse')
      const pipeline = gsap.timeline({ repeat: -1, repeatDelay: 0.65 })

      nodes.forEach((node, index) => {
        pipeline
          .to(node, {
            scale: 1.05,
            y: -3,
            borderColor: 'rgba(180, 150, 255, 0.75)',
            boxShadow: 'inset 0 1px rgba(255,255,255,0.12), 0 0 36px rgba(168,138,255,0.3)',
            duration: 0.32,
            ease: 'power2.out',
          })
          .to(cores[index], { scale: 1.7, backgroundColor: '#cbb7ff', boxShadow: '0 0 18px #a88aff', duration: 0.22, ease: 'power2.out' }, '<')
          .to(node, { scale: 1, y: 0, borderColor: 'rgba(147, 123, 255, 0.38)', boxShadow: 'inset 0 1px rgba(255,255,255,0.08), 0 0 20px rgba(139,112,255,0.09)', duration: 0.38, ease: 'power2.inOut' })
          .to(cores[index], { scale: 1, backgroundColor: 'var(--violet)', boxShadow: '0 0 13px var(--violet)', duration: 0.28, ease: 'power2.inOut' }, '<')

        if (pulses[index]) {
          pipeline.fromTo(
            pulses[index],
            { xPercent: -120, opacity: 0 },
            { xPercent: 580, opacity: 1, duration: 0.55, ease: 'power2.inOut' },
            '-=0.3'
          )
        }
      })

      const dial = document.querySelector('.risk-dial')
      if (dial) {
        gsap.fromTo(
          dial,
          { '--risk-score': '0deg' },
          {
            '--risk-score': `${risk.score * 3.6}deg`,
            duration: 1.45,
            ease: 'power3.out',
            overwrite: true,
            scrollTrigger: {
              trigger: '.risk-panel',
              start: 'top 85%',
              once: true,
            },
          }
        )
        gsap.from('.risk-dial__sweep', {
          rotation: -45,
          opacity: 0,
          duration: 1.25,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '.risk-panel',
            start: 'top 85%',
            once: true,
          },
        })
      }

      gsap.from('.cluster-row, .alert-card', {
        opacity: 0, x: 20, stagger: 0.08, duration: 0.48, ease: 'power3.out', scrollTrigger: { trigger: '.analysis-grid', start: 'top 82%', once: true }
      })

      gsap.from('.insight-metric', {
        opacity: 0, y: 16, stagger: 0.08, duration: 0.45, ease: 'power3.out', scrollTrigger: { trigger: '.insights-section', start: 'top 84%', once: true }
      })

      gsap.utils.toArray('.insight-bar__fill').forEach((bar) => {
        const target = bar.getAttribute('data-width') || '0'
        gsap.fromTo(
          bar,
          { scaleX: 0 },
          { scaleX: 1, duration: 0.95, ease: 'power3.out', scrollTrigger: { trigger: '.insights-section', start: 'top 78%', once: true }, onStart: () => bar.style.setProperty('--target-width', `${target}%`) }
        )
      })
    }, appRef)

    return () => {
      cleanupListeners.forEach((cleanup) => cleanup())
      ctx.revert()
    }
  }, [data, risk.score])

  const scrollToSection = (id) => {
    setActiveSection(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (loading) {
    return (
      <main className="state-screen" aria-live="polite">
        <div className="state-orbit" />
        <p className="eyebrow">Coastal intelligence system</p>
        <h1>Initializing coastal analysis</h1>
        <p>Requesting the current sensor and hotspot analysis.</p>
      </main>
    )
  }

  if (error) {
    return (
      <main className="state-screen state-screen--error" aria-live="assertive">
        <div className="state-orbit" />
        <p className="eyebrow">Analysis unavailable</p>
        <h1>Connection to the analysis service failed</h1>
        <p>{error}</p>
        <button className="retry-button" type="button" onClick={loadAnalysis}>
          Retry analysis request
        </button>
      </main>
    )
  }

  const sensorCount = data?.total_sensor_readings ?? sensors.length
  const hotspotCount = data?.hotspots_detected ?? clusters.length
  const noiseCount = data?.noise_points ?? sensors.filter((sensor) => !isHotspot(sensor)).length

  return (
    <div className="app-shell" ref={appRef}>
      <div className="ambient-grid" aria-hidden="true" />
      <aside className="sidebar" aria-label="Primary navigation">
        <button className="brand" type="button" onClick={() => scrollToSection('dashboard')}>
          <span className="brand-mark">◈</span>
          <span>
            <strong>COASTAL / AI</strong>
            <small>Environmental intelligence</small>
          </span>
        </button>

        <nav className="nav-menu">
          {navigation.map((item) => (
            <button
              className={`nav-item ${activeSection === item.id ? 'active' : ''}`}
              data-magnetic
              key={item.id}
              type="button"
              onClick={() => scrollToSection(item.id)}
            >
              <span className="nav-item__icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className="status-light" />
          Analysis endpoint responsive
        </div>
      </aside>

      <main className="main-app">
        <header className="hero" id="dashboard">
          <div className="hero-topline">
            <p className="eyebrow hero-kicker">AI-powered coastal monitoring &amp; hotspot detection</p>
            <div className="hero-status">
              <span className="status-light" />
              Current analysis loaded
            </div>
          </div>
          <div className="hero-line" />
          <h1 className="hero-title">
            <span className="hero-title__line">COASTAL MICROPLASTIC</span>
            <span className="hero-title__line hero-title__line--accent">INTELLIGENCE</span>
          </h1>
          <p className="hero-description">
            A live spatial analysis of microplastic sensor readings, detected clusters, and derived environmental risk.
          </p>
          <div className="hero-meta">
            <span>DBSCAN spatial clustering</span>
            <span>•</span>
            <span>{formatNumber(validSensors.length)} mapped readings</span>
            <span>•</span>
            <span>API /analyze</span>
          </div>
        </header>

        <section className="stats-grid" aria-label="Analysis summary">
          <div className="reveal-card section-reveal">
            <article className="stat-card stat-card--cyan" data-tilt>
              <span className="pointer-light" aria-hidden="true" />
              <span className="stat-card__icon">◌</span>
              <p>Sensor readings</p>
              <strong><AnimatedValue value={sensorCount} /></strong>
              <small>Returned by current analysis</small>
            </article>
          </div>
          <div className="reveal-card section-reveal">
            <article className="stat-card stat-card--pink" data-tilt>
              <span className="pointer-light" aria-hidden="true" />
              <span className="stat-card__icon">⌖</span>
              <p>Hotspots detected</p>
              <strong><AnimatedValue value={hotspotCount} /></strong>
              <small>Unique DBSCAN clusters</small>
            </article>
          </div>
          <div className="reveal-card section-reveal">
            <article className="stat-card stat-card--violet" data-tilt>
              <span className="pointer-light" aria-hidden="true" />
              <span className="stat-card__icon">◫</span>
              <p>Average concentration</p>
              <strong><AnimatedValue value={concentrationStats.average} decimals={2} /></strong>
              <small>Source units retained</small>
            </article>
          </div>
          <div className="reveal-card section-reveal">
            <article className="stat-card stat-card--sea" data-tilt>
              <span className="pointer-light" aria-hidden="true" />
              <span className="stat-card__icon">⌁</span>
              <p>Unclustered readings</p>
              <strong><AnimatedValue value={noiseCount} /></strong>
              <small>DBSCAN noise classification</small>
            </article>
          </div>
        </section>

        <section className="monitoring-section section-reveal" id="live-monitoring">
          <article className="panel map-panel">
            <div className="panel-heading panel-heading--split">
              <div>
                <p className="eyebrow">Live geospatial analysis</p>
                <h2>Coastal sensor network</h2>
              </div>
              <div className="map-legend" aria-label="Map legend">
                <span><i className="legend-dot legend-dot--sensor" />Sensor</span>
                <span><i className="legend-dot legend-dot--hotspot" />Cluster member</span>
              </div>
            </div>

            <div className="map-controls" aria-label="Sensor map filters">
              {[
                ['all', 'All readings'],
                ['hotspots', 'Clusters'],
                ['normal', 'Unclustered'],
              ].map(([filter, label]) => (
                <button
                  className={`map-filter ${mapFilter === filter ? 'active' : ''}`}
                  key={filter}
                  type="button"
                  onClick={() => setMapFilter(filter)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="map-frame">
              <div className="map-grid-overlay" aria-hidden="true" />
              <div className="map-radar" aria-hidden="true"><span /></div>
              <div className="map-scan" aria-hidden="true" />
              <div className="map-hud map-hud--tl" aria-hidden="true"><span>COASTAL GRID</span><strong>LIVE</strong></div>
              <div className="map-hud map-hud--br" aria-hidden="true"><span>{formatNumber(validSensors.length)} NODES</span><strong>DBSCAN ACTIVE</strong></div>
              <div className="map-crosshair" aria-hidden="true" />
              <div className="map-corner map-corner--tl" aria-hidden="true" />
              <div className="map-corner map-corner--br" aria-hidden="true" />
              <MapContainer center={[19.076, 72.8777]} zoom={5} scrollWheelZoom className="coastal-map">
                <TileLayer
                  attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapViewport sensors={validSensors} />
                {filteredSensors.map((sensor, index) => {
                  const hotspot = isHotspot(sensor)
                  const center = [Number(sensor.latitude), Number(sensor.longitude)]
                  const markerKey = `${sensor.sensor_id ?? 'sensor'}-${sensor.cluster ?? 'none'}-${index}`

                  return (
                    <Fragment key={markerKey}>
                      {hotspot && (
                        <>
                          <CircleMarker
                            center={center}
                            className="hotspot-ring hotspot-ring--outer"
                            interactive={false}
                            pathOptions={{ color: '#ff7a9a', fill: false, opacity: 0.58, weight: 1.1 }}
                            radius={19}
                          />
                          <CircleMarker
                            center={center}
                            className="hotspot-ring hotspot-ring--mid"
                            interactive={false}
                            pathOptions={{ color: '#ff5f83', fill: false, opacity: 0.38, weight: 1 }}
                            radius={13}
                          />
                          <CircleMarker
                            center={center}
                            className="hotspot-ring hotspot-ring--inner"
                            interactive={false}
                            pathOptions={{ color: '#ffb3c4', fill: false, opacity: 0.42, weight: 0.8 }}
                            radius={10}
                          />
                        </>
                      )}
                      <CircleMarker
                        center={center}
                        className={hotspot ? 'hotspot-marker' : 'sensor-marker'}
                        pathOptions={{
                          color: hotspot ? '#ff5f83' : '#56e7ff',
                          fillColor: hotspot ? '#ff406c' : '#20cbea',
                          fillOpacity: hotspot ? 0.92 : 0.82,
                          weight: hotspot ? 2.5 : 1.4,
                        }}
                        radius={hotspot ? 9 : 5.5}
                      >
                        <Popup><SensorPopup sensor={sensor} hotspot={hotspot} /></Popup>
                      </CircleMarker>
                    </Fragment>
                  )
                })}
              </MapContainer>
            </div>
            <p className="map-caption">Select a marker to inspect the values returned by the current analysis.</p>
          </article>
        </section>

        <section className="intelligence-layout" aria-label="AI risk assessment">
          <article className="panel ai-panel section-reveal" data-tilt>
            <span className="pointer-light" aria-hidden="true" />
            <div className="panel-heading">
              <p className="eyebrow">Artificial intelligence</p>
              <h2>Risk assessment pipeline</h2>
              <p>Each stage mirrors the live backend analysis workflow.</p>
            </div>
            <div className="ai-pipeline" aria-label="Sensor data to risk analysis pipeline">
              {['Sensor data', 'DBSCAN', 'Hotspot detection', 'Risk analysis'].map((stage, index) => (
                <div className="pipeline-step" key={stage}>
                  <div className="pipeline-node">
                    <span className="pipeline-node__count">0{index + 1}</span>
                    <span>{stage}</span>
                    <i className="pipeline-node__core" />
                  </div>
                  {index < 3 && <div className="pipeline-line"><span className="pipeline-pulse" /></div>}
                </div>
              ))}
            </div>
            <div className="pipeline-note">
              <span>Flow status</span>
              <strong><i className="pipeline-note__live" /> Current API response processed</strong>
            </div>
          </article>

          <article className="panel risk-panel section-reveal">
            <div className="panel-heading">
              <p className="eyebrow">Derived signal</p>
              <h2>Risk posture</h2>
            </div>
            <RiskDial risk={risk} />
            <div className="risk-factors">
              <div><span>Cluster coverage</span><strong>{formatNumber(sensors.length ? (hotspotSensors.length / sensors.length) * 100 : 0)}%</strong></div>
              <div><span>Peak concentration</span><strong>{formatConcentration(concentrationStats.maximum)}</strong></div>
              <div><span>Clusters</span><strong>{formatNumber(clusters.length)}</strong></div>
            </div>
          </article>
        </section>

        <section className="analysis-grid" id="hotspot-analysis">
          <article className="panel cluster-panel section-reveal">
            <div className="panel-heading panel-heading--split">
              <div>
                <p className="eyebrow">Hotspot analysis</p>
                <h2>Detected spatial clusters</h2>
              </div>
              <span className="panel-badge">{formatNumber(clusters.length)} clusters</span>
            </div>
            <div className="cluster-list">
              {clusters.length ? clusters.slice(0, 6).map((cluster, index) => (
                <article className="cluster-row" data-tilt-row key={cluster.id}>
                  <span className="cluster-row__index">{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <strong>Cluster {cluster.id + 1}</strong>
                    <span>{formatNumber(cluster.members.length)} readings · average {formatConcentration(cluster.averageConcentration)}</span>
                  </div>
                  <div className="cluster-row__metric">
                    <span>Peak</span>
                    <strong>{formatConcentration(cluster.maximumConcentration)}</strong>
                  </div>
                </article>
              )) : <p className="empty-state">No DBSCAN clusters were returned in the current analysis.</p>}
            </div>
          </article>

          <article className="panel alerts-panel section-reveal">
            <div className="panel-heading">
              <p className="eyebrow">Intelligent monitoring</p>
              <h2>Smart alerts</h2>
            </div>
            <div className="alert-list">
              {alerts.map((alert) => (
                <article className={`alert-card ${alert.level}`} data-tilt-row key={alert.title}>
                  <span className="alert-card__icon">{alert.icon}</span>
                  <div>
                    <strong>{alert.title}</strong>
                    <p>{alert.message}</p>
                    <small>{alert.meta}</small>
                  </div>
                </article>
              ))}
            </div>
          </article>
        </section>

        <section className="insights-section" id="data-insights">
          <article className="panel insights-panel section-reveal">
            <div className="panel-heading panel-heading--split">
              <div>
                <p className="eyebrow">Data insights</p>
                <h2>Concentration overview</h2>
              </div>
              <span className="panel-badge panel-badge--violet">Current dataset</span>
            </div>
            <div className="insight-metrics">
              <div className="insight-metric"><span>Highest reading</span><strong><AnimatedValue value={concentrationStats.maximum} decimals={0} /></strong></div>
              <div className="insight-metric"><span>Average reading</span><strong><AnimatedValue value={concentrationStats.average} decimals={2} /></strong></div>
              <div className="insight-metric"><span>Lowest reading</span><strong><AnimatedValue value={concentrationStats.minimum} decimals={0} /></strong></div>
              <div className="insight-metric"><span>Mapped coverage</span><strong><AnimatedValue value={validSensors.length} /></strong></div>
            </div>
            <div className="insight-summary">
              <span className="insight-summary__icon">✦</span>
              <p>
                {clusters.length
                  ? `${formatNumber(hotspotSensors.length)} of ${formatNumber(sensors.length)} readings are associated with ${formatNumber(clusters.length)} detected spatial clusters.`
                  : 'The current analysis returned sensor readings without any DBSCAN cluster associations.'}
              </p>
            </div>
            <div className="insight-chart">
              <div className="insight-chart__heading">
                <span>Cluster concentration profile</span>
                <strong>PEAK / READING</strong>
              </div>
              <div className="insight-bars">
                {clusters.length ? clusters.slice(0, 6).map((cluster) => {
                  const width = Math.max(8, (cluster.maximumConcentration / clusterBarMax) * 100)
                  return (
                    <div className="insight-bar" key={cluster.id}>
                      <span className="insight-bar__label">C{cluster.id + 1}</span>
                      <div className="insight-bar__track">
                        <span className="insight-bar__fill" data-width={width.toFixed(2)} />
                      </div>
                      <strong>{formatConcentration(cluster.maximumConcentration)}</strong>
                    </div>
                  )
                }) : <p className="empty-state">No clustered concentration profile is available.</p>}
              </div>
            </div>
          </article>
        </section>

        <footer className="system-footer section-reveal">
          <div>
            <p className="eyebrow">Monitoring infrastructure</p>
            <h2>System status</h2>
            <p className="system-footer__note">Coastal intelligence stream · current payload verified</p>
          </div>
          <div className="system-statuses">
            <div><span>Analysis API</span><strong className="status-good"><i />Responsive</strong></div>
            <div><span>Clustering model</span><strong>DBSCAN</strong></div>
            <div><span>Mapped sensors</span><strong>{formatNumber(validSensors.length)}</strong></div>
            <div><span>Analysis source</span><strong>Current payload</strong></div>
          </div>
        </footer>
      </main>
    </div>
  )
}

export default App
