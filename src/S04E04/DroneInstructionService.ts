import { OpenAIModel } from '../enums/OpenAIModel';
import { OpenAIRoles } from '../enums/OpenAIRoles';
import { OpenAIService } from '../services/OpenAIService';
import { readFileSync } from 'fs';
import { join } from 'path';

export class DroneInstructionService {

  private openai: OpenAIService;

  constructor() {
    this.openai = new OpenAIService();
  }

  public async generateDescription(instruction: string): Promise<string> {
    return await this.askOpenAIForDescription(instruction);
  }

  private async askOpenAIForDescription(instruction: string): Promise<string> {
    const promptPath = join(process.cwd(), 'src', 'S04E04', 'systemPrompt.txt');
    const prompt = readFileSync(promptPath, 'utf-8').replace('{{instruction}}', instruction);

    try {
      const description = await this.openai.getCompletion<string>([
        { role: OpenAIRoles.USER, content: prompt }
      ], {model: OpenAIModel.GPT41_MINI});

      try {
        const parsed = JSON.parse(description);
        return parsed.description;
      } catch (e) {
        throw new Error('Invalid JSON returned from OpenAI: ' + description);
      }
    } catch (error) {
      console.error('OpenAI completion error:', error);
      return 'Unable to generate description.';
    }
  }
}
