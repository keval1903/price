// src/PlywoodSingle.js
import React, { useEffect, useState } from "react";

/*
  PlywoodSinglePhoto Component
  - Fetches CSV at REACT_APP_CSV_URL (published Google Sheet CSV)
  - Shows one image per category and a table of size prices
  - Admin panel can create/edit/delete rows via a server endpoint:
      - In production use: call /api/proxy (Netlify Function) which injects ADMIN_TOKEN
      - For local dev, set REACT_APP_BYPASS_PROXY=true to POST directly to APPS_SCRIPT_ENDPOINT
*/

const CSV_URL = process.env.REACT_APP_CSV_URL || "REPLACE_WITH_YOUR_CSV_URL";
const APPS_SCRIPT_ENDPOINT = process.env.REACT_APP_APPS_SCRIPT_ENDPOINT || "REPLACE_WITH_YOUR_APPS_SCRIPT_ENDPOINT";
const BYPASS_PROXY = (process.env.REACT_APP_BYPASS_PROXY || "false") === "true";
const ADMIN_TOKEN = process.env.REACT_APP_ADMIN_TOKEN || "";

function parseCSV(raw) {
  // Minimal CSV parser (handles quoted fields)
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
      // handle CRLF or LF
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
  const data = rows.slice(1).map(r => {
    const obj = {};
    for (let j = 0; j < header.length; j++) {
      obj[header[j]] = r[j] !== undefined ? r[j].trim() : "";
    }
    return obj;
  });
  return data;
}

