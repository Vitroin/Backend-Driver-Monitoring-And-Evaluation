// pdfmake-rtl ships no TypeScript types, so it's loaded with require
interface PdfMakeRtl {
  addFonts(fonts: object): void;
  createPdf(docDefinition: object): { write(filePath: string): Promise<void> };
}
export const rtlPdfMake: PdfMakeRtl = require('pdfmake-rtl');

// The fonts named in defaultStyle: Roboto for English, Cairo for Arabic. pdfmake can't render a font it wasn't given.
rtlPdfMake.addFonts(require('pdfmake-rtl/fonts/Roboto'));
rtlPdfMake.addFonts(require('pdfmake-rtl/fonts/Cairo'));
