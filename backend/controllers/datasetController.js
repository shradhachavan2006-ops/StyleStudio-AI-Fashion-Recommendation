/**
 * datasetController.js — Dataset Inspection & Validation API
 * Provides random sampling of fashion dataset entries for quality auditing.
 * Does NOT modify the recommendation engine.
 */

const fs   = require('fs');
const path = require('path');

const CSV_PATH     = path.join(__dirname, '../../data/new_images_styles.csv');
const THEME_METADATA_PATH = path.join(__dirname, '../../data/new_images_theme_metadata.csv');
const IMAGE_DIR    = path.join(__dirname, '../../New Images/New Images');
const REPORT_PATH  = path.join(__dirname, '../../data/new_images_quality_report.json');
const BACKEND_URL  = process.env.BACKEND_URL || 'http://localhost:5000';
const MIN_IMG_SIZE = 5000; // 5KB

// ── CSV parsing (comma-safe) ───────────────────────────────────────────────
function parseCSVRow(line) {
  // Handles product names with commas by only splitting on the first 9 commas
  const parts = [];
  let current = '';
  let commaCount = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === ',' && commaCount < 9) {
      parts.push(current.trim());
      current = '';
      commaCount++;
    } else {
      current += line[i];
    }
  }
  parts.push(current.trim());
  return parts;
}

// ── Load & cache CSV ───────────────────────────────────────────────────────
let CSV_ROWS = null;
let CSV_HEADERS = null;
let IMAGE_FILE_BY_ID = new Map();

function loadThemeMetadata() {
  if (IMAGE_FILE_BY_ID.size > 0) return;
  const raw = fs.readFileSync(THEME_METADATA_PATH, 'utf8');
  const lines = raw.split('\n').filter(l => l.trim());
  const headers = lines[0].split(',').map(h => h.trim());
  const idIdx = headers.indexOf('id');
  const imageIdx = headers.indexOf('sourceImage');
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const id = cols[idIdx]?.trim();
    const sourceImage = cols[imageIdx]?.trim();
    if (id && sourceImage) IMAGE_FILE_BY_ID.set(id, sourceImage);
  }
}

function loadCSV() {
  if (CSV_ROWS) return;
  loadThemeMetadata();
  const raw     = fs.readFileSync(CSV_PATH, 'utf8');
  const lines   = raw.split('\n').filter(l => l.trim());
  CSV_HEADERS   = lines[0].split(',').map(h => h.trim());
  CSV_ROWS      = lines.slice(1).map(line => {
    const cols = parseCSVRow(line);
    return {
      id:                 cols[0]  || '',
      gender:             cols[1]  || '',
      masterCategory:     cols[2]  || '',
      subCategory:        cols[3]  || '',
      articleType:        cols[4]  || '',
      baseColour:         cols[5]  || '',
      season:             cols[6]  || '',
      year:               cols[7]  || '',
      usage:              cols[8]  || '',
      productDisplayName: cols[9]  || '',
    };
  }).filter(r => r.id);
}

// ── Image existence check ─────────────────────────────────────────────────
function imageInfo(id) {
  try {
    const p    = path.join(IMAGE_DIR, IMAGE_FILE_BY_ID.get(id) || `${id}.jpg`);
    const stat = fs.statSync(p);
    return { exists: stat.size >= MIN_IMG_SIZE, sizeKB: Math.round(stat.size / 1024) };
  } catch {
    return { exists: false, sizeKB: 0 };
  }
}

function imageUrl(id) {
  return `${BACKEND_URL}/images/${encodeURIComponent(IMAGE_FILE_BY_ID.get(id) || `${id}.jpg`)}`;
}

// ── Auto-tag generation (rule-based, same logic as imageMatchingService) ──
const COLOUR_KW = [
  'white','black','red','blue','navy','green','yellow','orange','purple','pink',
  'grey','gray','brown','beige','cream','gold','silver','maroon','olive','teal',
  'coral','rust','mustard','indigo','violet','rose','lavender','peach','khaki',
  'camel','tan','mint','ivory','denim','charcoal','burgundy','magenta','crimson',
];

