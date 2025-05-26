import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import { OpenAIService } from './OpenAI/OpenAIService';
import axios from 'axios';
import { URL } from 'url';

interface ImageWithCaption {
    src: string;
    caption: string;
}

export class HtmlService {
    private turndownService = new TurndownService();
    private openaiService: OpenAIService;
    private baseUrl: string;

    constructor(baseUrl: string) {
        this.openaiService = new OpenAIService();
        this.baseUrl = baseUrl;
    }

    private getAbsoluteUrl(relativeUrl: string): string {
        try {
            return new URL(relativeUrl, this.baseUrl).toString();
        } catch (error) {
            console.error(`Failed to create absolute URL for ${relativeUrl}:`, error);
            return relativeUrl;
        }
    }

    async transformHtmlToMarkdown(html: string): Promise<string> {
        return this.turndownService.turndown(html);
    }

    async replaceImagesWithDescriptions(html: string): Promise<string> {
        const $ = cheerio.load(html);
        
        for (const element of $('img').get()) {
            const img = $(element);
            const src = img.attr('src');
            const figure = img.closest('figure');
            const caption = figure.find('figcaption').text().trim();
            
            if (src) {
                try {
                    const absoluteUrl = this.getAbsoluteUrl(src);
                    const response = await axios.get(absoluteUrl, { responseType: 'arraybuffer' });
                    const imageBuffer = Buffer.from(response.data);
                    
                    const systemPrompt = caption 
                        ? `Opisz szczegółowo to zdjęcie. Zdjęcie ma następujący podpis: "${caption}". Skup się na najważniejszych elementach i ich znaczeniu, uwzględniając kontekst podpisu. Odpowiedź musi być w języku polskim.`
                        : 'Opisz szczegółowo to zdjęcie. Skup się na najważniejszych elementach i ich znaczeniu. Odpowiedź musi być w języku polskim.';
                    
                    const description = await this.openaiService.analyzeImage(imageBuffer, {
                        prompt: systemPrompt
                    });
                    
                    img.replaceWith(`<p class="image-description">${description}</p>`);
                } catch (error) {
                    console.error(`Failed to process image ${src}:`, error);
                }
            }
        }

        return $.html();
    }

    async replaceAudioWithTranscriptions(html: string): Promise<string> {
        const $ = cheerio.load(html);
        
        for (const element of $('audio').get()) {
            const audio = $(element);
            const source = audio.find('source');
            const src = source.attr('src');
            
            if (src) {
                try {
                    const absoluteUrl = this.getAbsoluteUrl(src);
                    const response = await axios.get(absoluteUrl, { responseType: 'arraybuffer' });
                    const audioBuffer = Buffer.from(response.data);
                    
                    const transcription = await this.openaiService.transcribeAudio(audioBuffer, {
                        language: 'pl',
                        responseFormat: 'json'
                    });
                    
                    audio.replaceWith(`<p class="audio-transcription">${transcription}</p>`);
                } catch (error) {
                    console.error(`Failed to process audio ${src}:`, error);
                }
            }
        }

        return $.html();
    }
}