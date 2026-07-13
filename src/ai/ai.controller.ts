import { Controller, Post, Body, Req, Res, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { Request, Response } from 'express';

@Controller('business/ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat/stream')
  async streamChat(
    @Req() req: any,
    @Res() res: Response,
    @Body('history') history: any[],
    @Body('prompt') prompt: string,
    @Body('image') image?: string
  ) {
    const userId = req.user.id; // From JwtAuthGuard
    
    // Set up Server-Sent Events headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // flush the headers to establish SSE

    await this.aiService.processChatStream(userId, history, prompt, image, res);
  }
}
