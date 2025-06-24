import dotenv from 'dotenv';
import OpenAI, { toFile } from 'openai';
import { OpenAIModel } from '../enums/OpenAIModel';
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
        input: Buffer | string | (Buffer | string)[],
        options: {
            model?: OpenAIModel;
            maxTokens?: number;
            temperature?: number;
            prompt?: string;
        } = {}
    ): Promise<string> {
        try {
            const images = Array.isArray(input) ? input : [input];
            const messages = [
                {
                    role: 'user',
                    content: options.prompt || 'What\'s in these images?'
                }
            ];

            for (const img of images) {
                const imageUrl = typeof img === 'string' 
                    ? img 
                    : `data:image/jpeg;base64,${img.toString('base64')}`;
                
                messages.push({
                    role: 'user',
                    content: [
                        { 
                            type: 'image_url',
                            image_url: { url: imageUrl }
                        }
                    ] as any
                });
            }

            const response = await this.openai.chat.completions.create({
                model: options.model || OpenAIModel.GPT4O,
                messages: messages as any,
                max_tokens: options.maxTokens,
                temperature: options.temperature
            });

            return response.choices[0].message.content || '';
        } catch (error) {
            this.handleOpenAIError(error, 'image analysis');
        }
    }

    async generateImage(
        prompt: string,
        options: {
            model?: OpenAIModel;
            size?: '256x256' | '512x512' | '1024x1024' | '1024x1792' | '1792x1024';
            quality?: 'standard' | 'hd';
            style?: 'vivid' | 'natural';
            n?: number;
        } = {}
    ): Promise<string[]> {
        try {
            const response = await this.openai.images.generate({
                prompt,
                model: options.model || OpenAIModel.DALL_E_3,
                n: options.n,
                size: options.size,
                quality: options.quality,
                style: options.style,
            });

            if (!response.data) {
                throw new Error('No image data received from OpenAI');
            }

            return response.data.map(img => img.url || '');
        } catch (error) {
            this.handleOpenAIError(error, 'image generation');
        }
    }

    async generateEmbedding(
        input: string,
        options: {
            model?: OpenAIModel;
            encodingFormat?: 'float' | 'base64';
            user?: string;
        } = {}
    ): Promise<number[]> {
        try {
            const response = await this.openai.embeddings.create({
                model: options.model || OpenAIModel.TEXT_EMBEDDING_3_LARGE,
                input: input,
                user: options.user,
                encoding_format: options.encodingFormat
            });

            return response.data[0].embedding;
        } catch (error) {
            this.handleOpenAIError(error, 'embedding generation');
        }
    }

    async fineTune(fileDir: string): Promise<string> {
        try {
            const fileStream = fs.createReadStream(fileDir);

            const uploadedFile = await this.openai.files.create({
                file: fileStream as any,
                purpose: "fine-tune"
            });

            if (!uploadedFile || !uploadedFile.id) {
                throw new Error('File upload failed');
            }

            const fineTuneJob = await this.openai.fineTuning.jobs.create({
                training_file: uploadedFile.id,
                model: OpenAIModel.GPT4O_MINI_2024_07_18
            });

            if (!fineTuneJob || !fineTuneJob.id) {
                throw new Error('Fine-tune job creation failed');
            }

            return fineTuneJob.id;
        } catch (error) {
            this.handleOpenAIError(error, 'fine-tuning');
        }
    }

    async checkFineTuneStatus(jobId: string): Promise<any> {
        try {
            const job = await this.openai.fineTuning.jobs.retrieve(jobId);
            return job;
        } catch (error) {
            this.handleOpenAIError(error, 'check fine-tune status');
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