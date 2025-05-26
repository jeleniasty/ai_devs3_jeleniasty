import { CONFIG } from '../config';
import axios from 'axios';
import { OpenAIService } from '../services/OpenAI/OpenAIService';
import { HtmlService } from '../services/HtmlService';

const articleUrl = CONFIG.ARCHIVE_DATA_URL;
const questionsUrl = CONFIG.QUESTIONS_URL;

const htmlService = new HtmlService();
const openai = new OpenAIService();

async function main() {
    const articleResponse = await axios.get(articleUrl);
    const articleHtml = articleResponse.data;

    const images = await htmlService.extractImagesWithCaptions(articleHtml);
    const articleText = await htmlService.transformHtmlToMarkdown(articleHtml);

    interface ImageWithCaption {
        src: string;
        caption: string;
    }
}

main();