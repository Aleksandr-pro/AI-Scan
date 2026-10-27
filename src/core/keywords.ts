/**
 * Словари ключевых слов: маркеры ИИ-генераций и маркеры «человеческой» съёмки.
 * Ищутся в контейнере файла (строки ASCII), в EXIF и в ID3/Vorbis-тегах.
 */

/** Маркеры создания/обработки ИИ. */
export const AI_KEYWORDS: Array<{ k: string; label: string; weight: number }> = [
  { k: 'midjourney', label: 'Midjourney', weight: 45 },
  { k: 'dall-e', label: 'DALL·E', weight: 45 },
  { k: 'dalle', label: 'DALL·E', weight: 45 },
  { k: 'stable diffusion', label: 'Stable Diffusion', weight: 45 },
  { k: 'stablediffusion', label: 'Stable Diffusion', weight: 45 },
  { k: 'automatic1111', label: 'Automatic1111', weight: 45 },
  { k: 'comfyui', label: 'ComfyUI', weight: 45 },
  { k: 'invokeai', label: 'InvokeAI', weight: 45 },
  { k: 'novelai', label: 'NovelAI', weight: 45 },
  { k: 'flux.1', label: 'FLUX.1', weight: 45 },
  { k: 'flux.1', label: 'FLUX.1', weight: 45 },
  { k: 'black forest labs', label: 'Black Forest Labs', weight: 45 },
  { k: 'leonardo.ai', label: 'Leonardo AI', weight: 45 },
  { k: 'ideogram', label: 'Ideogram', weight: 45 },
  { k: 'dreamstudio', label: 'DreamStudio', weight: 45 },
  { k: 'playgroundai', label: 'Playground AI', weight: 45 },
  { k: 'adobe firefly', label: 'Adobe Firefly', weight: 45 },
  { k: 'firefly', label: 'Adobe Firefly', weight: 40 },
  { k: 'generative fill', label: 'Adobe Generative Fill', weight: 42 },
  { k: 'generative expand', label: 'AI-расширение кадра', weight: 42 },
  { k: 'magic eraser', label: 'AI-ластик', weight: 35 },
  { k: 'gemini', label: 'Google Gemini', weight: 40 },
  { k: 'imagen', label: 'Google Imagen', weight: 45 },
  { k: 'sora', label: 'OpenAI Sora', weight: 45 },
  { k: 'openai', label: 'OpenAI', weight: 40 },
  { k: 'runwayml', label: 'Runway', weight: 45 },
  { k: 'runway', label: 'Runway', weight: 42 },
  { k: 'gen-3', label: 'Runway Gen-3', weight: 45 },
  { k: 'kling', label: 'Kling AI', weight: 45 },
  { k: 'pika labs', label: 'Pika', weight: 45 },
  { k: 'luma ai', label: 'Luma AI', weight: 45 },
  { k: 'hailuo', label: 'Hailuo AI', weight: 45 },
  { k: 'minimax', label: 'MiniMax', weight: 42 },
  { k: 'veo', label: 'Google Veo', weight: 45 },
  { k: 'vidu', label: 'Vidu', weight: 45 },
  { k: 'deforum', label: 'Deforum', weight: 45 },
  { k: 'wan2', label: 'Wan 2.x', weight: 45 },
  { k: 'hunyuanvideo', label: 'HunyuanVideo', weight: 45 },
  { k: 'stable video', label: 'Stable Video Diffusion', weight: 45 },
  { k: 'suno', label: 'Suno', weight: 45 },
  { k: 'udio', label: 'Udio', weight: 45 },
  { k: 'elevenlabs', label: 'ElevenLabs', weight: 45 },
  { k: 'musicgen', label: 'MusicGen', weight: 45 },
  { k: 'audiocraft', label: 'AudioCraft', weight: 45 },
  { k: 'stable audio', label: 'Stable Audio', weight: 45 },
  { k: 'riffusion', label: 'Riffusion', weight: 45 },
  { k: 'aiva', label: 'AIVA', weight: 45 },
  { k: 'soundraw', label: 'Soundraw', weight: 45 },
  { k: 'mubert', label: 'Mubert', weight: 45 },
  { k: 'boomy', label: 'Boomy', weight: 45 },
  { k: 'wellsaid', label: 'WellSaid Labs', weight: 45 },
  { k: 'play.ht', label: 'Play.ht', weight: 45 },
  { k: 'descript', label: 'Descript', weight: 35 },
  { k: 'voicemod', label: 'Voicemod', weight: 35 },
  { k: 'remini', label: 'Remini (ИИ-апскейл)', weight: 40 },
  { k: 'topaz', label: 'Topaz AI (ИИ-апскейл)', weight: 38 },
  { k: 'gigapixel', label: 'Gigapixel AI', weight: 40 },
  { k: 'letsenhance', label: 'LetsEnhance AI', weight: 40 },
  { k: 'upscayl', label: 'Upscayl', weight: 40 },
  { k: 'lensa', label: 'Lensa AI', weight: 40 },
  { k: 'waifu diffusion', label: 'Waifu Diffusion', weight: 45 },
  { k: 'deepfloyd', label: 'DeepFloyd IF', weight: 45 },
  { k: 'kandinsky', label: 'Kandinsky', weight: 45 },
  { k: 'pixart', label: 'PixArt', weight: 45 },
  { k: 'shutterstock ai', label: 'Shutterstock AI', weight: 42 },
  { k: 'generated with', label: 'метка «generated with»', weight: 40 },
  { k: 'ai generated', label: 'метка «AI generated»', weight: 45 },
  { k: 'ai-created', label: 'метка «AI created»', weight: 45 },
  { k: 'txt2img', label: 'txt2img-пайплайн', weight: 45 },
  { k: 'img2img', label: 'img2img-пайплайн', weight: 40 },
  { k: 'diffusers', label: 'HuggingFace Diffusers', weight: 45 },
];

