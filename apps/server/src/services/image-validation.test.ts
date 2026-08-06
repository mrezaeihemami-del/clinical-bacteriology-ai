import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { validateAndNormaliseImage } from "./image-validation";

describe("image validation", () => {
  it("detects the real MIME type from bytes", async () => {
    const png = await sharp({
      create: {
        width: 128,
        height: 128,
        channels: 3,
        background: { r: 20, g: 40, b: 60 },
      },
    })
      .png()
      .toBuffer();

    const result = await validateAndNormaliseImage(png);
    expect(result.detectedMimeType).toBe("image/png");
    expect(result.width).toBe(128);
    expect(result.height).toBe(128);
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects non-image bytes even when a client could label them JPEG", async () => {
    await expect(
      validateAndNormaliseImage(Buffer.from("not really a jpeg")),
    ).rejects.toMatchObject({
      code: "UNSUPPORTED_IMAGE_TYPE",
    });
  });

  it("rejects images too small for a meaningful visual check", async () => {
    const onePixel = await sharp({
      create: {
        width: 1,
        height: 1,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .png()
      .toBuffer();

    await expect(validateAndNormaliseImage(onePixel)).rejects.toMatchObject({
      code: "IMAGE_TOO_SMALL",
    });
  });
});
