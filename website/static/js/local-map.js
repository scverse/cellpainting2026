// Leaflet map for the /local/ page. Markers come from window.LOCAL_MAP_POINTS
// (emitted by single.html). circleMarkers avoid Leaflet's default-icon path issues.
(function () {
  const el = document.getElementById("local-map")
  const pts = window.LOCAL_MAP_POINTS || []
  if (!el || !pts.length || typeof L === "undefined") return

  const css = getComputedStyle(document.documentElement)
  const colors = {
    venue: css.getPropertyValue("--accent").trim() || "#262fb5",
    hotel: css.getPropertyValue("--highlight").trim() || "#74c8fa",
    transit: "#555555",
  }

  const map = L.map(el, { scrollWheelZoom: false })
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map)

  const markers = pts.map((p) => {
    // textContent (not an HTML string) so names with & / < / > can't break or inject markup.
    const label = document.createElement("strong")
    label.textContent = p.name
    return L.circleMarker([p.lat, p.lng], {
      radius: p.kind === "venue" ? 11 : 8,
      color: "#fff",
      weight: 2,
      fillColor: colors[p.kind] || "#777",
      fillOpacity: 1,
    })
      .addTo(map)
      .bindPopup(label)
  })

  map.fitBounds(L.featureGroup(markers).getBounds().pad(0.25))
})()
