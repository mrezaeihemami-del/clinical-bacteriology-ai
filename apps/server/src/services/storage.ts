import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "../config";

const client = new S3Client({
  region: config.S3_REGION,
  endpoint: config.S3_ENDPOINT,
  forcePathStyle: config.S3_FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: config.S3_ACCESS_KEY,
    secretAccessKey: config.S3_SECRET_KEY,
  },
});

export async function ensureStorageBucket(): Promise<void> {
  try {
    await client.send(new HeadBucketCommand({ Bucket: config.S3_BUCKET }));
  } catch (error) {
    if (config.NODE_ENV === "production") {
      throw new Error(
        `Private storage bucket ${config.S3_BUCKET} is unavailable`,
        { cause: error },
      );
    }

    await client.send(
      new CreateBucketCommand({
        Bucket: config.S3_BUCKET,
      }),
    );
  }
}



export async function checkStorageReady(): Promise<void> {
  await client.send(new HeadBucketCommand({ Bucket: config.S3_BUCKET }));
}

export async function putPrivateObject(input: {
  key: string;
  body: Buffer;
  contentType: string;
  sha256: string;
}): Promise<void> {
  await client.send(
    new PutObjectCommand({
      Bucket: config.S3_BUCKET,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
      Metadata: {
        sha256: input.sha256,
      },
      ServerSideEncryption:
        config.S3_ENDPOINT.includes("amazonaws.com") ? "AES256" : undefined,
    }),
  );
}

export async function deletePrivateObject(key: string): Promise<void> {
  await client.send(
    new DeleteObjectCommand({
      Bucket: config.S3_BUCKET,
      Key: key,
    }),
  );
}

export async function getPrivateObject(key: string): Promise<Buffer> {
  const output = await client.send(
    new GetObjectCommand({
      Bucket: config.S3_BUCKET,
      Key: key,
    }),
  );

  if (!output.Body) {
    throw new Error("Stored object has no body");
  }

  const bytes = await output.Body.transformToByteArray();
  return Buffer.from(bytes);
}

export async function createPrivateReadUrl(key: string): Promise<string> {
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: config.S3_BUCKET,
      Key: key,
    }),
    {
      expiresIn: config.SIGNED_URL_TTL_SECONDS,
    },
  );
}
