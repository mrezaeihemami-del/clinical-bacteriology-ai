import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadImage } from "./api";

class ListenerTarget {
  private readonly listeners = new Map<string, Array<(event: Event) => void>>();

  addEventListener(name: string, listener: (event: Event) => void) {
    const items = this.listeners.get(name) ?? [];
    items.push(listener);
    this.listeners.set(name, items);
  }

  emit(name: string, event = new Event(name)) {
    for (const listener of this.listeners.get(name) ?? []) listener(event);
  }
}

class FakeXmlHttpRequest extends ListenerTarget {
  static last: FakeXmlHttpRequest | null = null;

  readonly upload = new ListenerTarget();
  status = 201;
  responseText = JSON.stringify({
    image: {
      id: "image-1",
      originalFileName: "plate.png",
      detectedMimeType: "image/png",
      sizeBytes: 4,
      width: 64,
      height: 64,
      sha256: "a".repeat(64),
      uploadedAt: new Date().toISOString(),
      analyses: [],
    },
  });
  withCredentials = false;
  method = "";
  url = "";
  body: Document | XMLHttpRequestBodyInit | null = null;

  constructor() {
    super();
    FakeXmlHttpRequest.last = this;
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  send(body?: Document | XMLHttpRequestBodyInit | null) {
    this.body = body ?? null;
    queueMicrotask(() => this.emit("load"));
  }
}

describe("real browser upload client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    FakeXmlHttpRequest.last = null;
    vi.restoreAllMocks();
  });

  it("sends the selected File in a multipart FormData image field", async () => {
    vi.stubGlobal(
      "XMLHttpRequest",
      FakeXmlHttpRequest as unknown as typeof XMLHttpRequest,
    );

    const file = new File([new Uint8Array([1, 2, 3, 4])], "plate.png", {
      type: "image/png",
    });

    const result = await uploadImage("case-123", file, vi.fn());
    const request = FakeXmlHttpRequest.last;

    expect(request?.method).toBe("POST");
    expect(request?.url).toBe("/api/cases/case-123/images");
    expect(request?.withCredentials).toBe(true);
    expect(request?.body).toBeInstanceOf(FormData);
    expect((request?.body as FormData).get("image")).toBe(file);
    expect(result.id).toBe("image-1");
  });

  it("reports non-JSON upload responses without throwing from the event handler", async () => {
    vi.stubGlobal(
      "XMLHttpRequest",
      FakeXmlHttpRequest as unknown as typeof XMLHttpRequest,
    );

    const file = new File([new Uint8Array([1])], "plate.png", {
      type: "image/png",
    });
    const promise = uploadImage("case-123", file, vi.fn());
    if (FakeXmlHttpRequest.last) {
      FakeXmlHttpRequest.last.responseText = "<html>proxy error</html>";
    }

    await expect(promise).rejects.toMatchObject({
      code: "INVALID_UPLOAD_RESPONSE",
    });
  });
});
