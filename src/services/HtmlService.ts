import * as cheerio from 'cheerio';
import TurndownService from 'turndown';

interface ImageWithCaption {
    src: string;
    caption: string;
}

export class HtmlService {
    private turndownService = new TurndownService();

    async transformHtmlToMarkdown(html: string): Promise<string> {
        return this.turndownService.turndown(html);
    }

    async extractImagesWithCaptions(html: string): Promise<ImageWithCaption[]> {
        const $ = cheerio.load(html);
        const images: ImageWithCaption[] = [];

        $('img').each((_, element) => {
            const img = $(element);
            const src = img.attr('src');
            const figure = img.closest('figure');
            const caption = figure.find('figcaption').text().trim();

            if (src) {
                images.push({
                    src,
                    caption
                });
            }
        });

        return images;
    }

    async extractAudioFromHtml(html: string): Promise<string[]> {
        const $ = cheerio.load(html);
        const audioSources: string[] = [];

        $('audio source').each((_, element) => {
            const src = $(element).attr('src');
            if (src) {
                audioSources.push(src);
            }
        });

        return audioSources;
    }
}