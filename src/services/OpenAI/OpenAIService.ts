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
            this.handleOpenAIError(error, 'completion');
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
            this.handleOpenAIError(error, 'transcription');
        }
    }

    async analyzeImage(
        input: Buffer | string,
        options: {
            model?: OpenAIModel;
            maxTokens?: number;
            temperature?: number;
            prompt?: string;
        } = {}
    ): Promise<string> {
        try {
            const imageInput = typeof input === 'string' 
                ? input
                : `data:image/jpeg;base64,${input.toString('base64')}`;

            const response = await this.openai.chat.completions.create({
                model: options.model || OpenAIModel.GPT4O,
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: options.prompt || 'What\'s in this image?' },
                            { type: 'image_url', image_url: { url: imageInput } }
                        ]
                    }
                ],
                max_tokens: options.maxTokens,
                temperature: options.temperature
            });

            return response.choices[0].message.content || '';
        } catch (error) {
            this.handleOpenAIError(error, 'image analysis');
        }
    }

    private handleOpenAIError(error: unknown, context: string): never {
        if (error instanceof OpenAI.APIError) {
            throw new Error(`OpenAI API Error: ${error.message}`);
        }
        if (error instanceof Error) {
            throw new Error(`Error: ${error.message}`);
        }
        throw new Error(`Unknown error occurred during ${context}`);
    }
} 