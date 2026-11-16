import fs from 'node:fs';

// 由呼叫端提供本次上傳的來源圖 URL（含簽名，請勿寫進 repo）
const REF_URL = process.env.REF_URL;
if (!REF_URL) { console.error('請設定 REF_URL 環境變數'); process.exit(1); }

const SHARED = `white frilled short-sleeve blouse with a ruffled collar and ruffled cuffs, a navy-blue bow at the chest, small gold diamond buttons, a navy-blue sash bow at the waist, a layered pale-blue frilly tiered skirt, white lace-top thigh-high stockings, and white high-heeled shoes with navy ankle bows`;

const TEMPLATE = `Use case: identity-preserve.
Asset type: exactly ONE isolated transparent full-body anime character sprite for a browser dance rig.
Input image: Picture 1 is a dusk concert-stage photo of nine anime girls standing in a row from left to right. They wear the same frilly white-and-blue idol dress and they overlap each other, so each girl's skirt and hair partly covers her neighbours.
Selected character: {{CHAR}}
Primary request: isolate ONLY this selected character and reconstruct a clean, independent sprite. Keep her exact recognizable face, hairstyle, eye color, expression, original pose, body proportions and every costume detail of the shared idol dress (${SHARED}). Remove the other eight people, ALL background scenery, sky, stage structure, floor and floor reflections, and every tiny neighboring-person fragment. Where her outer silhouette is hidden by a neighboring character, reconstruct ONLY the missing garment, hair or body edge consistently with her own original design. Do not retain any neighbor body parts, neighbor hair, neighbor hands, or neighbor dress edges.
Composition: a single complete figure from hair top to both shoe soles, with generous transparent padding on all four sides. No clipping, no stretching. Keep the original pose; do not invent a T-pose or a new costume.
Alpha requirements: actual transparent background including true gaps between legs, hair, arms and body. All interiors of skin, white blouse, white stockings and white shoes must be fully opaque; no cloudy transparent holes. Clean antialiased outline with no white, blue or colored halo. Preserve complete hands, all fingers, shoe tips and hair tips. No scenery, no ground, no shadows, no glow, no painted checkerboard, no captions, no extra characters, no duplicated limbs, no stray fabric rectangles.
Output: portrait RGBA PNG containing just the one selected full-body character.`;

const CHARS = [
  `far-left character, number 1 of 9: very long light ash-blonde hair reaching past her hips, pink-red eyes, cheerful open smile, her right arm raised high above her head with an open waving palm, her left hand held near her chest, and a white rose hair ornament with a gold ribbon on the right side of her head`,
  `second from left, number 2 of 9: light brown hair tied up with a large white bow at the back of her head, blue eyes, open-mouth smile, and both hands raised in front of her chest as small curled fists`,
  `third from left, number 3 of 9: long dark brown hair, winking with one eye closed and a wide open smile, her right hand making a V peace sign beside her face, and a white rose ornament with a gold ribbon on the right side of her head`,
  `fourth from left, number 4 of 9: very long peach-orange hair with a large white bow on the left side of her head, green eyes, bright smile, and both hands clasped together in front of her chest`,
  `fifth from left, number 5 of 9: medium brown hair, violet-purple eyes, gentle smile, both hands clasped together in front of her chest, and a white rose ornament with a gold ribbon on the left side of her head`,
  `sixth from left, number 6 of 9: long auburn reddish-brown hair, green eyes, cheerful smile, her right arm extended forward toward the viewer with an open upturned palm and her left hand at her chest, and a white rose ornament with a gold ribbon on the left side of her head`,
  `seventh from left, number 7 of 9: short brown bob haircut, teal-blue eyes, open-mouth smile, her right hand placed over her chest, and a white rose ornament with a gold ribbon on the left side of her head`,
  `eighth from left, number 8 of 9: extremely long straight black hair reaching past her knees, blue eyes, calm soft smile, both hands clasped together in front of her chest, and a white rose ornament with a gold ribbon on the left side of her head`,
  `far-right character, number 9 of 9: long dark brown hair with lighter brown tips and a large black hair bow on top of her head, amber-golden eyes, confident grin, and her left arm raised high above her head with an open hand`,
];

const requests = CHARS.map((c, i) => ({
  prompt: TEMPLATE.replace('{{CHAR}}', c),
  reference_images: [{url: REF_URL, mime_type: 'image/webp'}],
  aspect_ratio: '1:2',
  area: '2K',
  output_format: 'png',
  output_file: `stage-${i}`,
}));

fs.writeFileSync('assets/ref/stage-remade/imagegen-request.json', JSON.stringify({requests}, null, 1) + '\n');
console.log('requests:', requests.length, '| prompt chars:', requests[0].prompt.length);
console.log('file:', 'assets/ref/stage-remade/imagegen-request.json');
