import { OpenAIRoles } from '../enums/OpenAIRoles';
import { OpenAIService } from '../services/OpenAIService';

export class DroneInstructionService {

  private openai: OpenAIService;

  constructor() {
    this.openai = new OpenAIService();
  }

  public async generateDescription(instruction: string): Promise<string> {
    return await this.askOpenAIForDescription(instruction);
  }

  private async askOpenAIForDescription(instruction: string): Promise<string> {
    const systemPrompt = 'Jesteś asystentem opisującym miejsca na podstawie instrukcji.';

    try {
      const description = await this.openai.getCompletion<string>([
        { role: OpenAIRoles.SYSTEM, content: systemPrompt },
        { role: OpenAIRoles.USER, content: instruction }
      ]);

      return description;
    } catch (error) {
      console.error('OpenAI completion error:', error);
      
      return 'Unable to generate description.';
    }
  }
}
