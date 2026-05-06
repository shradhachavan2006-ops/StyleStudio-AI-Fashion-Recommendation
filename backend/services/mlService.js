/**
 * mlService.js — StyleStudio ML Scoring Service
 * ===============================================
 * Spawns predict.py as a child process, sends batch payload via stdin,
 * reads JSON array response from stdout.
 *
 * Uses spawn() NOT exec() — avoids all Windows shell quoting issues.
 * Timeout: 10s. Falls back to uniform 0.5 scores on any error.
 */

const { spawn } = require('child_process');
const path = require('path');

const ML_SCRIPT = path.join(__dirname, '../../ml/predict.py');
const TIMEOUT_MS = 10000;

/**
 * Get ML scores for a batch of items.
 * @param {Array}  items  — transformed outfit items [{id, name, color, type, usage}]
 * @param {Object} user   — {gender, bodyShape, skinTone, usage}
 * @returns {Promise<Array>} — [{id, score}, ...]  score is 0..1
 */
const getBatchScores = (items, user) => {
    return new Promise((resolve) => {
        const payload = JSON.stringify({ items, user });

        // Build a Map of id → 0.5 as the safe fallback
        const fallback = items.map(it => ({ id: it.id, score: 0.5 }));

        let stdout = '';
        let stderr = '';
        let timedOut = false;

        // ── Spawn Python ────────────────────────────────────────────────────
        let py;
        try {
            py = spawn('python', [ML_SCRIPT]);
        } catch (spawnErr) {
            console.error('[mlService] Failed to spawn python:', spawnErr.message);
            return resolve(fallback);
        }

        // ── Timeout guard ───────────────────────────────────────────────────
        const timer = setTimeout(() => {
            timedOut = true;
            py.kill();
            console.warn('[mlService] Python script timed out — using fallback scores');
            resolve(fallback);
        }, TIMEOUT_MS);

        // ── Write payload to stdin then close ───────────────────────────────
        py.stdin.on('error', (err) => {
            console.error('[mlService] stdin error:', err.message);
        });
        py.stdin.write(payload);
        py.stdin.end();

        py.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
        py.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

        py.on('close', (code) => {
            if (timedOut) return; // already resolved
            clearTimeout(timer);

            if (stderr) {
                console.warn('[mlService] Python stderr:', stderr.trim());
            }

            try {
                const result = JSON.parse(stdout.trim());

                // Python returned an error object
                if (!Array.isArray(result)) {
                    console.error('[mlService] Unexpected ML response:', result);
                    return resolve(fallback);
                }

                // Validate each entry has id + score
                const validated = result.map(r => ({
                    id:    String(r.id || ''),
                    score: typeof r.score === 'number' ? r.score : 0.5
                }));

                resolve(validated);
            } catch (parseErr) {
                console.error('[mlService] JSON parse error:', parseErr.message, '| stdout:', stdout.slice(0, 200));
                resolve(fallback);
            }
        });

        py.on('error', (err) => {
            if (timedOut) return;
            clearTimeout(timer);
            console.error('[mlService] Spawn error:', err.message);
            resolve(fallback);
        });
    });
};

module.exports = { getBatchScores };
