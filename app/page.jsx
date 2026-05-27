"use client";
import { useState, useRef, useCallback } from "react";

// ── Design tokens (same palette as the PDF reports) ──────────────────────────
const C = {
  bg:   '#0c0e13', sf: '#13161d', sf2: '#1a1e28',
  ac:   '#c8956c', acb: 'rgba(200,149,108,0.28)',
  tx:   '#f2f0ed', txs: '#8a8f9a', txm: '#5a5f6a',
  bo:   'rgba(255,255,255,0.07)', dv: 'rgba(255,255,255,0.11)',
  pos:  '#9bb68a', neg: '#d18570', wrn: '#e8c9a8',
  bpos: 'rgba(155,182,138,0.20)', bneg: 'rgba(209,133,112,0.20)',
  bwrn: 'rgba(232,201,168,0.18)',
};

const mono = "'JetBrains Mono', 'Fira Code', monosace";
const serif = "'Playfair Display', Georgia, serif";

// ── Small helpers ─────────────────────────────────────────────────────────────
const fmt = (n) => n?.toLocaleString('de-DE') + ' €';
const fmtQm = (n) => n?.toLocaleString('de-DE') + ' €/m²';

function Dots({ n = 5, filled = 3 }) {
  return (
    <span style={{ display:'flex', gap:8 }}>
      {Array.from({ length: n }).map((_, i) => (
        <span key={i} style={{
          width: 14, height: 14, borderRadius: '50%',
          background: i < filled ? C.ac : 'transparent',
          border: `2px solid ${i < filled ? C.ac : C.acb}`,
        }} />
      ))}
    </span>
  );
}

function Tag({ children, color = C.pos, bg }) {
  return (
    <span style={{
      fontFamily: mono, fontSize: 11, fontWeight: 500,
      letterSpacing: '0.12em', textTransform: 'uppercase',
      padding: '4px 12px', borderRadius: 4,
      border: `1.5px solid ${color}`,
      color, background: bg || color + '15',
    }}>{children}</span>
  );
}

function FileRow({ file, onRemove }) {
  const isPdf = file.type === 'application/pdf';
  const isImg = file.type.startsWith('image/');
  const icon = isPdf ? '📄' : isImg ? '🖼' : '📎';
  const kb = (file.size / 1024).toFixed(0);
  const tooBig = file.type === "application/pdf" && file.size > 4 * 1024 * 1024; // 4 MB warning for PDFs
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px', background: C.sf,
      border: `1px solid ${tooBig ? C.neg+'50' : C.bo}`,
      borderRadius: 6, marginBottom: 6,
    }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ flex: 1, color: C.tx, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {file.name}
      </span>
      <span style={{ fontFamily: mono, fontSize: 11, color: tooBig ? C.neg : C.txm }}>
        {file.originalSize
          ? `${(file.originalSize/1024/1024).toFixed(1)} MB → ${kb > 1024 ? (kb/1024).toFixed(1)+' MB' : kb+' KB'} ✓`
          : kb > 1024 ? (kb/1024).toFixed(1)+' MB' : kb+' KB'}
        {tooBig && ' ⚠'}
      </span>
      <button onClick={onRemove} style={{
        background: 'none', border: 'none', color: C.txm,
        cursor: 'pointer', fontSize: 16, padding: '0 4px',
        lineHeight: 1,
      }}>×</button>
    </div>
  );
}

