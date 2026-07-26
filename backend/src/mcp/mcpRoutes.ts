import { Router, Request, Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ctx } from '../routes';
import { createPolyglotMcpServer } from './createMcpServer';

const router = Router();

router.all('/', async (req: Request, res: Response) => {
  if (!req.userId) {
    res.status(401).json({
      success: false,
      message: 'User not authenticated',
    });
    return;
  }

  const server = createPolyglotMcpServer(ctx, req.userId);
  const transport = new StreamableHTTPServerTransport();

  try {
    // @ts-expect-error SDK Transport optional callbacks vs exactOptionalPropertyTypes
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('MCP request error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Internal MCP server error',
      });
    }
  } finally {
    await transport.close().catch(() => undefined);
    await server.close().catch(() => undefined);
  }
});

export default router;
