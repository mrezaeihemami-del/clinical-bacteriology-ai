import { createHash } from "node:crypto";
import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";
import { AppError } from "../errors";
import { config } from "../config";

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export type ValidatedImage = {
  buffer: Buffer;
  detectedMimeType: "image/jpeg" | "image/png" | "image/webp";
  width: number;
  height: number;
  sizeBytes: number;
  sha256: string;
  safeExtension: "jpg" | "png" | "webp";
};

export async function validateAndNormaliseImage(
  input: Buffer,
): Promise<ValidatedImage> {
  if (input.length === 0) {
    throw new AppError(422, "EMPTY_FILE", "The uploaded file is empty");
  }

  if (input.length > config.MAX_UPLOAD_BYTES) {
    throw new AppError(
      413,
      "FILE_TOO_LARGE",
      `Image exceeds the ${config.MAX_UPLOAD_BYTES} byte limit`,
    );
  }

  const detected = await fileTypeFromBuffer(input);
  if (!detected || !allowedMimeTypes.has(detected.mime)) {
    throw new AppError(
      415,
      "UNSUPPORTED_IMAGE_TYPE",
      "Only genuine JPEG, PNG, and WebP images are accepted",
    );
  }

  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(input, {
      failOn: "error",
      limitInputPixels: config.MAX_IMAGE_PIXELS,
    }).metadata();
  } catch {
    throw new AppError(
      422,
      "INVALID_IMAGE",
      "The uploaded file cannot be decoded as a valid image",
    );
  }

  if (!metadata.width || !metadata.height) {
    throw new AppError(
      422,
      "INVALID_IMAGE_DIMENSIONS",
      "The image dimensions could not be determined",
    );
  }

  if (metadata.width < 64 || metadata.height < 64) {
    throw new AppError(
      422,
      "IMAGE_TOO_SMALL",
      "Images must be at least 64 × 64 pixels",
    );
  }

  if (metadata.width * metadata.height > config.MAX_IMAGE_PIXELS) {
    throw new AppError(
      413,
      "IMAGE_PIXEL_LIMIT",
      "Image dimensions exceed the configured pixel limit",
    );
  }

  const pipeline = sharp(input, {
    failOn: "error",
    limitInputPixels: config.MAX_IMAGE_PIXELS,
  }).rotate();

  let buffer: Buffer;
  let detectedMimeType: ValidatedImage["detectedMimeType"];
  let safeExtension: ValidatedImage["safeExtension"];

  switch (detected.mime) {
    case "image/jpeg":
      buffer = await pipeline.jpeg({ quality: 95, mozjpeg: true }).toBuffer();
      detectedMimeType = "image/jpeg";
      safeExtension = "jpg";
      break;
    case "image/png":
      buffer = await pipeline.png({ compressionLevel: 9 }).toBuffer();
      detectedMimeType = "image/png";
      safeExtension = "png";
      break;
    case "image/webp":
      buffer = await pipeline.webp({ quality: 95 }).toBuffer();
      detectedMimeType = "image/webp";
      safeExtension = "webp";
      break;
    default:
      throw new AppError(
        415,
        "UNSUPPORTED_IMAGE_TYPE",
        "Unsupported image type",
      );
  }

  const normalisedMetadata = await sharp(buffer).metadata();
  const sha256 = createHash("sha256").update(buffer).digest("hex");

  return {
    buffer,
    detectedMimeType,
    width: normalisedMetadata.width ?? metadata.width,
    height: normalisedMetadata.height ?? metadata.height,
    sizeBytes: buffer.length,
    sha256,
    safeExtension,
  };
}
