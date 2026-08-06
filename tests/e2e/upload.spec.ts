import path from "node:path";
import { test, expect } from "@playwright/test";

test("technologist creates a case and uploads real multipart image bytes", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Email").fill("technician@example.test");
  await page.getByLabel("Password").fill("ChangeMe-123!");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("heading", { name: "Laboratory cases" })).toBeVisible();
  await page.getByRole("button", { name: "New case" }).click();

  const code = `E2E-${Date.now()}`;
  await page.getByLabel("Case code").fill(code);
  await page.getByLabel("Culture media").fill("Blood agar");
  await page.getByRole("button", { name: "Create case" }).click();

  await expect(page.getByRole("heading", { name: code })).toBeVisible();
  const fixture = path.resolve("tests/e2e/fixtures/agar-test.png");
  await page.getByLabel("Upload an agar plate image").setInputFiles(fixture);
  await page.getByRole("button", { name: "Upload and validate" }).click();

  await expect(
    page.getByText("Image validated, stored privately and recorded successfully."),
  ).toBeVisible();
  await expect(page.getByText("agar-test.png")).toBeVisible();
  await expect(page.getByText("IMAGE_UPLOADED", { exact: true }).first()).toBeVisible();
});
