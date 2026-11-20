import { useState } from "react"

import Layout from "./components/Layout"
import Dashboard from "./pages/Dashboard"
import Scan from "./pages/Scan"
import Trade from "./pages/Trade"
import Analysis from "./pages/Analysis"
import Settings from "./pages/Settings"

const pages = {
  dashboard: Dashboard,
  scan: Scan,
  trade: Trade,
  analysis: Analysis,
  settings: Settings,
}

function TradingApp() {
  const [activePage, setActivePage] = useState("dashboard")
  const Page = pages[activePage]

  return (
    <Layout activePage={activePage} onNavigate={setActivePage}>
      <Page />
    </Layout>
  )
}

export default TradingApp
