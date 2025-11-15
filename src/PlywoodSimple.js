// src/PlywoodSimple.js
import React, { useEffect, useState } from "react";

/**
 * Simple read-only plywood catalog.
 * - Expects a published Google Sheets CSV at REACT_APP_CSV_URL
 * - CSV headers expected: id,category,photo_url,description,price_18mm,price_12mm,price_8mm,price_6mm,stock,visible
 *
 * Usage:
 * - Put REACT_APP_CSV_URL in your .env.local or Netlify env.
 * - Import and render <PlywoodSimple /> in App.js
 */

const CSV_URL = process.env.REACT_APP_CSV_URL || "https://docs.google.com/spreadsheets/d/e/2PACX-1vQoZSdWro_MtEAqvlyE3ZRLdPwOHG8JnSCvd5XUK1jnSBrWPsnl47_2tPvPs5t4_LeGwl72kPu03vuS/pub?gid=0&single=true&output=csv";

function escapeHTML(s) {
  if (!s && s !=0) return "";
  return String(s)
    .replace(/&/g, "&amp;&")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function formatDescriptionToHtml(raw) {
  if (!raw && raw !==0) return "";
  let safe=escapeHtml(raw);
  safe = safe.replace(/\*\*(.+?)\*\*/g, (m,p1) => {
    return `<strong>${p1}</strong>;
  });
  
  safe = safe.replace(/\*\*(.+?)\*\*/g, (m,p1) => {
    if (/^<strong>.*<\/strong>$/.test(p1)) return *${p1}*`;
    return `<em>${p1}</em>;
  });

  safe = safe.replace(/\r\n/g, "\n").replace(/\r/g,"\n");
  safe = safe.replace(/\n/g, "<br/>");
  return safe
}
            


function parseCSV(raw) {
  const rows = [];
  let i = 0, cur = "", row = [], inQuotes = false;
  while (i < raw.length) {
    const ch = raw[i];
    if (inQuotes) {
      if (ch === '"') {
        if (raw[i+1] === '"') { cur += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      cur += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === ',') { row.push(cur); cur = ""; i++; continue; }
    if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && raw[i+1] === '\n') i++;
      i++;
      row.push(cur);
      rows.push(row);
      row = []; cur = "";
      continue;
    }
    cur += ch; i++;
  }
  if (cur !== "" || row.length > 0) { row.push(cur); rows.push(row); }
  if (rows.length === 0) return [];
  const header = rows[0].map(h => h.trim());
  return rows.slice(1).map(r => {
    const obj = {};
    for (let j=0;j<header.length;j++) obj[header[j]] = r[j] !== undefined ? r[j].trim() : "";
    return obj;
  });
}

export default function PlywoodSimple() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { fetchCsv(); }, []);

  async function fetchCsv() {
    setLoading(true); setError(null);
    if (!CSV_URL || CSV_URL.includes("REPLACE_WITH")) {
      setError("Set REACT_APP_CSV_URL in .env.local or environment.");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(CSV_URL + (CSV_URL.includes("?") ? "&cb=" + Date.now() : "?cb=" + Date.now()));
      if (!res.ok) throw new Error(`Failed to fetch CSV: ${res.status}`);
      const text = await res.text();
      const parsed = parseCSV(text);
      // filter visible rows (visible blank OR true)
      const visible = parsed.filter(r => r.visible === "" || r.visible === "true" || r.visible === "1");
      setItems(visible);
      setLoading(false);
    } catch (err) {
      setError(err.message); setLoading(false);
    }
  }

  return (
    <div style={{ padding: 16, fontFamily: "Inter, system-ui, -apple-system, Arial" }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <h1 style={{ margin: 0 }}>Plywood Catalog</h1>
          </div>
        </header>

        {loading && <div style={{ padding: 24, textAlign: "center" }}>Loading…</div>}
        {error && <div style={{ padding: 24, color: "#b91c1c" }}>Error: {error}</div>}

<main style={{ display: "grid", gap: 20 }}>
  {items.map((item, index) => (
    <React.Fragment key={item.id || item.category}>
      <section
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: 16,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        {/* content */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ textAlign: "center" }}>
            <h2 style={{ margin: "4px 0" }}>{item.category}</h2>
            {item.photo_url ? (
              <img
                src={item.photo_url}
                alt={item.category}
                style={{
                  maxWidth: "100%",
                  maxHeight: 320,
                  objectFit: "contain",
                  borderRadius: 8,
                }}
              />
            ) : (
              <div
                style={{
                  height: 180,
                  background: "#f3f4f6",
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#9ca3af",
                }}
              >
                No image
              </div>
            )}
          </div>

          {item.description && (
            <div style={{ color: "#374151" }}
            dangerouslySetInnerHTML={{__html:formatDescriptionToHtml(item.description) }}
            </div>
          )}

          {/* Price table */}
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 14,
              }}
            >
              <thead style={{ background: "#f9fafb" }}>
                <tr>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "8px",
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    Size
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "8px",
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    Price
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: "8px" }}>18mm</td>
                  <td style={{ padding: "8px", textAlign: "right" }}>
                    ₹ {item.price_18mm || "—"}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: "8px" }}>12mm</td>
                  <td style={{ padding: "8px", textAlign: "right" }}>
                    ₹ {item.price_12mm || "—"}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: "8px" }}>8mm</td>
                  <td style={{ padding: "8px", textAlign: "right" }}>
                    ₹ {item.price_8mm || "—"}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: "8px" }}>6mm</td>
                  <td style={{ padding: "8px", textAlign: "right" }}>
                    ₹ {item.price_6mm || "—"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 👇 Divider line after each category */}
      {index !== items.length - 1 && (
        <hr
          style={{
            border: "none",
            borderTop: "2px solid #000",
            margin: "16px 0",
          }}
        />
      )}
    </React.Fragment>
  ))}
</main>


        <footer style={{ marginTop: 18, color: "#6b7280", fontSize: 13, textAlign: "center" }}>
          Plywood rates are indicative. Contact us for latest prices and availability.
        </footer>
      </div>
    </div>
  );
}
