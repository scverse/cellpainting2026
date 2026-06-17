// Leaflet map for the /local/ page. Markers come from window.LOCAL_MAP_POINTS
// (emitted by single.html). Each kind gets a distinct colour + Bootstrap icon
// (icon shape + colour, so they stay distinguishable for colour-blind readers).
// Keep the colours in sync with .map-legend__pin in main.scss.
(function () {
  const el = document.getElementById("local-map")
  const pts = window.LOCAL_MAP_POINTS || []
  if (!el || !pts.length || typeof L === "undefined") return

  // High-contrast hues that don't blend into OSM tiles (avoid green/yellow/grey).
  const KINDS = {
    venue: { color: "#e23744", icon: "bi-star-fill", size: 40 },
    hotel: { color: "#1f6feb", icon: "bi-building-fill", size: 32 },
    transit: { color: "#8e44ad", icon: "bi-train-front-fill", size: 32 },
  }
  const fallback = { color: "#111827", icon: "bi-geo-alt-fill", size: 32 }

  function pin(kind) {
    const c = KINDS[kind] || fallback
    return L.divIcon({
      className: "map-pin", // overrides Leaflet's default white-box .leaflet-div-icon
      html:
        '<span class="map-pin__badge" style="--pin:' + c.color + ';width:' + c.size + "px;height:" + c.size +
        'px"><i class="bi ' + c.icon + '"></i></span>',
      iconSize: [c.size, c.size],
      iconAnchor: [c.size / 2, c.size / 2],
      popupAnchor: [0, -c.size / 2],
    })
  }

  const map = L.map(el, { scrollWheelZoom: false })
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map)

  const markers = pts.map((p) => {
    // Build the popup via DOM nodes (textContent) so names with & / < / > can't
    // break or inject markup. With a url, the name becomes an external link.
    const label = document.createElement("strong")
    if (p.url) {
      const a = document.createElement("a")
      a.href = p.url
      a.target = "_blank"
      a.rel = "noopener"
      a.textContent = p.name
      label.appendChild(a)
    } else {
      label.textContent = p.name
    }
    return L.marker([p.lat, p.lng], { icon: pin(p.kind) }).addTo(map).bindPopup(label)
  })

  map.fitBounds(L.featureGroup(markers).getBounds().pad(0.25))
})()
