import { CONFIG } from '../config'
import axios from 'axios'
import { OpenAIService } from '../services/OpenAIService'
import { OpenAIRoles } from '../enums/OpenAIRoles'
import dotenv from 'dotenv'
import { URL_ASSISTANT_PROMPT, VISION_ANALYSIS_PROMPT, WOMAN_DESCRIPTION_PROMPT } from './prompts'
import * as fs from 'fs'
import * as path from 'path'
import { CentralaService } from '../services/CentralaService'

dotenv.config();

const openai = new OpenAIService();
const centrala = new CentralaService();

const task = "photos";
let savedBaseUrl: string = '';
const finalFiles: string[] = [];

async function downloadImages(imageUrls: string[]): Promise<Buffer[]> {
    const imagesDir = path.join(process.cwd(), 'src', 'S04E01', 'images');
    const images: Buffer[] = [];
    
    if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir);
    }

    for (const url of imageUrls) {
        const filename = path.basename(url);
        const filepath = path.join(imagesDir, filename);
        
        try {
            if (fs.existsSync(filepath)) {
                console.log(`Reading existing image: ${filename}`);
                const imageBuffer = fs.readFileSync(filepath);
                images.push(imageBuffer);
            } else {
                console.log(`Downloading new image: ${filename}`);
                const imageResponse = await axios.get(url, { responseType: 'arraybuffer' });
                fs.writeFileSync(filepath, imageResponse.data);
                images.push(Buffer.from(imageResponse.data));
            }
        } catch (error) {
            console.error(`Failed to process image from ${url}:`, (error as Error).message);
        }
    }
    return images;
}

async function analyzeImage(image: Buffer): Promise<string> {
    const analysis = await openai.analyzeImage(image, { prompt: VISION_ANALYSIS_PROMPT });
    return analysis.trim();
}

async function getImageUrls(prompt: string): Promise<string[]> {
    const response = await openai.getCompletion([{role: OpenAIRoles.SYSTEM, content: URL_ASSISTANT_PROMPT}
        , {role: OpenAIRoles.ASSISTANT, content: prompt}]);
    
    const data = JSON.parse(response as string);
    if (data.baseUrl) {
        savedBaseUrl = data.baseUrl;
    }
    
    const baseUrl = data.baseUrl || savedBaseUrl;
    if (!baseUrl) {
        throw new Error('No base URL available');
    }
    
    return data.images.map((image: string) => `${baseUrl}${image}`);
}

async function analyzeImages(images: Buffer[], imageUrls: string[]): Promise<string[]> {
    const results: string[] = [];
    
    for (const [index, image] of images.entries()) {
        const filename = path.basename(imageUrls[index]);
        const result = await analyzeImage(image);
        console.log(`Analysis result: ${result} ${filename}`);
        
        if (result === 'NOTHING') {
            finalFiles.push(filename);
        } else {
        results.push(`${result} ${filename}`);
        }
    }
    return results;
}

async function analyzeFinalImages(): Promise<string> {
    const imagesDir = path.join(process.cwd(), 'src', 'S04E01', 'images');
    const imageBuffers: Buffer[] = [];
    const filenames: string[] = [];
    
    for (const filename of finalFiles) {
        const filepath = path.join(imagesDir, filename);
        if (fs.existsSync(filepath)) {
            const imageBuffer = fs.readFileSync(filepath);
            imageBuffers.push(imageBuffer);
            filenames.push(filename);
        }
    }
    
    if (imageBuffers.length === 0) {
        console.log('\nNo images found to analyze');
        return '';
    }
    
    // Analyze all images at once
    console.log('Filenames to openai' + filenames);
    const analysis = await openai.analyzeImage(imageBuffers, { prompt: WOMAN_DESCRIPTION_PROMPT });
    const descriptions = analysis.trim().split('\n').filter(desc => desc.trim());
    
    if (descriptions.length > 0) {
        console.log('\nDescriptions of Barbara:');
        descriptions.forEach(desc => console.log(desc));
        return descriptions.join('\n');
    } else {
        console.log('\nNo images of Barbara found in final images');
        return '';
    }
}

async function main() {
    let response = await centrala.callReport(task, "START");
    
    while (true) {
        const imageUrls = await getImageUrls(response);
        const images = await downloadImages(imageUrls);
        const results = await analyzeImages(images, imageUrls);
        
        console.log("Results needs reprocessing: " + results)
        if (results.length === 0) {
            console.log('No more images need processing');
            break;
        }
        
        const responses = await Promise.all(
            results.map(result => centrala.callReport(task, result))
        );
        
        response = responses.join('\n');
    }
    
    console.log('Files that need no processing:', finalFiles);
    const barbaraDescription = await analyzeFinalImages();
    
    if (barbaraDescription) {
        console.log('\nSending Barbara description to API...');
        const finalResponse = await centrala.callReport(task, barbaraDescription);
        console.log('\nAPI Response:', finalResponse);
    }
}

main().catch(console.error);