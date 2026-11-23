import { useEffect, useMemo, useState } from 'react'
import './aegis.css'

const GRAPHQL_URL = import.meta.env.VITE_GRAPHQL_URL || 'http://localhost:4000/graphql'
const APP_ENV = (import.meta.env.VITE_APP_ENV || 'dev').toLowerCase()

type Connector = { id: string; stationId: string; type: string; powerKw: number; status: string }
type Station = { id: string; name: string; city: string; connectors: Connector[] }
type Wallet = { fleetId: string; balanceCents: number }
type Flag = { name: string; enabled: boolean; updatedAt?: string }
type Compensation = { step: string; outcome: string; at: string }
type Saga = { id: string; status: string; fleetId: string; stationId: string; connectorId: string; correlationId: string; failureReason?: string; createdAt: string; updatedAt: string; compensations: Compensation[] }

async function graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  const payload = await response.json()
  if (payload.errors?.length) throw new Error(payload.errors.map((error: { message: string }) => error.message).join('; '))
  return payload.data as T
}

function App() {
  const [stations, setStations] = useState<Station[]>([])
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [flags, setFlags] = useState<Flag[]>([])
  const [sagas, setSagas] = useState<Saga[]>([])
  const [selectedStation, setSelectedStation] = useState('station-001')
  const [selectedConnector, setSelectedConnector] = useState('connector-001')
  const [estimatedKwh, setEstimatedKwh] = useState(10)
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ text: string; error: boolean } | null>(null)

  const refresh = async () => {
    try {
      const data = await graphql<{ stations: Station[]; wallet: Wallet; featureFlags: Flag[]; sagas: Saga[] }>(`
        query Dashboard($fleetId: ID!) {
          stations { id name city connectors { id stationId type powerKw status } }
          wallet(fleetId: $fleetId) { fleetId balanceCents }
          featureFlags { name enabled updatedAt }
          sagas(fleetId: $fleetId, limit: 20) { id status fleetId stationId connectorId correlationId failureReason createdAt updatedAt compensations { step outcome at } }
        }`, { fleetId: 'fleet-001' })
      setStations(data.stations)
      setWallet(data.wallet)
      setFlags(data.featureFlags)
      setSagas(data.sagas)
    } catch (error) {
      setFeedback({ text: error instanceof Error ? error.message : 'No fue posible conectar con GraphQL', error: true })
    }
  }

  useEffect(() => {
    void refresh()
    const interval = window.setInterval(() => void refresh(), 4000)
    return () => window.clearInterval(interval)
  }, [])

  const selectedStationData = useMemo(() => stations.find(station => station.id === selectedStation), [stations, selectedStation])

  const reserveAndActivate = async () => {
    setLoading(true)
    setFeedback(null)
    try {
      const data = await graphql<{ reserveAndActivateCharge: Saga }>(`
        mutation Reserve($input: ReserveAndActivateInput!) {
          reserveAndActivateCharge(input: $input) {
            id status fleetId stationId connectorId correlationId failureReason createdAt updatedAt
            compensations { step outcome at }
          }
        }`, { input: { fleetId: 'fleet-001', stationId: selectedStation, connectorId: selectedConnector, estimatedKwh } })
      const saga = data.reserveAndActivateCharge
      setFeedback({ text: `SAGA ${saga.id.slice(0, 8)} → ${saga.status}${saga.failureReason ? `: ${saga.failureReason}` : ''}`, error: saga.status === 'FAILED' || saga.status === 'COMPENSATED' && saga.compensations.length === 0 })
      await refresh()
    } catch (error) {
      setFeedback({ text: error instanceof Error ? error.message : 'La carga no pudo iniciarse', error: true })
    } finally {
      setLoading(false)
    }
  }

  const stopCharge = async (sagaId: string) => {
    setLoading(true)
    setFeedback(null)
    try {
      const data = await graphql<{ stopCharge: Saga }>(`
        mutation Stop($sagaId: ID!) {
          stopCharge(sagaId: $sagaId) { id status updatedAt }
        }`, { sagaId })
      setFeedback({ text: `Carga ${data.stopCharge.id.slice(0, 8)} detenida: conector liberado`, error: false })
      await refresh()
    } catch (error) {
      setFeedback({ text: error instanceof Error ? error.message : 'No se pudo detener la carga', error: true })
    } finally {
      setLoading(false)
    }
  }

  const toggleFlag = async (flag: Flag) => {
    try {
      await graphql<{ setFeatureFlag: Flag }>(`
        mutation SetFlag($name: String!, $enabled: Boolean!) {
          setFeatureFlag(name: $name, enabled: $enabled) { name enabled updatedAt }
        }`, { name: flag.name, enabled: !flag.enabled })
      await refresh()
      setFeedback({ text: `${flag.name} actualizada sin reiniciar servicios`, error: false })
    } catch (error) {
      setFeedback({ text: error instanceof Error ? error.message : 'No se pudo cambiar la flag', error: true })
    }
  }

  const selectConnector = (stationId: string, connector: Connector) => {
    setSelectedStation(stationId)
    setSelectedConnector(connector.id)
  }

  return (
    <div className="shell">
      <div className={`banner ${APP_ENV}`} />
      <header className="topbar">
        <div className="brand">
          <div className="brandmark">A</div>
          <div><h1>AegisVolt Control</h1><p>EV fleet operations</p></div>
        </div>
        <div className={`environment ${APP_ENV}`}>{APP_ENV} environment</div>
      </header>

      <main className="main">
        <div className="grid">
          <section>
            <div className="panel">
              <div className="panelhead"><h2>Estaciones y conectores</h2><span className="live">● Polling 4 s</span></div>
              <div className="stations">
                {stations.map(station => (
                  <article className="station" key={station.id}>
                    <h3>{station.name}</h3><div className="city">{station.city}</div>
                    <div className="connectors">
                      {station.connectors.map(connector => (
                        <button key={connector.id} className={`connector ${connector.status.toLowerCase()} ${selectedConnector === connector.id ? 'selected' : ''}`} onClick={() => selectConnector(station.id, connector)} title={`${connector.type} · ${connector.powerKw} kW`}>
                          {connector.id.replace('connector-', 'C')} · {connector.status}
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="panel reserve">
              <h2>Reservar y activar carga</h2>
              <div className="fieldgrid">
                <label className="field">Estación
                  <select value={selectedStation} onChange={event => setSelectedStation(event.target.value)}>
                    {stations.map(station => <option value={station.id} key={station.id}>{station.name}</option>)}
                  </select>
                </label>
                <label className="field">Conector
                  <select value={selectedConnector} onChange={event => setSelectedConnector(event.target.value)}>
                    {(selectedStationData?.connectors || []).map(connector => <option value={connector.id} key={connector.id}>{connector.id} · {connector.powerKw} kW · {connector.status}</option>)}
                  </select>
                </label>
                <label className="field">Flota
                  <input value="fleet-001" readOnly />
                </label>
                <label className="field">Energia estimada (kWh)
                  <input type="number" min="1" max="100" value={estimatedKwh} onChange={event => setEstimatedKwh(Number(event.target.value))} />
                </label>
              </div>
              <button className="primary" disabled={loading} onClick={() => void reserveAndActivate()}>{loading ? 'Ejecutando SAGA...' : 'Iniciar reserva y carga'}</button>
              {feedback && <div className={`feedback ${feedback.error ? 'error' : ''}`}>{feedback.text}</div>}
            </div>
          </section>

          <aside>
            <section className="panel wallet">
              <div className="panelhead"><h2>Billetera de flota</h2></div>
              <div className="walletrow"><strong>fleet-001</strong><div className="walletvalue">{wallet ? wallet.balanceCents.toLocaleString('es-CO') : '—'} <span>centavos</span></div></div>
            </section>

            <section className="panel flags">
              <div className="panelhead"><h2>Feature Flags</h2><span className="live">● En vivo</span></div>
              <div className="flaglist">
                {flags.map(flag => (
                  <div className="flagrow" key={flag.name}><span className="flagname">{flag.name.replaceAll('ENABLE_', '').replaceAll('SIMULATE_CHARGER_', '')}</span><button className={`switch ${flag.enabled ? 'on' : ''}`} onClick={() => void toggleFlag(flag)} aria-label={`Cambiar ${flag.name}`}><i /></button></div>
                ))}
              </div>
            </section>
          </aside>
        </div>

        <section className="panel history">
          <div className="panelhead"><h2>Historial de SAGAs</h2><span className="muted">Últimas 20</span></div>
          <div className="tablewrap">
            <table className="table">
              <thead><tr><th>ID</th><th>Estado</th><th>Ruta</th><th>Actualizada</th><th>Compensaciones</th></tr></thead>
              <tbody>{sagas.map(saga => (
                <tr key={saga.id}><td>{saga.id.slice(0, 8)}</td><td><span className={`status ${saga.status.toLowerCase()}`}>{saga.status}</span></td><td>{saga.stationId} / {saga.connectorId}</td><td className="muted">{new Date(saga.updatedAt).toLocaleString('es-CO')}</td><td>{saga.compensations.length ? saga.compensations.map(compensation => <span className="compensation" key={`${compensation.step}-${compensation.at}`}>{compensation.step}: {compensation.outcome}</span>) : saga.status === 'COMPLETED' && stations.some(station => station.id === saga.stationId && station.connectors.some(connector => connector.id === saga.connectorId && connector.status === 'IN_USE')) && [...sagas].filter(candidate => candidate.status === 'COMPLETED' && candidate.stationId === saga.stationId && candidate.connectorId === saga.connectorId).sort((a,b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0]?.id === saga.id ? <button className="stopbutton" disabled={loading} onClick={() => void stopCharge(saga.id)}>Detener carga</button> : <span className="muted">—</span>}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
