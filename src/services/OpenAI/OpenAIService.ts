import dotenv from 'dotenv';
import OpenAI from 'openai';
import { OpenAIModel } from './OpenAIModel';

dotenv.config();

export interface OpenAIConfig {
    apiKey?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
}

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export class OpenAIService {
    private readonly openai: OpenAI;
    private readonly defaultModel: string;

    constructor(config: OpenAIConfig = {}) {
        const apiKey = config.apiKey || process.env.OPENAI_API_KEY;

        if (!apiKey) {
            throw new Error('OPENAI_API_KEY is not defined in environment variables or config');
        }

        this.openai = new OpenAI({ apiKey });
        this.defaultModel = config.model || OpenAIModel.GPT4O;
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
                model: options.model || this.defaultModel,
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
} 