/** Маркеры бытовой/камерной съёмки (уменьшают оценку в пользу ИИ). */
export const HUMAN_KEYWORDS: Array<{ k: string; label: string; weight: number }> = [
  { k: 'com.android.version', label: 'метка Android-камеры', weight: 30 },
  { k: 'androidmedia', label: 'Android MediaRecorder', weight: 28 },
  { k: 'mediarecorder', label: 'программный рекордер камеры', weight: 26 },
  { k: 'omx.', label: 'аппаратный кодек устройства', weight: 26 },
  { k: 'iphone', label: 'iPhone', weight: 30 },
  { k: 'apple', label: 'Apple', weight: 24 },
  { k: 'quicktime', label: 'QuickTime', weight: 18 },
  { k: 'samsung', label: 'Samsung', weight: 24 },
  { k: 'xiaomi', label: 'Xiaomi', weight: 24 },
  { k: 'huawei', label: 'Huawei', weight: 24 },
  { k: 'honor', label: 'Honor', weight: 24 },
  { k: 'oneplus', label: 'OnePlus', weight: 24 },
  { k: 'oppo', label: 'OPPO', weight: 24 },
  { k: 'realme', label: 'realme', weight: 24 },
  { k: 'vivo', label: 'vivo', weight: 24 },
  { k: 'google', label: 'Google Pixel', weight: 24 },
  { k: 'pixel', label: 'Google Pixel', weight: 24 },
  { k: 'sony', label: 'Sony', weight: 26 },
  { k: 'canon', label: 'Canon', weight: 28 },
  { k: 'nikon', label: 'Nikon', weight: 28 },
  { k: 'olympus', label: 'Olympus', weight: 28 },
  { k: 'fujifilm', label: 'Fujifilm', weight: 28 },
  { k: 'panasonic', label: 'Panasonic', weight: 26 },
  { k: 'gopro', label: 'GoPro', weight: 28 },
  { k: 'dji', label: 'DJI', weight: 28 },
  { k: 'insta360', label: 'Insta360', weight: 28 },
  { k: 'lg electronics', label: 'LG', weight: 24 },
  { k: 'motorola', label: 'Motorola', weight: 24 },
  { k: 'asus', label: 'ASUS', weight: 20 },
  { k: 'nokia', label: 'Nokia', weight: 20 },
  { k: 'meizu', label: 'Meizu', weight: 20 },
  { k: 'zte', label: 'ZTE', weight: 20 },
];

