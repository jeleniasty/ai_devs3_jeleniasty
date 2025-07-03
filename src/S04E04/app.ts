import express, { Request, Response } from 'express';
import { DroneInstructionService } from './DroneInstructionService';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

interface Instruction {
  instruction: string;
}

interface Description {
  description: string;
}

const droneInstructionService = new DroneInstructionService();

app.post('/webhook', async (req: Request<{}, {}, Instruction>, res: Response<Description>) => {
  const { instruction } = req.body;
  console.log('Received instruction:', instruction);

  const description = await droneInstructionService.generateDescription(instruction);
  console.log('Generated description:', description);
  
  res.json({ description });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