function extractColours(name) {
  const lower = (name || '').toLowerCase();
  return COLOUR_KW.filter(c => lower.includes(c));
}

const STYLE_HINTS = {
  trendy:      ['trendy','fashion','chic','stylish','modern','hipster','boho'],
  classic:     ['classic','formal','elegant','traditional','timeless'],
  casual:      ['casual','relaxed','everyday','basic','comfort'],
  athletic:    ['sport','athletic','active','gym','running','track','yoga'],
  bohemian:    ['boho','bohemian','ethnic','tribal','folk','floral'],
  minimalist:  ['minimal','minimalist','clean','simple','mono'],
  bold:        ['bold','vibrant','neon','bright','graphic'],
};

function detectStyle(name, usage) {
  const lower = ((name || '') + ' ' + (usage || '')).toLowerCase();
  for (const [style, triggers] of Object.entries(STYLE_HINTS)) {
    if (triggers.some(t => lower.includes(t))) return style;
  }
  if (['formal'].includes(usage?.toLowerCase())) return 'classic';
  if (['ethnic'].includes(usage?.toLowerCase())) return 'bohemian';
  return 'casual';
}

// ── Generate the CLIP query (mirrors imageMatchingService logic) ───────────
function generateCLIPQuery(row) {
  const colours    = extractColours(row.productDisplayName).join(' ');
  const usageLabel = (row.usage || '').toLowerCase();
  const base       = row.productDisplayName || row.articleType;
  return `${base} ${colours} ${usageLabel} fashion product`.replace(/\s+/g, ' ').trim();
}

// ── Map subCategory → logical category ───────────────────────────────────
function mapCategory(sub, master) {
  const s = (sub || '').toLowerCase();
  const m = (master || '').toLowerCase();
  if (s === 'bottomwear')                    return 'bottomwear';
  if (['saree','lehenga choli','dress','topwear'].includes(s) || m === 'apparel') return 'topwear';
  if (m === 'footwear' || s === 'shoes')     return 'footwear';
  if (m === 'accessories')                   return 'accessories';
  return m || 'unknown';
}

// ── Load quality report ───────────────────────────────────────────────────
function loadReport() {
  try {
    if (fs.existsSync(REPORT_PATH)) {
      return JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
    }
  } catch {}
  return {
    inspectedCount: 0,
    correctCount:   0,
    partialCount:   0,
    wrongCount:     0,
    accuracy:       0,
    lastUpdated:    null,
    incorrectSamples: [],
    commonFailures:   {},
    sessionHistory:   [],
  };
}

