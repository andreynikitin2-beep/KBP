// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pdfMakeInstance: any = null;

async function getPdfMake() {
  if (pdfMakeInstance) return pdfMakeInstance;
  const [pdfMakeModule, pdfFontsModule] = await Promise.all([
    // @ts-ignore — pdfmake build files have no bundled typings
    import("pdfmake/build/pdfmake"),
    // @ts-ignore
    import("pdfmake/build/vfs_fonts"),
  ]);
  const pdfMake = pdfMakeModule.default;
  const vfs = pdfFontsModule.default;

  // pdfmake 0.3.x uses virtualfs instead of vfs
  pdfMake.virtualfs = vfs;

  // Explicitly declare Roboto font files (included in vfs_fonts)
  pdfMake.fonts = {
    Roboto: {
      normal: "Roboto-Regular.ttf",
      bold: "Roboto-Medium.ttf",
      italics: "Roboto-Italic.ttf",
      bolditalics: "Roboto-MediumItalic.ttf",
    },
  };

  pdfMakeInstance = pdfMake;
  return pdfMake;
}

export async function generatePdfFromText(text: string, title: string): Promise<string> {
  const pdfMake = await getPdfMake();

  const lines = text.split("\n");
  const content: any[] = [];

  if (title) {
    content.push({ text: title, fontSize: 16, bold: true, margin: [0, 0, 0, 14] });
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      content.push({ text: " ", fontSize: 11, margin: [0, 2, 0, 2] });
    } else {
      content.push({ text: trimmed, fontSize: 11, margin: [0, 0, 0, 3] });
    }
  }

  const docDefinition: any = {
    content,
    defaultStyle: { font: "Roboto", fontSize: 11, lineHeight: 1.4 },
    pageMargins: [56, 56, 56, 56],
    info: { title },
  };

  return new Promise((resolve, reject) => {
    try {
      pdfMake.createPdf(docDefinition).getBase64((base64: string) => resolve(base64));
    } catch (e) {
      reject(e);
    }
  });
}

export async function generatePdfBlobUrl(text: string, title: string): Promise<string> {
  const base64 = await generatePdfFromText(text, title);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: "application/pdf" });
  return URL.createObjectURL(blob);
}
