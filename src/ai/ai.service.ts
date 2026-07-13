import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleGenAI, Type } from '@google/genai';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private ai: GoogleGenAI;

  constructor(private prisma: PrismaService) {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'dummy' });
  }

  async processChatStream(userId: string, history: any[], prompt: string, image: string | undefined, res: any) {
    if (!process.env.GEMINI_API_KEY) {
      res.write('data: ' + JSON.stringify({ text: "Please configure GEMINI_API_KEY in your backend .env file to use Deliverse AI." }) + '\n\n');
      res.end();
      return;
    }

    try {
      const tools = [{
        functionDeclarations: [
          {
            name: 'getOrderStatus',
            description: 'Get the status, driver info, and details of an order by its orderNumber.',
            parameters: {
              type: Type.OBJECT,
              properties: {
                orderNumber: { type: Type.STRING, description: 'The order number e.g. ORD-1234' }
              },
              required: ['orderNumber']
            }
          },
          {
            name: 'getWalletBalance',
            description: 'Get the current wallet balance of the user.'
          }
        ]
      }];

      const systemInstruction = `You are Deliverse AI, a sleek and futuristic logistics assistant.
Be friendly, professional, and concise. 
Use tools to look up real-time data for the user. If they ask about an order, extract the order number and use getOrderStatus. If they ask about money/balance, use getWalletBalance.`;

      // Format history for Gemini
      const contents = (history || []).map(msg => {
        const parts: any[] = [];
        if (msg.image) {
          const mimeType = msg.image.split(';')[0].split(':')[1];
          const base64Data = msg.image.split(',')[1];
          parts.push({ inlineData: { data: base64Data, mimeType } });
        }
        if (msg.text) {
          parts.push({ text: msg.text });
        }
        return {
          role: msg.isBot ? 'model' : 'user',
          parts
        };
      });

      // Add the latest prompt
      const newPromptParts: any[] = [];
      if (image) {
        const mimeType = image.split(';')[0].split(':')[1];
        const base64Data = image.split(',')[1];
        newPromptParts.push({ inlineData: { data: base64Data, mimeType } });
      }
      if (prompt) {
        newPromptParts.push({ text: prompt });
      }
      contents.push({ role: 'user', parts: newPromptParts });

      let stream = await this.ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents,
        config: {
          systemInstruction,
          tools,
        }
      });

      let responseText = '';
      let functionCallArgs: any = undefined;
      let functionCallName: string | undefined = undefined;

      for await (const chunk of stream) {
        if (chunk.functionCalls && chunk.functionCalls.length > 0) {
          functionCallName = chunk.functionCalls[0].name;
          functionCallArgs = chunk.functionCalls[0].args;
          break; // Stop streaming, we need to call a tool
        }
        if (chunk.text) {
          responseText += chunk.text;
          res.write('data: ' + JSON.stringify({ text: chunk.text }) + '\n\n');
        }
      }

      // If a tool was called, execute it and send the result back to Gemini
      if (functionCallName) {
        this.logger.log(`Tool called: ${functionCallName} with args: ${JSON.stringify(functionCallArgs)}`);
        res.write('data: ' + JSON.stringify({ text: `\n*[Checking ${functionCallName}...]*\n` }) + '\n\n');
        
        let toolResult = {};
        if (functionCallName === 'getOrderStatus') {
          const order = await this.prisma.order.findFirst({
             where: { orderNumber: { contains: (functionCallArgs?.orderNumber as string) || '', mode: 'insensitive' }, userId },
             include: { driver: true }
          });
          if (order) {
            toolResult = {
              status: order.status,
              pickupAddress: order.pickupAddress,
              dropoffAddress: order.dropoffAddress,
              price: order.quotedPrice,
              driverName: order.driver ? `${order.driver.firstName} ${order.driver.lastName}` : 'Not assigned yet',
              scheduledFor: order.scheduledFor
            };
          } else {
            toolResult = { error: 'Order not found for this user.' };
          }
        } else if (functionCallName === 'getWalletBalance') {
          const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
          toolResult = { balance: wallet?.balance || 0, escrowBalance: wallet?.escrowBalance || 0, currency: wallet?.currency || 'NGN' };
        }

        // Send the function response back to Gemini to continue the stream
        contents.push({
          role: 'model',
          parts: [{ functionCall: { name: functionCallName, args: functionCallArgs } }]
        });
        
        contents.push({
          role: 'user',
          parts: [{ functionResponse: { name: functionCallName, response: toolResult } }]
        });

        const secondStream = await this.ai.models.generateContentStream({
          model: 'gemini-2.5-flash',
          contents,
          config: { systemInstruction } // Disable tools for the follow-up so it just answers
        });

        for await (const chunk of secondStream) {
          if (chunk.text) {
            res.write('data: ' + JSON.stringify({ text: chunk.text }) + '\n\n');
          }
        }
      }

      res.write('data: [DONE]\n\n');
      res.end();

    } catch (error) {
      this.logger.error('Gemini Stream Error:', error);
      res.write('data: ' + JSON.stringify({ text: "\n\n**Error:** I encountered an issue while connecting to my core processors." }) + '\n\n');
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }
}
