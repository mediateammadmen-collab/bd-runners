// Downscales a photo to at most `maxDim` px on its longest side and re-encodes
// it as JPEG. Phone photos are typically 3–8 MB; this brings them to roughly
// 200–400 KB so thousands fit in the free 1 GB storage tier.
export async function compressImage(file: File, maxDim = 1600, quality = 0.82): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("Couldn't read that image — please choose a JPG or PNG photo.");
  }

  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser couldn't process that image.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Your browser couldn't process that image."))),
      "image/jpeg",
      quality,
    );
  });
}