/** FFmpeg-контейнер: признак software-перезаписи (не бытовая запись). */
export const FFMPEG_MARKERS = ['lavf', 'lavc', 'libav'];

/** Целевые (часто встречающиеся у генераторов) размеры изображений. */
export const AI_DIMENSION_VALUES = new Set([
  512, 576, 640, 680, 704, 768, 832, 896, 960, 1008, 1024, 1088, 1152, 1216,
  1280, 1344, 1408, 1536, 1664, 1728, 1792, 1856, 2048,
]);

/** Часто встречающиеся «экраны» — не показатель ИИ. */
export const COMMON_SCREEN_DIMENSIONS: Array<[number, number]> = [
  [1080, 2400], [1080, 2340], [1080, 2280], [1080, 2220], [1080, 2160],
  [1080, 2408], [1080, 2412], [1440, 3200], [1440, 3120], [720, 1600],
  [1080, 1920], [1080, 2312], [1206, 2622], [1290, 2796], [1179, 2556],
  [1170, 2532], [1284, 2778], [1242, 2688], [750, 1334], [640, 1136],
  [1440, 2560], [1600, 2560], [1200, 2000], [1600, 3200], [1220, 2712],
];

const ALNUM = /[a-z0-9]/;

/**
 * Совпадение по границам токена: ключевое слово не должно быть частью
 * более длинного слова. Без этого «udio» (генератор Udio) матчился внутри
 * «audiobook»/«audio», а «descript» — внутри «description», из-за чего
 * обычные файлы ложно помечались как ИИ-генерация.
 * Разделитель в конце ключа (например «omx.») ограничение справа
 * не накладывает.
 */
function matchesKeywordAt(hay: string, k: string, idx: number): boolean {
  const startOk = !ALNUM.test(k[0]) || idx === 0 || !ALNUM.test(hay[idx - 1]);
  const last = k[k.length - 1];
  const endOk =
    !ALNUM.test(last) ||
    idx + k.length >= hay.length ||
    !ALNUM.test(hay[idx + k.length]);
  return startOk && endOk;
}

/** Извлекает из строки ASCII-последовательности и ищет маркеры (по границам слов). */
export function findKeywords(
  haystack: string,
  dict: Array<{ k: string; label: string; weight: number }>,
): Array<{ k: string; label: string; weight: number }> {
  const hay = haystack.toLowerCase();
  const found: Array<{ k: string; label: string; weight: number }> = [];
  for (const item of dict) {
    if (found.some(f => f.k === item.k)) { continue; }
    const k = item.k.toLowerCase();
    let idx = hay.indexOf(k);
    while (idx !== -1) {
      if (matchesKeywordAt(hay, k, idx)) {
        found.push(item);
        break;
      }
      idx = hay.indexOf(k, idx + 1);
    }
  }
  return found;
}

/**
 * Превращает сырые байты в «читаемые строки» для поиска:
 * последовательности printable ASCII длиной ≥ 4.
 */
export function asciiStrings(bytes: Uint8Array, minLength = 4): string {
  const parts: string[] = [];
  let cur: number[] = [];
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b >= 32 && b <= 126) {
      cur.push(b);
    } else {
      if (cur.length >= minLength) {
        parts.push(String.fromCharCode(...cur));
      }
      cur = [];
    }
  }
  if (cur.length >= minLength) {
    parts.push(String.fromCharCode(...cur));
  }
  return parts.join('\n');
}
