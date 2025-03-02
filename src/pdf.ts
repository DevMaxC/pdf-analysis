import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { PDFExtract, PDFExtractOptions } from "pdf.js-extract";

const execAsync = promisify(exec);

/**
 * Extracts all pages from a PDF as images and returns them as data URLs
 * @param pdfPath Path to the PDF file
 * @returns Array of data URLs for each page
 */
async function getPdfPageImages(pdfPath: string): Promise<string[]> {
  // Verify the PDF exists
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF file not found at path: ${pdfPath}`);
  }

  // Create temp directory if it doesn't exist
  const tempDir = path.join(process.cwd(), "temp");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }

  // Generate a unique identifier for this conversion
  const uniqueId = Date.now().toString();
  const outputPattern = path.join(tempDir, `page-${uniqueId}-%d.png`);

  try {
    // Use pdftoppm (from poppler-utils) to convert PDF to images
    // This is a much more reliable approach for Node.js
    await execAsync(
      `pdftoppm -png -r 150 "${pdfPath}" "${path.join(
        tempDir,
        `page-${uniqueId}`
      )}"`,
      {
        timeout: 60000, // 1 minute timeout
      }
    );

    // Find all generated images
    const files = fs
      .readdirSync(tempDir)
      .filter(
        (file) => file.startsWith(`page-${uniqueId}-`) && file.endsWith(".png")
      )
      .sort((a, b) => {
        const numA = parseInt(a.match(/page-\d+-(\d+)\.png/)?.[1] || "0");
        const numB = parseInt(b.match(/page-\d+-(\d+)\.png/)?.[1] || "0");
        return numA - numB;
      });

    // Convert images to data URLs
    const dataUrls = files.map((file) => {
      const filePath = path.join(tempDir, file);
      const data = fs.readFileSync(filePath);
      const base64 = data.toString("base64");
      const dataUrl = `data:image/png;base64,${base64}`;

      // Clean up the file
      fs.unlinkSync(filePath);

      return dataUrl;
    });

    return dataUrls;
  } catch (error) {
    console.error("Error converting PDF to images:", error);
    throw new Error(`Failed to convert PDF to images: ${error.message}`);
  }
}

async function getPdfPageText(pdfPath: string): Promise<string[]> {
  const pdfExtract = new PDFExtract();
  const options: PDFExtractOptions = {}; /* see below */
  const data = await pdfExtract.extract(pdfPath, options);
  return data.pages.map((page) =>
    page.content.map((item) => item.str).join("\n")
  );
}

export { getPdfPageImages, getPdfPageText };