function saveReport(report) {
  report.lastUpdated = new Date().toISOString();
  report.accuracy    = report.inspectedCount > 0
    ? Math.round((report.correctCount / report.inspectedCount) * 100)
    : 0;
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/dataset/sample?count=50&onlyValid=true
// ═══════════════════════════════════════════════════════════════════════════
exports.getSample = (req, res) => {
  try {
    loadCSV();
    const count     = Math.min(parseInt(req.query.count) || 50, 100);
    const onlyValid = req.query.onlyValid !== 'false'; // default true

    // Shuffle by picking random indices
    const pool = onlyValid
      ? CSV_ROWS.filter(r => imageInfo(r.id).exists)
      : CSV_ROWS;

    if (pool.length === 0) return res.json({ samples: [], total: 0 });

    // Fisher-Yates partial shuffle to get `count` items efficiently
    const selected = [];
    const indices  = Array.from({ length: pool.length }, (_, i) => i);
    for (let i = 0; i < count && i < pool.length; i++) {
      const j  = i + Math.floor(Math.random() * (pool.length - i));
      [indices[i], indices[j]] = [indices[j], indices[i]];
      selected.push(pool[indices[i]]);
    }

    const samples = selected.map(row => {
      const img     = imageInfo(row.id);
      const colours = extractColours(row.productDisplayName);
      const style   = detectStyle(row.productDisplayName, row.usage);
      const catKey  = mapCategory(row.subCategory, row.masterCategory);
      const query   = generateCLIPQuery(row);

      return {
        id:       row.id,
        imageUrl: imageUrl(row.id),
        imageSizeKB: img.sizeKB,
        imageValid:  img.exists,

        // Raw CSV labels
        csvLabels: {
          gender:         row.gender,
          masterCategory: row.masterCategory,
          subCategory:    row.subCategory,
          articleType:    row.articleType,
          baseColour:     row.baseColour,
          season:         row.season,
          year:           row.year,
          usage:          row.usage,
          productName:    row.productDisplayName,
        },

        // Auto-generated tags (rule-based)
        autoTags: {
          detectedStyle:    style,
          detectedCategory: catKey,
          detectedColours:  colours.length > 0 ? colours : [row.baseColour],
          mappedUsage:      row.usage?.toLowerCase() || 'casual',
        },

        // CLIP query that would be sent for this item
        generatedQuery: query,

        // Metadata
        metadata: {
          id:           row.id,
          articleType:  row.articleType,
          subCategory:  row.subCategory,
          season:       row.season,
          gender:       row.gender,
          usage:        row.usage,
          baseColour:   row.baseColour,
          sizeKB:       img.sizeKB,
        },
      };
    });

    res.json({
      samples,
      total:       pool.length,
      sampled:     samples.length,
      onlyValid,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[dataset] getSample error:', err);
    res.status(500).json({ message: 'Failed to sample dataset', error: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/dataset/report
// ═══════════════════════════════════════════════════════════════════════════
exports.getReport = (req, res) => {
  try {
    res.json(loadReport());
  } catch (err) {
    res.status(500).json({ message: 'Failed to load report' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/dataset/validate
// Body: { id, verdict: 'correct'|'partial'|'wrong', reason?, csvLabels, autoTags, generatedQuery }
// ═══════════════════════════════════════════════════════════════════════════
exports.submitValidation = (req, res) => {
  try {
    const { id, verdict, reason, csvLabels, autoTags, generatedQuery } = req.body;
    if (!id || !verdict) return res.status(400).json({ message: 'id and verdict required' });

    const report = loadReport();
    report.inspectedCount++;

    if (verdict === 'correct')  report.correctCount++;
    else if (verdict === 'partial') report.partialCount++;
    else if (verdict === 'wrong')   report.wrongCount++;

    if (verdict !== 'correct') {
      // Track failure pattern
      const pattern = `${autoTags?.detectedCategory || '?'} / ${csvLabels?.articleType || '?'}`;
      report.commonFailures[pattern] = (report.commonFailures[pattern] || 0) + 1;

      // Keep last 200 incorrect samples
      report.incorrectSamples.unshift({ id, verdict, reason, csvLabels, autoTags, generatedQuery, ts: new Date().toISOString() });
      if (report.incorrectSamples.length > 200) report.incorrectSamples.pop();
    }

    report.sessionHistory.unshift({ id, verdict, ts: new Date().toISOString() });
    if (report.sessionHistory.length > 500) report.sessionHistory.pop();

    saveReport(report);
    res.json({ success: true, report });
  } catch (err) {
    console.error('[dataset] submitValidation error:', err);
    res.status(500).json({ message: 'Failed to save validation' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// DELETE /api/dataset/report  — reset
// ═══════════════════════════════════════════════════════════════════════════
exports.resetReport = (req, res) => {
  try {
    const fresh = {
      inspectedCount: 0, correctCount: 0, partialCount: 0, wrongCount: 0,
      accuracy: 0, lastUpdated: null, incorrectSamples: [], commonFailures: {}, sessionHistory: [],
    };
    saveReport(fresh);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Failed to reset report' });
  }
};