function PriceBox({ label, value, qm, main = false }) {
  return (
    <div style={{
      flex: 1, padding: main ? '28px 20px' : '24px 16px',
      background: main ? 'rgba(200,149,108,0.06)' : C.sf,
      border: `1.5px solid ${main ? C.acb : C.bo}`,
      borderRadius: 8, textAlign: 'center',
    }}>
      <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.txm, marginBottom: 10 }}>{label}</div>
      <div style={{
        fontFamily: mono, fontWeight: 500, color: main ? C.ac : C.txs,
        fontSize: main ? 30 : 22, letterSpacing: '-0.02em', lineHeight: 1,
      }}>{fmt(value)}</div>
      <div style={{ fontFamily: mono, fontSize: 11, color: C.txm, marginTop: 6 }}>{fmtQm(qm)}</div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.ac, marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [address, setAddress]   = useState('');
  const [files, setFiles]       = useState([]);
  const [notes, setNotes]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [loadMsg, setLoadMsg]   = useState('');
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();

  // Compress image via Canvas before base64 encoding
  const compressImage = (file) => new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1400;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else { w = Math.round(w * MAX / h); h = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        const r = new FileReader();
        r.onload = (e) => resolve({
          name: file.name.replace(/\.[^.]+$/, '.jpg'),
          type: 'image/jpeg',
          size: blob.size,
          originalSize: file.size,
          data: e.target.result.split(',')[1],
        });
        r.readAsDataURL(blob);
      }, 'image/jpeg', 0.80);
    };
    img.src = url;
  });

  // Process file → base64 (images get compressed, PDFs stay as-is)
  const readFile = (f) => {
    if (f.type.startsWith('image/')) return compressImage(f);
    return new Promise((resolve) => {
      const r = new FileReader();
      r.onload = (e) => resolve({ name: f.name, type: f.type, size: f.size, data: e.target.result.split(',')[1] });
      r.readAsDataURL(f);
    });
  };

  const addFiles = useCallback(async (list) => {
    const processed = await Promise.all(Array.from(list).map(readFile));
    setFiles(prev => {
      const names = new Set(prev.map(x => x.name));
      return [...prev, ...processed.filter(x => !names.has(x.name))];
    });
  }, []);

  // Build Claude API message content
  const buildContent = (fileList) => {
    const content = [];
    for (const f of fileList) {
      if (f.type === 'application/pdf') {
        content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: f.data } });
      } else if (f.type.startsWith('image/')) {
        content.push({ type: 'image', source: { type: 'base64', media_type: f.type, data: f.data } });
      }
    }
    content.push({ type: 'text', text: `
Erstelle eine professionelle Preiseinschätzung für:
Adresse: ${address}

Zusätzliche Informationen:
${notes || '(keine weiteren Angaben)'}

Analysiere ALLE hochgeladenen Dokumente (WEG-Protokolle, Wirtschaftspläne, Energieausweis, Teilungserklärung, Exposé, Fotos) und erstelle eine marktorientierte Einschätzung.

Antworte AUSSCHLIESSLICH mit einem JSON-Objekt – kein Text davor oder danach, keine Markdown-Backticks:
{
  "adresse": "vollständige formatierte Adresse",
  "objekttyp": "z.B. Eigentumswohnung / Loft / Dachgeschoss-Maisonette",
  "wohnflaeche": 65,
  "baujahr": 1920,
  "etage": "z.B. 1. OG / Dachgeschoss",
  "zimmer": 2,
  "zustand": "neuwertig / gepflegt / renovierungsbedürftig",
  "ausstattung": "gehoben / standard / einfach",
  "besonderheiten": "kurze Aufzählung besonderer Merkmale",
  "untergrenze": 420000,
  "marktwert": 455000,
  "markttest": 489000,
  "preisProQm": 7000,
  "konfidenz": 3,
  "konfidenzText": "Kurze Begründung der Konfidenz",
  "einschaetzung": "3–4 Sätze zur Gesamteinschätzung mit wichtigsten Treibern",
  "staerken": ["Stärke 1", "Stärke 2", "Stärke 3", "Stärke 4"],
  "schwaechen": ["Schwäche 1", "Schwäche 2", "Schwäche 3"],
  "fehlendeDaten": ["Fehlende Unterlage 1", "Fehlende Unterlage 2"],
  "hausgeld": 450,
  "lageAnalyse": "Kurze Lage- und Marktanalyse für diesen Standort",
  "kaeuferProfil": "Beschreibung der Zielgruppe für diese Immobilie",
  "naechsteSchritte": ["Schritt 1", "Schritt 2", "Schritt 3"],
  "markthinweis": "Aktueller Markthinweis für die Lage"
}` });
    return content;
  };

  const analyze = async () => {
    if (!address.trim()) { setError('Bitte Adresse eingeben.'); return; }
    setLoading(true); setError(null); setResult(null);

    const msgs = [
      'Dokumente werden geladen…', 'WEG-Unterlagen auswerten…',
      'Marktdaten recherchieren…', 'Bewertung berechnen…',
      'Preisempfehlung formulieren…',
    ];
    let i = 0; setLoadMsg(msgs[0]);
    const t = setInterval(() => { i = (i + 1) % msgs.length; setLoadMsg(msgs[i]); }, 2200);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 2000,
          system: 'Du bist der führende Immobilien-Bewertungsexperte von Nick und Nico Immobilien Berlin. Du erstellst präzise, datenbasierte Preiseinschätzungen für Eigentumswohnungen in Berlin auf Basis aller bereitgestellten Unterlagen und aktueller Marktdaten (Guthmann, ImmoScout, BORIS). Antworte immer NUR mit reinem JSON, niemals mit Markdown-Blöcken oder erklärendem Text.',
          messages: [{ role: 'user', content: buildContent(files) }],
        }),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error.message);
      const raw = d.content.filter(b => b.type === 'text').map(b => b.text).join('');
      const clean = raw.replace(/```json|```/g, '').trim();
      setResult(JSON.parse(clean));
    } catch (e) {
      setError(`Fehler: ${e.message}`);
    } finally {
      clearInterval(t); setLoading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.tx, fontFamily: "'Inter', sans-serif", padding: '0 0 80px' }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Playfair+Display:ital,wght@1,400&display=swap" rel="stylesheet" />

      {/* ── Header ── */}
      <div style={{ borderBottom: `1px solid ${C.bo}`, padding: '20px 32px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <img src="https://nickundnico.vercel.app/images/logo-kopf.png" alt="" style={{ height: 48, opacity: 0.9 }} />
        <div>
          <div style={{ fontWeight: 600, letterSpacing: '0.06em', fontSize: 14 }}>NICK UND NICO IMMOBILIEN</div>
          <div style={{ fontFamily: serif, fontStyle: 'italic', color: C.ac, fontSize: 13 }}>KI-gestützte Preiseinschätzung</div>
        </div>
        <div style={{ marginLeft: 'auto', fontFamily: mono, fontSize: 11, color: C.txm }}>
          Stichtag · {new Date().toLocaleDateString('de-DE')}
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 24px' }}>

        {/* ── Form ── */}
        {!result && !loading && (
          <>
            {/* Address */}
            <div style={{ marginBottom: 32 }}>
              <label style={{ display: 'block', fontFamily: mono, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.ac, marginBottom: 10 }}>
                Adresse der Immobilie
              </label>
              <input
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="z.B. Warschauer Straße 61, 10243 Berlin"
                style={{
                  width: '100%', padding: '14px 16px',
                  background: C.sf, border: `1.5px solid ${address ? C.acb : C.bo}`,
                  borderRadius: 8, color: C.tx, fontSize: 15,
                  fontFamily: "'Inter', sans-serif", outline: 'none',
                  transition: 'border-color 0.2s',
                }}
              />
            </div>

            {/* File Upload */}
            <div style={{ marginBottom: 32 }}>
              <label style={{ display: 'block', fontFamily: mono, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.ac, marginBottom: 10 }}>
                Unterlagen hochladen
              </label>
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? C.ac : C.bo}`,
                  borderRadius: 8, padding: '32px 24px', textAlign: 'center',
                  cursor: 'pointer', background: dragOver ? 'rgba(200,149,108,0.04)' : 'transparent',
                  transition: 'all 0.2s', marginBottom: 12,
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 8 }}>📁</div>
                <div style={{ color: C.txs, fontSize: 14, marginBottom: 4 }}>
                  Dateien hier ablegen oder klicken
                </div>
                <div style={{ fontFamily: mono, fontSize: 11, color: C.txm }}>
                  WEG-Protokolle · Wirtschaftspläne · Energieausweis · Teilungserklärung · Fotos
                </div>
              </div>
              <input
                ref={fileRef} type="file" multiple
                accept=".pdf,image/*"
                style={{ display: 'none' }}
                onChange={e => addFiles(e.target.files)}
              />
              {files.map((f, i) => (
                <FileRow key={f.name} file={f} onRemove={() => setFiles(prev => prev.filter((_, j) => j !== i))} />
              ))}
              {files.length === 0 && (
                <div style={{ fontFamily: mono, fontSize: 11, color: C.txm, padding: '6px 0' }}>
                  Ohne Unterlagen ist die Einschätzung nur indikativ (Konfidenz ●●○○○)
                </div>
              )}
              {files.length > 0 && (() => {
                const total = files.reduce((s, f) => s + f.size, 0);
                const totalMB = (total / 1024 / 1024).toFixed(1);
                const overLimit = total > 10 * 1024 * 1024;
                return (
                  <div style={{ fontFamily: mono, fontSize: 11, color: overLimit ? C.neg : C.txm, padding: '6px 0' }}>
                    {overLimit
                      ? `⚠ Gesamt ${totalMB} MB — zu groß (max. ~10 MB). PDFs komprimieren oder weniger hochladen.`
                      : `Gesamt: ${totalMB} MB ✓`}
                  </div>
                );
              })()}
            </div>

            {/* Notes */}
            <div style={{ marginBottom: 40 }}>
              <label style={{ display: 'block', fontFamily: mono, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.ac, marginBottom: 10 }}>
                Zusätzliche Informationen
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={5}
                placeholder="z.B. Wohnfläche, Baujahr, Hausgeld, besondere Merkmale, aktuelle Mietssituation, Renovierungsarbeiten, bekannte Mängel…"
                style={{
                  width: '100%', padding: '14px 16px',
                  background: C.sf, border: `1.5px solid ${notes ? C.acb : C.bo}`,
                  borderRadius: 8, color: C.tx, fontSize: 14,
                  fontFamily: "'Inter', sans-serif", outline: 'none',
                  resize: 'vertical', lineHeight: 1.6,
                }}
              />
            </div>

            {error && (
              <div style={{ background: 'rgba(209,133,112,0.1)', border: `1px solid ${C.neg}40`, borderRadius: 8, padding: '12px 16px', color: C.neg, fontSize: 13, marginBottom: 24 }}>
                {error}
              </div>
            )}

            <button
              onClick={analyze}
              style={{
                width: '100%', padding: '16px', borderRadius: 8,
                background: C.ac, border: 'none', color: '#0c0e13',
                fontSize: 15, fontWeight: 600, cursor: 'pointer',
                letterSpacing: '0.04em',
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={e => e.target.style.opacity = '0.88'}
              onMouseLeave={e => e.target.style.opacity = '1'}
            >
              Preiseinschätzung erstellen →
            </button>
          </>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{
              width: 48, height: 48, border: `3px solid ${C.bo}`,
              borderTopColor: C.ac, borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 24px',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <div style={{ fontFamily: mono, fontSize: 12, color: C.txs, letterSpacing: '0.1em' }}>{loadMsg}</div>
            <div style={{ fontFamily: mono, fontSize: 11, color: C.txm, marginTop: 8 }}>{address}</div>
          </div>
        )}

        {/* ── Results ── */}
        {result && (
          <>
            {/* Object header */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.ac, marginBottom: 8 }}>Preiseinschätzung</div>
              <h1 style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 32, fontWeight: 400, color: C.tx, lineHeight: 1.2, marginBottom: 6 }}>
                {result.adresse || address}
              </h1>
              <div style={{ fontFamily: mono, fontSize: 12, color: C.txs }}>
                {[result.objekttyp, result.wohnflaeche && result.wohnflaeche + ' m²', result.etage, result.baujahr && 'Bj. ' + result.baujahr].filter(Boolean).join(' · ')}
              </div>
            </div>

            {/* Price boxes */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 28 }}>
              <PriceBox label="Untergrenze" value={result.untergrenze} qm={Math.round(result.untergrenze / result.wohnflaeche)} />
              <PriceBox label="Marktwert" value={result.marktwert} qm={result.preisProQm || Math.round(result.marktwert / result.wohnflaeche)} main />
              <PriceBox label="Markttest" value={result.markttest} qm={Math.round(result.markttest / result.wohnflaeche)} />
            </div>

            {/* Konfidenz */}
            <div style={{ background: C.sf, border: `1px solid ${C.bo}`, borderRadius: 8, padding: '16px 20px', marginBottom: 28, display: 'flex', alignItems: 'center', gap: 20 }}>
              <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.txm, flexShrink: 0 }}>Konfidenz</span>
              <Dots n={5} filled={result.konfidenz || 2} />
              <span style={{ fontSize: 13, color: C.txs }}>{result.konfidenzText}</span>
            </div>

            {/* Einschätzung */}
            <div style={{ background: 'rgba(200,149,108,0.04)', border: `1px solid ${C.acb}`, borderRadius: 8, padding: '20px', marginBottom: 28 }}>
              <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.ac, marginBottom: 10 }}>Einschätzung</div>
              <p style={{ color: C.tx, fontSize: 14, lineHeight: 1.7 }}>{result.einschaetzung}</p>
            </div>

            {/* Stärken / Schwächen */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
              <div style={{ background: C.sf, border: `1px solid ${C.bo}`, borderRadius: 8, padding: '18px 20px' }}>
                <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.pos, marginBottom: 14 }}>Was den Preis trägt</div>
                {(result.staerken || []).map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, fontSize: 13, color: C.tx, lineHeight: 1.5 }}>
                    <span style={{ color: C.pos, fontWeight: 700, flexShrink: 0 }}>+</span>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
              <div style={{ background: C.sf, border: `1px solid ${C.bo}`, borderRadius: 8, padding: '18px 20px' }}>
                <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.neg, marginBottom: 14 }}>Was den Preis dämpft</div>
                {(result.schwaechen || []).map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, fontSize: 13, color: C.tx, lineHeight: 1.5 }}>
                    <span style={{ color: C.neg, fontWeight: 700, flexShrink: 0 }}>−</span>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Fehlende Daten */}
            {result.fehlendeDaten?.length > 0 && (
              <div style={{ background: 'rgba(232,201,168,0.06)', border: `1px solid ${C.bwrn}`, borderRadius: 8, padding: '16px 20px', marginBottom: 28 }}>
                <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.wrn, marginBottom: 10 }}>Fehlende Unterlagen</div>
                {result.fehlendeDaten.map((d, i) => (
                  <div key={i} style={{ fontSize: 13, color: C.tx, marginBottom: 6, paddingLeft: 20, position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 0, color: C.wrn }}>→</span> {d}
                  </div>
                ))}
              </div>
            )}

            {/* Details grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
              {result.lageAnalyse && (
                <div style={{ background: C.sf, border: `1px solid ${C.bo}`, borderRadius: 8, padding: '18px 20px' }}>
                  <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.ac, marginBottom: 10 }}>Lage &amp; Markt</div>
                  <p style={{ fontSize: 13, color: C.txs, lineHeight: 1.65 }}>{result.lageAnalyse}</p>
                </div>
              )}
              {result.kaeuferProfil && (
                <div style={{ background: C.sf, border: `1px solid ${C.bo}`, borderRadius: 8, padding: '18px 20px' }}>
                  <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.ac, marginBottom: 10 }}>Käuferprofil</div>
                  <p style={{ fontSize: 13, color: C.txs, lineHeight: 1.65 }}>{result.kaeuferProfil}</p>
                </div>
              )}
            </div>

            {/* Key data */}
            {(result.hausgeld || result.baujahr || result.zustand) && (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
                {result.baujahr && <Tag color={C.txs}>Bj. {result.baujahr}</Tag>}
                {result.zustand && <Tag color={C.pos}>{result.zustand}</Tag>}
                {result.ausstattung && <Tag color={C.ac}>{result.ausstattung}</Tag>}
                {result.hausgeld && <Tag color={C.wrn}>Hausgeld ~{result.hausgeld} €/Mon.</Tag>}
              </div>
            )}

            {/* Nächste Schritte */}
            {result.naechsteSchritte?.length > 0 && (
              <div style={{ background: C.sf, border: `1px solid ${C.bo}`, borderRadius: 8, padding: '18px 20px', marginBottom: 28 }}>
                <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.ac, marginBottom: 12 }}>Nächste Schritte</div>
                {result.naechsteSchritte.map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 8, fontSize: 13, color: C.tx }}>
                    <span style={{ fontFamily: mono, fontSize: 11, color: C.acb, background: 'rgba(200,149,108,0.12)', borderRadius: 4, width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                    {s}
                  </div>
                ))}
              </div>
            )}

            {/* Markthinweis */}
            {result.markthinweis && (
              <div style={{ borderTop: `1px solid ${C.bo}`, paddingTop: 20, marginBottom: 28 }}>
                <p style={{ fontSize: 12, color: C.txm, lineHeight: 1.6 }}>
                  <span style={{ color: C.ac }}>Markthinweis: </span>{result.markthinweis}
                </p>
              </div>
            )}

            {/* Disclaimer + Neu-Button */}
            <div style={{ borderTop: `1px solid ${C.bo}`, paddingTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24 }}>
              <p style={{ fontSize: 11, color: C.txm, lineHeight: 1.6, maxWidth: 520 }}>
                Diese Einschätzung ist eine marktorientierte Maklereinschätzung — kein Gutachten nach § 194 BauGB. Für eine vollständige Preiseinschätzung mit PDF-Export bitte direkt bei Nick und Nico anfragen.
              </p>
              <button
                onClick={() => { setResult(null); setFiles([]); setNotes(''); setAddress(''); setError(null); }}
                style={{
                  padding: '10px 20px', borderRadius: 6,
                  background: 'none', border: `1.5px solid ${C.acb}`,
                  color: C.ac, fontSize: 13, cursor: 'pointer', flexShrink: 0,
                }}
              >
                Neue Einschätzung
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
