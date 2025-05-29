import { QdrantClient } from '@qdrant/js-client-rest';

export class QdrantService {
    private client: QdrantClient;
    private generateEmbedding: (text: string) => Promise<number[]>;

    constructor(
        config: {
            url?: string;
            apiKey?: string;
            generateEmbedding: (text: string) => Promise<number[]>;
        }
    ) {
        const url = config.url || process.env.QDRANT_URL;
        const apiKey = config.apiKey || process.env.QDRANT_API_KEY;

        if (!url) {
            throw new Error('QDRANT_URL is not defined in environment variables or config');
        }

        this.client = new QdrantClient({ url, apiKey });
        this.generateEmbedding = config.generateEmbedding;
    }

    async createCollection(
        collectionName: string,
        vectorSize: number,
        options: {
            distance?: 'Cosine' | 'Euclid' | 'Dot';
            onDiskPayload?: boolean;
        } = {}
    ): Promise<void> {
        try {
            await this.client.createCollection(collectionName, {
                vectors: {
                    size: vectorSize,
                    distance: options.distance || 'Cosine'
                },
                on_disk_payload: options.onDiskPayload
            });
        } catch (error) {
            this.handleQdrantError(error, 'collection creation');
        }
    }

    async upsertPoints(
        collectionName: string,
        points: {
            id: string | number;
            text: string;
            metadata?: Record<string, any>;
        }[]
    ): Promise<void> {
        try {
            const pointsWithVectors = await Promise.all(
                points.map(async point => {
                    const vector = await this.generateEmbedding(point.text);
                    return {
                        id: point.id,
                        vector,
                        payload: point.metadata
                    };
                })
            );

            await this.client.upsert(collectionName, {
                points: pointsWithVectors
            });
        } catch (error) {
            this.handleQdrantError(error, 'points upsert');
        }
    }

    async search(
        collectionName: string,
        query: string,
        options: {
            limit?: number;
            scoreThreshold?: number;
            filter?: Record<string, any>;
        } = {}) {
        try {
            const queryEmbedding = await this.generateEmbedding(query);
            return await this.client.search(collectionName, {
                vector: queryEmbedding,
                limit: options.limit || 5,
                with_payload: true,
                score_threshold: options.scoreThreshold,
                filter: options.filter
            });
        } catch (error) {
            this.handleQdrantError(error, 'vector search');
        }
    }

    private handleQdrantError(error: unknown, context: string): never {
        if (error instanceof Error) {
            throw new Error(`Qdrant ${context} error: ${error.message}`);
        }
        throw new Error(`Unknown error occurred during ${context}`);
    }
}