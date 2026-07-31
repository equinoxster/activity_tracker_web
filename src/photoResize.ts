// Client-side photo downscaling before upload: max 2048 px long side, JPEG.
export async function downscaleImage(file: Blob, maxDim = 2048, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  try {
    const longSide = Math.max(bitmap.width, bitmap.height)
    const scale = longSide > maxDim ? maxDim / longSide : 1
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height)
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('image encode failed'))),
        'image/jpeg',
        quality,
      )
    })
  } finally {
    bitmap.close()
  }
}
