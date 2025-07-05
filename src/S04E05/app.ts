import { CONFIG } from '../config';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import pdfParse from 'pdf-parse';
import { fromPath } from 'pdf2pic';
import { OpenAIService } from '../services/OpenAIService';

const openai = new OpenAIService();

async function main() {
    const text = await prepareText();
    console.log('Final extracted text:', text);
}

async function prepareText(): Promise<string> {
    const pdf = await downloadPdf();
    const pdfText = await parsePdf();
    console.log('Extracted PDF text:', pdfText);
    
    const imagePath = await extractImage();
    const imageText = await extractTextFromImage(imagePath);
    
    return imageText;
}

async function downloadPdf() {
    const url = CONFIG.NOTATNIK_RAFALA_URL;
    const pdfDir = path.join(process.cwd(), 'src', 'S04E05');
    const pdfPath = path.join(pdfDir, 'notatnik-rafala.pdf');

    const response = await axios.get(url, { responseType: 'arraybuffer' });
    fs.writeFileSync(pdfPath, response.data);
    console.log('PDF downloaded: ' + pdfPath);
}

async function parsePdf(): Promise<string> {
    const pdfPath = path.join(process.cwd(), 'src', 'S04E05', 'notatnik-rafala.pdf');
    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdfParse(dataBuffer);
    return data.text;
}

async function extractImage(): Promise<string> {
    const pdfPath = path.join(process.cwd(), 'src', 'S04E05', 'notatnik-rafala.pdf');
    const outputDir = path.join(process.cwd(), 'src', 'S04E05');
    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdfParse(dataBuffer);
    const numPages = data.numpages;

    const converter = fromPath(pdfPath, {
        density: 300,
        saveFilename: 'page-19-image',
        savePath: outputDir,
        format: 'png',
        width: 1200,
        height: 1600
    });

    await converter(numPages);
    const imagePath = path.join(outputDir, 'page-19-image.png');
    console.log(`Extracted page ${numPages} as image to ${imagePath}`);
    return imagePath;
}

async function extractTextFromImage(imagePath: string): Promise<string> {
    const imageBuffer = fs.readFileSync(imagePath);
    const prompt = "Extract all text from this image and describe any other visual elements you see (images, diagrams, charts, symbols, etc.). Provide a comprehensive description of everything visible in the image.";
    const text = await openai.analyzeImage(imageBuffer, { prompt });
    return text;
}

main();
