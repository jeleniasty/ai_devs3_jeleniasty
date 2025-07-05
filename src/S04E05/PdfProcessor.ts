import { CONFIG } from '../config';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import pdfParse from 'pdf-parse';
import { fromPath } from 'pdf2pic';
import { OpenAIService } from '../services/OpenAIService';

export class PdfProcessor {
    private readonly openai: OpenAIService;
    private readonly baseDir: string;
    private readonly pdfFilename: string;
    private readonly textPath: string;

    constructor() {
        this.openai = new OpenAIService();
        this.baseDir = path.join(process.cwd(), 'src', 'S04E05', 'extracted');
        this.pdfFilename = 'notatnik-rafala.pdf';
        this.textPath = path.join(this.baseDir, 'text.txt')
    }

    async process(): Promise<string> {
        if (fs.existsSync(this.textPath)) {
            return this.textPath;
        }

        try {
            await this.downloadPdf();
            const pdfText = await this.parsePdf();
            
            const imagePath = await this.extractImage();
            const imageText = await this.extractTextFromImage(imagePath);
            
            const text = pdfText + '\n' + imageText;

            fs.writeFileSync(text, this.textPath);
            return this.textPath;
        } catch (error) {
            console.error('Error processing PDF:', error);
            throw error;
        }
    }

    private async downloadPdf(): Promise<void> {
        const url = CONFIG.NOTATNIK_RAFALA_URL;
        const pdfPath = path.join(this.baseDir, this.pdfFilename);

        if (!fs.existsSync(this.baseDir)) {
            fs.mkdirSync(this.baseDir, { recursive: true });
        }

        const response = await axios.get(url, { responseType: 'arraybuffer' });
        fs.writeFileSync(pdfPath, response.data);
        console.log('PDF downloaded:', pdfPath);
    }

    private async parsePdf(): Promise<string> {
        const pdfPath = path.join(this.baseDir, this.pdfFilename);
        const dataBuffer = fs.readFileSync(pdfPath);
        const data = await pdfParse(dataBuffer);
        return data.text;
    }

    private async extractImage(): Promise<string> {
        const pdfPath = path.join(this.baseDir, this.pdfFilename);
        const dataBuffer = fs.readFileSync(pdfPath);
        const data = await pdfParse(dataBuffer);
        const numPages = data.numpages;

        const converter = fromPath(pdfPath, {
            density: 300,
            saveFilename: 'image',
            savePath: this.baseDir,
            format: 'png',
            width: 1200,
            height: 1600
        });

        await converter(numPages);
        const imagePath = path.join(this.baseDir, `image.${numPages}.png`);
        console.log(`Extracted page ${numPages} as image:`, imagePath);
        return imagePath;
    }

    private async extractTextFromImage(imagePath: string): Promise<string> {
        const imageBuffer = fs.readFileSync(imagePath);
        const prompt = `Extract all text from image provided.
        Returned text should be in txt format in POLISH language.
        Your answer MUST ALWAYS contain only text in POLISH language from an image without any additional phrases.
        VERY IMPORTANT: Ignore first sentence: 'Zdjęcia odnalezionych fragmentów strony' and don't return it.
        WARNING: NEVER add additional text or special characters not relevant to the image like 'If you have more questions or need further assistance, feel free to ask!' or '---'`;
        const text = await this.openai.analyzeImage(imageBuffer, { prompt });
        return text;
    }
}