export default function PlywoodSinglePhoto() {
  const [items, setItems] = useState([]);
  const [rowsFlat, setRowsFlat] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Admin UI state
  const [adminMode, setAdminMode] = useState(false);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => { fetchSheet(); }, []);

  function fetchSheet() {
    setLoading(true); setError(null);
    if (!CSV_URL || CSV_URL.includes("REPLACE_WITH")) {
      setError("Please set REACT_APP_CSV_URL in .env.local or env.");
      setLoading(false);
      return;
    }
    fetch(CSV_URL)
      .then(r => { if (!r.ok) throw new Error(`Fetch failed ${r.status}`); return r.text(); })
      .then(text => {
        const parsed = parseCSV(text);
        setRowsFlat(parsed);
        setItems(parsed.filter(row => (row.visible === "" || row.visible === "true" || row.visible === "1")));
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }

  async function adminRequest(action, payload) {
    setBusy(true); setMessage(null);
    try {
      if (BYPASS_PROXY) {
        // Local dev: post directly to Apps Script endpoint with token
        const res = await fetch(APPS_SCRIPT_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: ADMIN_TOKEN, action, payload })
        });
        const json = await res.json();
        setBusy(false);
        if (!res.ok) { setMessage({ type: 'error', text: json?.error || 'Request failed' }); return { ok: false }; }
        setMessage({ type: 'success', text: json?.message || 'Success' });
        fetchSheet();
        return { ok: true, json };
      } else {
        // Production: post to proxy endpoint (Netlify function) which injects ADMIN_TOKEN server-side
        const res = await fetch('/api/proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, payload })
        });
        const text = await res.text();
        let json;
        try { json = JSON.parse(text); } catch(e) { json = { raw: text }; }
        setBusy(false);
        if (!res.ok) { setMessage({ type: 'error', text: json?.error || 'Request failed' }); return { ok: false }; }
        setMessage({ type: 'success', text: json?.message || 'Success' });
        fetchSheet();
        return { ok: true, json };
      }
    } catch (err) {
      setBusy(false); setMessage({ type: 'error', text: err.message }); return { ok: false };
    }
  }

  function startEdit(row) { setEditing({ ...row }); setAdminMode(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function newRow() { setEditing({ id: '', category: '', photo_url: '', description: '', price_18mm: '', price_12mm: '', price_8mm: '', price_6mm: '', stock: '', visible: 'true' }); setAdminMode(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }

  function saveEdit() {
    if (!editing || !editing.id || !editing.category) { setMessage({ type: 'error', text: 'id and category required' }); return; }
    adminRequest('upsert', editing);
    setEditing(null);
  }
  function deleteRow(row) {
    if (!window.confirm(`Delete ${row.id || row.category}?`)) return;
    adminRequest('delete', { id: row.id });
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 flex justify-center">
      <div className="w-full max-w-4xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Plywood Price List</h1>
            <div className="text-sm text-gray-500">One image per category — sizes shown in a price table.</div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => { setAdminMode(m => !m); setMessage(null); }} className="px-3 py-1 rounded border">{adminMode ? 'Hide Admin' : 'Show Admin'}</button>
            <button onClick={fetchSheet} className="px-3 py-1 rounded border">Refresh</button>
          </div>
        </div>

        {message && <div className={`p-3 rounded mb-3 ${message.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{message.text}</div>}

        {adminMode && (
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Admin Panel</h2>
                <p className="text-xs text-gray-500">Create or edit category rows. Changes are written to your Google Sheet through the Apps Script endpoint.</p>
                <p className="text-xs text-gray-400">Production should use Netlify proxy; for local dev set REACT_APP_BYPASS_PROXY=true in .env.local.</p>
              </div>
              <div>
                <button onClick={newRow} className="px-3 py-1 rounded border">New Category</button>
              </div>
            </div>

            {editing && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs">id (unique)</label>
                  <input value={editing.id} onChange={e => setEditing({ ...editing, id: e.target.value })} className="w-full border rounded p-2" />
                </div>
                <div>
                  <label className="text-xs">category</label>
                  <input value={editing.category} onChange={e => setEditing({ ...editing, category: e.target.value })} className="w-full border rounded p-2" />
                </div>
                <div>
                  <label className="text-xs">photo_url (direct link)</label>
                  <input value={editing.photo_url} onChange={e => setEditing({ ...editing, photo_url: e.target.value })} className="w-full border rounded p-2" />
                </div>
                <div>
                  <label className="text-xs">stock</label>
                  <input value={editing.stock} onChange={e => setEditing({ ...editing, stock: e.target.value })} className="w-full border rounded p-2" />
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs">description</label>
                  <textarea value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} className="w-full border rounded p-2" rows={3} />
                </div>

                <div>
                  <label className="text-xs">price_18mm</label>
                  <input value={editing.price_18mm} onChange={e => setEditing({ ...editing, price_18mm: e.target.value })} className="w-full border rounded p-2" />
                </div>
                <div>
                  <label className="text-xs">price_12mm</label>
                  <input value={editing.price_12mm} onChange={e => setEditing({ ...editing, price_12mm: e.target.value })} className="w-full border rounded p-2" />
                </div>
                <div>
                  <label className="text-xs">price_8mm</label>
                  <input value={editing.price_8mm} onChange={e => setEditing({ ...editing, price_8mm: e.target.value })} className="w-full border rounded p-2" />
                </div>
                <div>
                  <label className="text-xs">price_6mm</label>
                  <input value={editing.price_6mm} onChange={e => setEditing({ ...editing, price_6mm: e.target.value })} className="w-full border rounded p-2" />
                </div>

                <div className="md:col-span-2 flex items-center gap-2 mt-2">
                  <button onClick={saveEdit} disabled={busy} className="px-3 py-1 rounded bg-blue-600 text-white">Save</button>
                  <button onClick={() => setEditing(null)} className="px-3 py-1 rounded border">Cancel</button>
                </div>
              </div>
            )}

            <div className="mt-4">
              <div className="text-xs text-gray-500">Existing categories</div>
              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-auto">
                {rowsFlat.map(r => (
                  <div key={r.id || r.category} className="p-2 rounded border flex items-center justify-between">
                    <div>
                      <div className="font-medium">{r.category || r.id}</div>
                      <div className="text-xs text-gray-500">18mm ₹{r.price_18mm || '—'} • 12mm ₹{r.price_12mm || '—'}</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => startEdit(r)} className="px-2 py-1 rounded border text-xs">Edit</button>
                      <button onClick={() => deleteRow(r)} className="px-2 py-1 rounded border text-xs">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        <div>
          {loading && <div className="text-center py-8">Loading...</div>}
          {error && <div className="text-center py-8 text-red-600">{error}</div>}

          <div className="space-y-6">
            {items.map(item => (
              <article key={item.id || item.category} className="bg-white rounded-xl p-4 shadow">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="md:w-1/3 flex items-center justify-center">
                    <div className="w-full max-w-xs">
                      {item.photo_url ? (
                        <img src={item.photo_url} alt={item.category} className="w-full h-auto object-contain rounded-md" />
                      ) : (
                        <div className="w-full h-44 bg-gray-100 rounded-md flex items-center justify-center text-gray-400">No image</div>
                      )}
                    </div>
                  </div>

                  <div className="md:w-2/3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-xl font-semibold">{item.category}</h2>
                        {item.description && <p className="text-sm text-gray-600 mt-1">{item.description}</p>}
                      </div>
                      <div className="text-xs text-gray-500">Stock: {item.stock || '—'}</div>
                    </div>

                    <div className="mt-4 overflow-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="p-2 text-left border">Size</th>
                            <th className="p-2 text-right border">Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr><td className="p-2 border">18mm</td><td className="p-2 border text-right">{item.price_18mm ? `₹ ${item.price_18mm}` : '—'}</td></tr>
                          <tr><td className="p-2 border">12mm</td><td className="p-2 border text-right">{item.price_12mm ? `₹ ${item.price_12mm}` : '—'}</td></tr>
                          <tr><td className="p-2 border">8mm</td><td className="p-2 border text-right">{item.price_8mm ? `₹ ${item.price_8mm}` : '—'}</td></tr>
                          <tr><td className="p-2 border">6mm</td><td className="p-2 border text-right">{item.price_6mm ? `₹ ${item.price_6mm}` : '—'}</td></tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <button className="px-3 py-1 rounded border">Enquire</button>
                      <button className="px-3 py-1 rounded bg-green-600 text-white">Order</button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-6 text-xs text-gray-500">
          Tip: Edit values in the Google Sheet (published as CSV) to update prices and images. Use the Admin Panel to write changes via Apps Script.
        </div>
      </div>
    </div>
  );
}
