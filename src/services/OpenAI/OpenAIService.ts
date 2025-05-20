import dotenv from 'dotenv';
import OpenAI, { toFile } from 'openai';
import { OpenAIModel } from './OpenAIModel';
import fs from 'fs';
import path from 'path';

dotenv.config();

export interface OpenAIConfig {
    apiKey?: string;
}

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export class OpenAIService {
    private readonly openai: OpenAI;

    constructor(config: OpenAIConfig = {}) {
        const apiKey = config.apiKey || process.env.OPENAI_API_KEY;

        if (!apiKey) {
            throw new Error('OPENAI_API_KEY is not defined in environment variables or config');
        }

        this.openai = new OpenAI({ apiKey });
    }

    async getCompletion<T>(
        messages: ChatMessage[],
        options: {
            model?: string;
            temperature?: number;
            maxTokens?: number;
            parser?: (response: string) => T;
        } = {}
    ): Promise<T> {
        try {
            const completionOptions: any = {
                messages,
                model: options.model || OpenAIModel.GPT4O,
            };

            if ('temperature' in options) {
                completionOptions.temperature = options.temperature;
            }
            if ('maxTokens' in options) {
                completionOptions.max_tokens = options.maxTokens;
            }

            const completion = await this.openai.chat.completions.create(completionOptions);

            const response = completion.choices[0]?.message?.content;

            if (!response) {
                throw new Error('No response received from OpenAI');
            }

            if (options.parser) {
                return options.parser(response);
            }

            return response as unknown as T;
        } catch (error) {
            if (error instanceof OpenAI.APIError) {
                throw new Error(`OpenAI API Error: ${error.message}`);
            }
            if (error instanceof Error) {
                throw new Error(`Error: ${error.message}`);
            }
            throw new Error('Unknown error occurred');
        }
    }

    async transcribeAudio(
        input: Buffer | string,
        options: {
            model?: OpenAIModel;
            language?: string;
            responseFormat?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
            temperature?: number;
            prompt?: string;
        } = {}
    ): Promise<string> {
        try {
            let file;
            if (typeof input === 'string') {
                file = await toFile(fs.readFileSync(input), path.basename(input));
            } else {
                file = await toFile(input, 'speech.mp3');
            }
            
            const transcription = await this.openai.audio.transcriptions.create({
                file,
                model: options.model || OpenAIModel.WHISPER_1,
                language: options.language || 'en',
                response_format: options.responseFormat,
                temperature: options.temperature,
                prompt: options.prompt
            });

            return transcription.text;
        } catch (error) {
            if (error instanceof OpenAI.APIError) {
                throw new Error(`OpenAI API Error: ${error.message}`);
            }
            if (error instanceof Error) {
                throw new Error(`Error: ${error.message}`);
            }
            throw new Error('Unknown error occurred during transcription');
        }
    }
} 