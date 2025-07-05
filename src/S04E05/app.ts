import { PdfProcessor } from './PdfProcessor';

const pdfProcessor = new PdfProcessor();

async function main() {
    const text = await pdfProcessor.process();
    console.log(text);
}

main();