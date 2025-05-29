import { ResourceService } from '../services/ResourceService';
import { CONFIG } from '../config';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { OpenAIRoles } from '../enums/OpenAIRoles';
import { OpenAIService } from '../services/OpenAIService';
import axios from 'axios';

const CURRENT_DIR = path.join(process.cwd(), 'src', 'S03E02');

const resourceService = new ResourceService(CURRENT_DIR);
const openai = new OpenAIService();

async function main(){

    const embedding = await openai.generateEmbedding('sialalalal kdfasfasdads');

    console.log(embedding.length);
}

main().catch(console.log);