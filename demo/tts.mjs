import fs from 'node:fs'
import { execFileSync } from 'node:child_process'

const key = fs.readFileSync('.env.local', 'utf8').match(/^GEMINI_API_KEY=(.+)$/m)?.[1]?.trim()
if (!key) throw new Error('no key')

export const SCRIPT = `Twenty twenty five changed the job of every credit officer in the Emirates. Under Central Bank regulation C 8, banks must now say which of their borrowers are exposed to physical climate risk, and prove it. Today most of them guess, or pay six figures for a catastrophe model built for insurers.

We built Elevation. It takes a bank's existing loan book and answers that question at the level that actually matters: the building.

Twenty seven borrowers. Sixty eight geocoded facilities. Five point six nine billion dirhams of exposure, scored against a once in a hundred year flood and a twenty fifty heat projection. Move the scenario, and the loss, the collateral haircut and the loan to value breaches move with it. From three breaches today, to fourteen by twenty fifty.

Every number traces back to open data. Terrain at thirty metres, building footprints, reanalysis heat. No licence, no vendor, no black box. It runs in the browser, so there is no data to move and no integration project to approve.

And we tested it against reality. Twenty districts flooded in April twenty twenty four. Our model ranks twelve of them in the top quarter, where chance predicts five. We also publish the result across all one hundred and eighty configurations, and we say plainly that it was tuned on those same districts. A validation you cannot question is not evidence.

The product ends where the compliance team starts. A disclosure table, every borrower classified, the basis recorded, exportable as a spreadsheet or an audit file with the model's provenance attached. And a written explanation of each decision, generated only from the figures on the page, so it cannot invent one.

This is the layer beneath the catastrophe models. The one a mid sized bank can actually buy, and defend to an examiner.

The buyer is already mandated. Every bank the Central Bank supervises needs this answer. A pilot starts with one book, one thousand facilities, and reports back in ninety days.

Elevation. Physical risk, priced.`

const res = await fetch(
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash-tts:generateContent',
  {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: SCRIPT }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } },
        },
      },
    }),
  },
)

const data = await res.json()
if (!res.ok) {
  console.log('HTTP', res.status, JSON.stringify(data).slice(0, 300))
  process.exit(1)
}

const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)
if (!part) {
  console.log('no audio.', JSON.stringify(data).slice(0, 300))
  process.exit(1)
}

const bytes = Buffer.from(part.inlineData.data, 'base64')
console.log('mime', part.inlineData.mimeType, 'bytes', bytes.length)

// The API returns either a WAV container or raw 24 kHz PCM depending on the
// model; sniff the magic bytes instead of trusting the mime string.
if (bytes.subarray(0, 4).toString('ascii') === 'RIFF') {
  fs.writeFileSync('demo/vo.wav', bytes)
} else {
  fs.writeFileSync('demo/vo.pcm', bytes)
  execFileSync(
    'ffmpeg',
    ['-y', '-f', 's16le', '-ar', '24000', '-ac', '1', '-i', 'demo/vo.pcm', 'demo/vo.wav'],
    { stdio: 'ignore' },
  )
}

const probe = execFileSync('ffprobe', [
  '-v', 'error', '-show_entries', 'format=duration',
  '-of', 'default=nw=1:nk=1', 'demo/vo.wav',
]).toString().trim()

console.log('duration_seconds', probe)
fs.writeFileSync('demo/duration.txt', probe)
