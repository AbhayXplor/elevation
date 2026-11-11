import fs from 'node:fs'

const DURATION = Number(fs.readFileSync('demo/vo-final.wav').length && 134.0)

// [english, arabic] — one line each. Timing is proportional to the English
// length, which tracks the spoken pace closely enough to stay in sync.
const LINES = [
  ['Twenty twenty five changed the job of every credit officer in the Emirates.',
   'في عام ٢٠٢٥ تغيّرت مهمة كل مسؤول ائتمان في الإمارات.'],
  ["Under Central Bank regulation C 8, banks must now say which borrowers are exposed to physical climate risk, and prove it.",
   'بموجب لائحة المصرف المركزي C 8، على البنوك أن تحدد أي عملائها معرّض للمخاطر المناخية المادية، وأن تثبت ذلك.'],
  ['Today most of them guess, or pay six figures for a catastrophe model built for insurers.',
   'واليوم معظمها إما يخمّن، أو يدفع مبالغ ضخمة مقابل نموذج كوارث صُمّم لشركات التأمين.'],
  ["We built Elevation. It takes a bank's existing loan book and answers that question at the level that matters: the building.",
   'أنشأنا Elevation: يأخذ محفظة البنك القائمة ويجيب عن السؤال على المستوى الذي يهم فعلًا — المبنى.'],
  ['Twenty seven borrowers. Sixty eight geocoded facilities. Five point six nine billion dirhams of exposure, scored against a once in a hundred year flood and a twenty fifty heat projection.',
   '٢٧ عميلًا، و٦٨ منشأة محددة الموقع، و٥٫٦٩ مليار درهم من الانكشاف، مقيّمة مقابل فيضان مرة كل مئة عام وتوقعات حرارة ٢٠٥٠.'],
  ['Move the scenario, and the loss, the collateral haircut and the loan to value breaches move with it. From three breaches today, to fourteen by twenty fifty.',
   'وبتغيّر السيناريو تتغيّر الخسارة وتغطية الضمان ونسب القرض إلى القيمة: من ٣ حالات تجاوز اليوم إلى ١٤ بحلول ٢٠٥٠.'],
  ['Every number traces back to open data. Terrain at thirty metres, building footprints, reanalysis heat. No licence, no vendor, no black box.',
   'كل رقم يعود إلى بيانات مفتوحة: تضاريس بدقة ٣٠ مترًا، وحدود مباني، وبيانات حرارة مُعاد تحليلها. بلا تراخيص، وبلا مورّد، وبلا صندوق أسود.'],
  ['It runs in the browser, so there is no data to move and no integration project to approve.',
   'ويعمل داخل المتصفح، فلا بيانات تُنقل ولا مشروع تكامل يُعتمد.'],
  ['And we tested it against reality. Twenty districts flooded in April twenty twenty four.',
   'واختبرناه مقابل الواقع: عشرون منطقة غرقت في أبريل ٢٠٢٤.'],
  ['Our model ranks twelve of them in the top quarter, where chance predicts five.',
   'نموذجنا يصنّف اثنتي عشرة منها في الربع الأعلى، بينما تتوقع الصدفة خمسًا فقط.'],
  ['We also publish the result across all one hundred and eighty configurations, and we say plainly that it was tuned on those same districts.',
   'كما ننشر النتيجة عبر ١٨٠ إعدادًا، ونقول بصراحة إنه ضُبط على المناطق نفسها.'],
  ['A validation you cannot question is not evidence.',
   'فالتحقّق الذي لا يمكن مساءلته ليس دليلًا.'],
  ["The product ends where the compliance team starts. A disclosure table, every borrower classified, the basis recorded, exportable as a spreadsheet or an audit file with the model's provenance attached.",
   'وينتهي المنتج حيث تبدأ إدارة الالتزام: جدول إفصاح، كل عميل مصنّف، والأساس مسجّل، قابل للتصدير كجدول أو كملف تدقيق يرفق مصدر النموذج.'],
  ['And a written explanation of each decision, generated only from the figures on the page, so it cannot invent one.',
   'وشرح مكتوب لكل قرار، مولّد من الأرقام الموجودة في الصفحة فقط، فلا يستطيع اختراع رقم.'],
  ['This is the layer beneath the catastrophe models. The one a mid sized bank can actually buy, and defend to an examiner.',
   'هذه هي الطبقة التي تقع تحت نماذج الكوارث: التي يستطيع بنك متوسط الحجم أن يشتريها فعلًا، ويدافع عنها أمام المراجع.'],
  ['The buyer is already mandated. Every bank the Central Bank supervises needs this answer.',
   'المشتري مُلزم أصلًا: كل بنك يشرف عليه المصرف المركزي يحتاج هذه الإجابة.'],
  ['A pilot starts with one book, one thousand facilities, and reports back in ninety days.',
   'تبدأ التجربة بمحفظة واحدة وألف منشأة، وتعود بتقرير خلال تسعين يومًا.'],
  ['Elevation. Physical risk, priced.',
   'Elevation. المخاطر المادية، مسعّرة.'],
]

const weights = LINES.map(([en]) => en.split(/\s+/).length)
const total = weights.reduce((a, b) => a + b, 0)
const scale = (DURATION - 1.2) / total

const stamp = (t) => {
  const ms = Math.round(t * 1000)
  const h = String(Math.floor(ms / 3600000)).padStart(2, '0')
  const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0')
  const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')
  const f = String(ms % 1000).padStart(3, '0')
  return `${h}:${m}:${s},${f}`
}

let t = 0.6
const en = []
const ar = []
LINES.forEach(([english, arabic], i) => {
  const d = weights[i] * scale
  en.push(`${i + 1}\n${stamp(t)} --> ${stamp(t + d - 0.08)}\n${english}\n`)
  ar.push(`${i + 1}\n${stamp(t)} --> ${stamp(t + d - 0.08)}\n${arabic}\n`)
  t += d
})

fs.writeFileSync('demo/en.srt', en.join('\n'))
fs.writeFileSync('demo/ar.srt', ar.join('\n'))
console.log('wrote demo/en.srt and demo/ar.srt; last cue ends at', t.toFixed(1), 's')
