package com.aiscan

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMetadataRetriever
import android.util.Base64
import androidx.exifinterface.media.ExifInterface
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.io.RandomAccessFile
import java.nio.ByteBuffer
import java.util.concurrent.Executors
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * Нативный модуль медиа-анализа AI Scan.
 *  - analyzeImage: EXIF + тайловая статистика + кропы «гладкой» и «текстурной» зон (RGBA base64)
 *  - extractVideo:  метаданные MP4/MKV/… + кадры JPEG + сигнатуры контейнера
 *  - decodeAudio:   MediaCodec → моно PCM s16 (до maxSeconds) в кеш
 */
class NativeMediaModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  companion object {
    private val executor = Executors.newFixedThreadPool(2)
    private const val GRID = 16
    private const val CROP = 320
    private const val FRAME_DIR = "aiscan_frames"
    private const val MAX_FULL_PIXELS = 40_000_000
  }

  override fun getName(): String = "NativeMedia"

  // ------------------------------------------------------------------ image

  private fun decodeBounds(path: String): Pair<Int, Int> {
    val o = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(path, o)
    if (o.outWidth <= 0 || o.outHeight <= 0) {
      throw IllegalArgumentException("не удалось открыть изображение")
    }
    return Pair(o.outWidth, o.outHeight)
  }

  private fun sampleFor(w: Int, h: Int, target: Int): Int {
    var s = 1
    while (max(w, h) / (s * 2) >= target) {
      s *= 2
    }
    return s
  }

  private data class TileStats(val means: FloatArray, val vars: FloatArray, val grid: Int,
                               val smallW: Int, val smallH: Int)

  private fun tileStats(small: Bitmap): TileStats {
    val w = small.width
    val h = small.height
    val px = IntArray(w * h)
    small.getPixels(px, 0, w, 0, 0, w, h)
    val grid = GRID
    val tileW = w.toFloat() / grid
    val tileH = h.toFloat() / grid
    val means = FloatArray(grid * grid)
    val vars = FloatArray(grid * grid)
    for (ty in 0 until grid) {
      for (tx in 0 until grid) {
        val x0 = (tx * tileW).toInt()
        val x1 = min(w, ((tx + 1) * tileW).toInt())
        val y0 = (ty * tileH).toInt()
        val y1 = min(h, ((ty + 1) * tileH).toInt())
        var sum = 0.0
        var sumSq = 0.0
        var n = 0
        for (y in y0 until y1) {
          val row = y * w
          for (x in x0 until x1) {
            val c = px[row + x]
            val r = (c shr 16) and 0xFF
            val g = (c shr 8) and 0xFF
            val b = c and 0xFF
            val l = 0.299 * r + 0.587 * g + 0.114 * b
            sum += l
            sumSq += l * l
            n++
          }
        }
        val idx = ty * grid + tx
        if (n > 0) {
          val m = sum / n
          means[idx] = m.toFloat()
          vars[idx] = (sumSq / n - m * m).toFloat()
        } else {
          means[idx] = 0f
          vars[idx] = Float.MAX_VALUE
        }
      }
    }
    return TileStats(means, vars, grid, w, h)
  }

  private fun cropBase64(full: Bitmap, cx: Int, cy: Int): String {
    val size = min(CROP, min(full.width, full.height))
    val x = max(0, min(full.width - size, cx - size / 2))
    val y = max(0, min(full.height - size, cy - size / 2))
    val bitmap = Bitmap.createBitmap(full, x, y, size, size)
    val pixels = IntArray(size * size)
    bitmap.getPixels(pixels, 0, size, 0, 0, size, size)
    if (bitmap !== full) {
      bitmap.recycle()
    }
    val bytes = ByteArray(size * size * 4)
    for (i in pixels.indices) {
      val c = pixels[i]
      bytes[i * 4] = ((c shr 16) and 0xFF).toByte()
      bytes[i * 4 + 1] = ((c shr 8) and 0xFF).toByte()
      bytes[i * 4 + 2] = (c and 0xFF).toByte()
      bytes[i * 4 + 3] = ((c shr 24) and 0xFF).toByte()
    }
    return Base64.encodeToString(bytes, Base64.NO_WRAP)
  }

  private fun readExif(path: String): WritableMap {
    val map = Arguments.createMap()
    try {
      val ex = ExifInterface(path)
      fun put(key: String, value: String?) {
        if (!value.isNullOrBlank()) {
          map.putString(key, value)
        }
      }
      put("make", ex.getAttribute(ExifInterface.TAG_MAKE))
      put("model", ex.getAttribute(ExifInterface.TAG_MODEL))
      put("software", ex.getAttribute(ExifInterface.TAG_SOFTWARE))
      put("datetime", ex.getAttribute(ExifInterface.TAG_DATETIME))
      put("artist", ex.getAttribute(ExifInterface.TAG_ARTIST))
      put("lensMake", ex.getAttribute(ExifInterface.TAG_LENS_MAKE))
      put("fNumber", ex.getAttribute(ExifInterface.TAG_F_NUMBER))
      put("exposureTime", ex.getAttribute(ExifInterface.TAG_EXPOSURE_TIME))
      put("iso", ex.getAttribute(ExifInterface.TAG_ISO_SPEED_RATINGS)
        ?: ex.getAttribute(ExifInterface.TAG_PHOTOGRAPHIC_SENSITIVITY))
      val lat = ex.getAttribute(ExifInterface.TAG_GPS_LATITUDE)
      val latRef = ex.getAttribute(ExifInterface.TAG_GPS_LATITUDE_REF)
      map.putBoolean("gps", lat != null || latRef != null)
    } catch (_: Throwable) {
      map.putBoolean("gps", false)
    }
    return map
  }

  private fun analyzeImageInternal(path: String): WritableMap {
    val (fullW, fullH) = decodeBounds(path)
    val exif = readExif(path)

    val sample = sampleFor(fullW, fullH, 640)
    val smallOpts = BitmapFactory.Options().apply {
      inSampleSize = sample
      inPreferredConfig = Bitmap.Config.ARGB_8888
    }
    val small = BitmapFactory.decodeFile(path, smallOpts)
      ?: throw IllegalArgumentException("битое изображение")
    val stats = tileStats(small)

    // Индексы: 0 — самый гладкий тайл, 1 — самый текстурный.
    var flatIdx = -1
    var detailIdx = -1
    var flatVar = Float.MAX_VALUE
    var detailVar = -1f
    for (i in stats.vars.indices) {
      val v = stats.vars[i]
      if (v < Float.MAX_VALUE) {
        if (v < flatVar) {
          flatVar = v
          flatIdx = i
        }
        if (v > detailVar) {
          detailVar = v
          detailIdx = i
        }
      }
    }
    if (flatIdx < 0) {
      flatIdx = stats.vars.size / 2
      detailIdx = flatIdx
    }

    // Полноформатный битмап для кропов.
    var full: Bitmap? = null
    try {
      if (fullW.toLong() * fullH <= MAX_FULL_PIXELS) {
        full = BitmapFactory.decodeFile(path)
      }
    } catch (_: OutOfMemoryError) {
      System.gc()
    }
    if (full == null) {
      // фоллбэк: декодируем с даунсэмплом (кропы будут менее детальными)
      val fbOpts = BitmapFactory.Options().apply {
        inSampleSize = sampleFor(fullW, fullH, 2400)
        inPreferredConfig = Bitmap.Config.ARGB_8888
      }
      full = BitmapFactory.decodeFile(path, fbOpts)
    }
    if (full == null) {
      throw IllegalArgumentException("не удалось декодировать пиксели")
    }

    val scale = full.width.toFloat() / stats.smallW
    val tileW = stats.smallW.toFloat() / stats.grid
    val tileH = stats.smallH.toFloat() / stats.grid

    fun centerOf(idx: Int): Pair<Int, Int> {
      val tx = idx % stats.grid
      val ty = idx / stats.grid
      val cxSmall = (tx + 0.5f) * tileW
      val cySmall = (ty + 0.5f) * tileH
      return Pair((cxSmall * scale).roundToInt(), (cySmall * scale).roundToInt())
    }

    val (flatCx, flatCy) = centerOf(flatIdx)
    val (detailCx, detailCy) = centerOf(detailIdx)

    val out = Arguments.createMap()
    out.putInt("width", fullW)
    out.putInt("height", fullH)
    out.putMap("exif", exif)
    out.putInt("grid", stats.grid)
    val meansArr = Arguments.createArray()
    for (v in stats.means) {
      meansArr.pushDouble(v.toDouble())
    }
    out.putArray("tileMeans", meansArr)
    val varsArr = Arguments.createArray()
    for (v in stats.vars) {
      varsArr.pushDouble(v.toDouble())
    }
    out.putArray("tileVars", varsArr)

    val flatB64 = cropBase64(full, flatCx, flatCy)
    out.putString("cropFlat", flatB64)
    out.putInt("cropFlatSize", min(CROP, min(full.width, full.height)))
    val detailB64 = cropBase64(full, detailCx, detailCy)
    out.putString("cropDetail", detailB64)
    out.putInt("cropDetailSize", min(CROP, min(full.width, full.height)))

    small.recycle()
    if (full !== small) {
      full.recycle()
    }
    return out
  }

  @ReactMethod
  fun analyzeImage(path: String, promise: Promise) {
    executor.execute {
      try {
        promise.resolve(analyzeImageInternal(path))
      } catch (t: Throwable) {
        promise.reject("EIMAGE", t.message ?: "ошибка анализа изображения", t)
      }
    }
  }

  // ------------------------------------------------------------------ video

  private fun metaLong(mmr: MediaMetadataRetriever, key: Int): Long {
    return try {
      mmr.extractMetadata(key)?.toLongOrNull() ?: -1L
    } catch (_: Throwable) {
      -1L
    }
  }

  private fun metaBool(mmr: MediaMetadataRetriever, key: Int): Boolean {
    return try {
      val v = mmr.extractMetadata(key) ?: return false
      v.equals("yes", true) || v.equals("true", true) || v == "1"
    } catch (_: Throwable) {
      false
    }
  }

  private fun metaInt(mmr: MediaMetadataRetriever, key: Int): Int {
    return try {
      mmr.extractMetadata(key)?.toIntOrNull() ?: -1
    } catch (_: Throwable) {
      -1
    }
  }

  private fun printableAscii(bytes: ByteArray): String {
    val sb = StringBuilder(bytes.size)
    for (b in bytes) {
      val c = b.toInt() and 0xFF
      sb.append(if (c in 32..126) c.toChar() else '\n')
    }
    return sb.toString()
  }

  private fun readContainerSignatures(path: String): Pair<String, String> {
    val file = File(path)
    if (!file.exists() || file.length() < 16) {
      return Pair("", "")
    }
    val headSize = min(4_000_000L, file.length())
    val head = ByteArray(headSize.toInt())
    RandomAccessFile(file, "r").use { raf ->
      raf.readFully(head)
    }
    var tail = ByteArray(0)
    if (file.length() > headSize) {
      val tailSize = min(1_000_000L, file.length() - headSize)
      tail = ByteArray(tailSize.toInt())
      RandomAccessFile(file, "r").use { raf ->
        raf.seek(file.length() - tailSize)
        raf.readFully(tail)
      }
    }
    val ftyp = if (head.size >= 12 &&
      head[4].toInt().toChar() == 'f' && head[5].toInt().toChar() == 't' &&
      head[6].toInt().toChar() == 'y' && head[7].toInt().toChar() == 'p'
    ) {
      String(head, 8, 4, Charsets.ISO_8859_1)
    } else {
      ""
    }
    val all = printableAscii(head) + "\n" + printableAscii(tail)
    return Pair(all, ftyp)
  }

  private fun extractVideoInternal(path: String, frameCount: Int): WritableMap {
    val mmr = MediaMetadataRetriever()
    var framesOut = Arguments.createArray()
    var container = ""
    var ftyp = ""
    try {
      mmr.setDataSource(path)
      val durationMs = metaLong(mmr, MediaMetadataRetriever.METADATA_KEY_DURATION)
      val width = metaInt(mmr, MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)
      val height = metaInt(mmr, MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)
      val hasAudio = metaBool(mmr, MediaMetadataRetriever.METADATA_KEY_HAS_AUDIO)
      val hasVideo = metaBool(mmr, MediaMetadataRetriever.METADATA_KEY_HAS_VIDEO)
      val bitrate = metaInt(mmr, MediaMetadataRetriever.METADATA_KEY_BITRATE)
      val mime = mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_MIMETYPE) ?: ""
      var frameRate = -1
      try {
        val fr = mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_CAPTURE_FRAMERATE)
        frameRate = fr?.toFloatOrNull()?.roundToInt() ?: -1
      } catch (_: Throwable) {
        frameRate = -1
      }

      // Кадры.
      val dir = File(reactContext.cacheDir, FRAME_DIR).also { it.mkdirs() }
      // чистим старые кадры
      dir.listFiles()?.forEach { f -> try { f.delete() } catch (_: Throwable) {} }
      val count = max(1, min(frameCount, 8))
      if (durationMs > 0) {
        for (i in 0 until count) {
          val frac = if (count == 1) 0.5 else (0.05 + 0.9 * i / (count - 1))
          val tUs = (durationMs * frac * 1000).toLong()
          val bmp = try {
            mmr.getFrameAtTime(tUs, MediaMetadataRetriever.OPTION_CLOSEST)
          } catch (_: Throwable) {
            null
          } ?: continue
          val file = File(dir, "frame_$i.jpg")
          file.outputStream().use { os ->
            bmp.compress(Bitmap.CompressFormat.JPEG, 90, os)
          }
          if (bmp !== null && !bmp.isRecycled) {
            bmp.recycle()
          }
          val entry = Arguments.createMap()
          entry.putString("path", file.absolutePath)
          entry.putDouble("timeMs", (durationMs * frac).toDouble())
          framesOut.pushMap(entry)
        }
      }

      val sigs = readContainerSignatures(path)
      container = sigs.first
      ftyp = sigs.second

      val out = Arguments.createMap()
      out.putDouble("durationMs", durationMs.toDouble())
      out.putInt("width", width)
      out.putInt("height", height)
      out.putBoolean("hasAudio", hasAudio)
      out.putBoolean("hasVideo", hasVideo)
      out.putInt("bitrate", bitrate)
      out.putString("mimetype", mime)
      if (frameRate > 0) {
        out.putInt("frameRate", frameRate)
      }
      out.putArray("frames", framesOut)
      out.putString("containerStrings", container)
      out.putString("ftyp", ftyp)
      return out
    } finally {
      try {
        mmr.release()
      } catch (_: Throwable) {
      }
    }
  }

  @ReactMethod
  fun extractVideo(path: String, frameCount: Int, promise: Promise) {
    executor.execute {
      try {
        promise.resolve(extractVideoInternal(path, frameCount))
      } catch (t: Throwable) {
        promise.reject("EVIDEO", t.message ?: "ошибка разбора видео", t)
      }
    }
  }

  // ------------------------------------------------------------------ audio

  private data class PcmAccum(
    val bytes: ByteArrayOutputStream = ByteArrayOutputStream(),
    var sampleRate: Int = 0,
    var channels: Int = 0,
    var totalFrames: Long = 0,
    var lSum: Double = 0.0,
    var rSum: Double = 0.0,
    var lrSum: Double = 0.0,
    var llSum: Double = 0.0,
    var rrSum: Double = 0.0,
    var pairs: Long = 0,
  )

  private fun feedOutput(acc: PcmAccum, buf: ByteBuffer, size: Int, encoding: Int) {
    val ch = max(1, acc.channels)
    // Значения AudioFormat: ENCODING_PCM_16BIT=2, ENCODING_PCM_8BIT=3, ENCODING_PCM_FLOAT=4.
    when (encoding) {
      4 -> { // PCM_FLOAT
        val floatCount = size / 4
        val out = ShortArray(floatCount)
        for (i in 0 until floatCount) {
          val v = buf.getFloat(buf.position() + i * 4)
          val c = if (v > 1f) 32767f else if (v < -1f) -32767f else v * 32767f
          out[i] = c.roundToInt().toShort()
        }
        acc.bytes.write(shortsToBytesLE(out, ch, acc))
      }
      3 -> { // PCM_8BIT
        val tmp = ByteArray(size)
        buf.get(tmp)
        val out = ShortArray(size)
        for (i in 0 until size) {
          out[i] = ((tmp[i].toInt() - 128) shl 8).toShort()
        }
        acc.bytes.write(shortsToBytesLE(out, ch, acc))
      }
      else -> { // PCM_16BIT и по умолчанию
        val shortCount = size / 2
        val out = ShortArray(shortCount)
        for (i in 0 until shortCount) {
          out[i] = buf.getShort(buf.position() + i * 2)
        }
        acc.bytes.write(shortsToBytesLE(out, ch, acc))
      }
    }
  }

  /** Усредняет каналы в моно; если стерео — копит статистику корреляции. */
  private fun shortsToBytesLE(src: ShortArray, ch: Int, acc: PcmAccum): ByteArray {
    val frames = src.size / ch
    val out = ByteArray(frames * 2)
    if (ch == 1) {
      for (f in 0 until frames) {
        val v = src[f]
        out[f * 2] = (v.toInt() and 0xFF).toByte()
        out[f * 2 + 1] = ((v.toInt() shr 8) and 0xFF).toByte()
        acc.totalFrames++
      }
    } else {
      var i = 0
      for (f in 0 until frames) {
        val l = src[i].toInt()
        val r = src[i + 1].toInt()
        i += ch
        if (acc.pairs < 8_000_000L) {
          acc.lSum += l
          acc.rSum += r
          acc.lrSum += l.toDouble() * r
          acc.llSum += l.toDouble() * l
          acc.rrSum += r.toDouble() * r
          acc.pairs++
        }
        val m = ((l + r) / 2).coerceIn(-32768, 32767)
        out[f * 2] = (m and 0xFF).toByte()
        out[f * 2 + 1] = ((m shr 8) and 0xFF).toByte()
        acc.totalFrames++
      }
    }
    return out
  }

  private fun decodeAudioInternal(path: String, maxSeconds: Int): WritableMap {
    val extractor = MediaExtractor()
    var codec: MediaCodec? = null
    try {
      extractor.setDataSource(path)
      var track = -1
      var mime: String? = null
      for (i in 0 until extractor.trackCount) {
        val f = extractor.getTrackFormat(i)
        val m = f.getString(MediaFormat.KEY_MIME) ?: continue
        if (m.startsWith("audio/")) {
          track = i
          mime = m
          break
        }
      }
      if (track < 0 || mime == null) {
        throw IllegalArgumentException("звуковая дорожка не найдена")
      }
      extractor.selectTrack(track)
      val inFormat = extractor.getTrackFormat(track)
      val acc = PcmAccum()
      acc.sampleRate = if (inFormat.containsKey(MediaFormat.KEY_SAMPLE_RATE)) {
        inFormat.getInteger(MediaFormat.KEY_SAMPLE_RATE)
      } else 44100
      acc.channels = if (inFormat.containsKey(MediaFormat.KEY_CHANNEL_COUNT)) {
        inFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
      } else 2
      val srcRate = acc.sampleRate
      val srcCh = acc.channels

      codec = MediaCodec.createDecoderByType(mime)
      codec.configure(inFormat, null, null, 0)
      codec.start()

      val info = MediaCodec.BufferInfo()
      var inputDone = false
      var outputDone = false
      var encoding = 2 // PCM_16BIT
      val maxUs = maxSeconds * 1_000_000L
      val deadline = System.currentTimeMillis() + 180_000L

      while (!outputDone) {
        if (System.currentTimeMillis() > deadline) {
          if (acc.totalFrames <= 0) {
            throw IllegalStateException("декодер не выдал данных (таймаут)")
          }
          outputDone = true
          break
        }
        if (!inputDone) {
          val inIdx = codec.dequeueInputBuffer(50_000)
          if (inIdx >= 0) {
            val inBuf = codec.getInputBuffer(inIdx)!!
            val sampleSize = extractor.readSampleData(inBuf, 0)
            if (sampleSize < 0) {
              inputDone = true
              codec.queueInputBuffer(inIdx, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
            } else {
              val pts = extractor.sampleTime
              if (pts in 0 until maxUs) {
                codec.queueInputBuffer(inIdx, 0, sampleSize, pts, 0)
                extractor.advance()
              } else {
                inputDone = true
                codec.queueInputBuffer(inIdx, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
              }
            }
          }
        }

        val outIdx = codec.dequeueOutputBuffer(info, 50_000)
        when {
          outIdx == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
            val of = codec.outputFormat
            if (of.containsKey(MediaFormat.KEY_SAMPLE_RATE)) {
              acc.sampleRate = of.getInteger(MediaFormat.KEY_SAMPLE_RATE)
            }
            if (of.containsKey(MediaFormat.KEY_CHANNEL_COUNT)) {
              acc.channels = of.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
            }
            encoding = if (of.containsKey(MediaFormat.KEY_PCM_ENCODING)) {
              of.getInteger(MediaFormat.KEY_PCM_ENCODING)
            } else 2
          }
          outIdx >= 0 -> {
            if (info.size > 0) {
              val outBuf = codec.getOutputBuffer(outIdx)!!
              outBuf.position(info.offset)
              outBuf.limit(info.offset + info.size)
              feedOutput(acc, outBuf, info.size, encoding)
            }
            codec.releaseOutputBuffer(outIdx, false)
            if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) {
              outputDone = true
            }
          }
        }
      }

      codec.stop()
      codec.release()
      codec = null

      // Защита от рассинхронизации каналов.
      if (acc.channels < 1) {
        acc.channels = srcCh
      }
      if (acc.sampleRate < 1000) {
        acc.sampleRate = srcRate
      }

      val pcm = acc.bytes.toByteArray()
      // Ресемплинг: если > 48 кГц — простое целочисленное прореживание.
      val rate = acc.sampleRate
      var outRate = rate
      var data = pcm
      if (rate > 48_000) {
        val factor = (rate + 47_999) / 48_000
        outRate = rate / factor
        val frames = pcm.size / 2
        val kept = ByteArray((frames / factor) * 2)
        var w = 0
        var f = 0
        while (f < frames && w + 1 < kept.size) {
          kept[w] = pcm[f * 2]
          kept[w + 1] = pcm[f * 2 + 1]
          w += 2
          f += factor
        }
        data = kept
      }

      val outFile = File(reactContext.cacheDir, "aiscan_audio_${System.currentTimeMillis()}.pcm")
      outFile.writeBytes(data)

      val durationMs = if (outRate > 0) (data.size / 2L) * 1000L / outRate else 0L

      val out = Arguments.createMap()
      out.putString("pcmPath", outFile.absolutePath)
      out.putInt("sampleRate", outRate)
      out.putInt("originalSampleRate", rate)
      out.putInt("channels", acc.channels)
      out.putDouble("durationMs", durationMs.toDouble())
      out.putString("mime", mime)
      if (inFormat.containsKey(MediaFormat.KEY_BIT_RATE)) {
        out.putInt("bitrate", inFormat.getInteger(MediaFormat.KEY_BIT_RATE))
      }
      if (acc.channels == 2 && acc.pairs > 1000) {
        val n = acc.pairs.toDouble()
        val cov = acc.lrSum / n - (acc.lSum / n) * (acc.rSum / n)
        val vl = acc.llSum / n - (acc.lSum / n) * (acc.lSum / n)
        val vr = acc.rrSum / n - (acc.rSum / n) * (acc.rSum / n)
        if (vl > 0 && vr > 0) {
          out.putDouble("stereoCorrelation", cov / kotlin.math.sqrt(vl * vr))
        }
      }
      return out
    } finally {
      try {
        codec?.release()
      } catch (_: Throwable) {
      }
      try {
        extractor.release()
      } catch (_: Throwable) {
      }
    }
  }

  @ReactMethod
  fun decodeAudio(path: String, maxSeconds: Int, promise: Promise) {
    executor.execute {
      try {
        promise.resolve(decodeAudioInternal(path, maxSeconds))
      } catch (t: Throwable) {
        promise.reject("EAUDIO", t.message ?: "не удалось декодировать аудио", t)
      }
    }
  }

  // ------------------------------------------------------------------ copy

  /**
   * Копирует content:// URI (выбор файла) в обычный локальный файл.
   * Возвращает размер в байтах.
   */
  @ReactMethod
  fun copyFromContent(contentUri: String, destPath: String, promise: Promise) {
    executor.execute {
      try {
        val uri = android.net.Uri.parse(contentUri)
        if (uri.scheme != "content" && uri.scheme != "file") {
          throw IllegalArgumentException("неподдерживаемая схема: ${uri.scheme}")
        }
        val input = reactContext.contentResolver.openInputStream(uri)
          ?: throw IllegalStateException("не удалось открыть $contentUri")
        val dest = File(destPath)
        dest.parentFile?.mkdirs()
        input.use { ins ->
          FileOutputStream(dest).use { outs ->
            ins.copyTo(outs)
          }
        }
        promise.resolve(dest.length().toDouble())
      } catch (t: Throwable) {
        promise.reject("ECOPY", t.message ?: "не удалось скопировать файл", t)
      }
    }
  }
}
