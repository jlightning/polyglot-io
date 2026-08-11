import type { IncomingMessage, Server } from 'http';
import type { Duplex } from 'stream';
import { WebSocket, WebSocketServer } from 'ws';
import type { AgentSessionService } from './agentSessionService';

interface TerminalMessage {
  type: 'input' | 'resize';
  data?: string;
  cols?: number;
  rows?: number;
}

const TERMINAL_PATH = '/api/agent-sessions/terminal';
const MAX_INPUT_BYTES = 64 * 1024;

export class AgentTerminalGateway {
  private readonly webSocketServer = new WebSocketServer({ noServer: true });
  private readonly upgradeHandler: (
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer
  ) => void;

  constructor(
    private readonly server: Server,
    private readonly sessions: AgentSessionService
  ) {
    this.upgradeHandler = (request, socket, head) => {
      void this.handleUpgrade(request, socket, head);
    };
    this.server.on('upgrade', this.upgradeHandler);
  }

  close(): void {
    this.server.off('upgrade', this.upgradeHandler);
    this.webSocketServer.close();
  }

  private async handleUpgrade(
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer
  ): Promise<void> {
    const host = request.headers.host || 'localhost';
    const url = new URL(request.url || '/', `http://${host}`);
    if (url.pathname !== TERMINAL_PATH) {
      this.reject(socket, 404, 'Not Found');
      return;
    }
    if (!this.isAllowedOrigin(request.headers.origin)) {
      this.reject(socket, 403, 'Forbidden');
      return;
    }

    const token = url.searchParams.get('token');
    const grant = token ? this.sessions.claimTerminalToken(token) : undefined;
    if (!grant) {
      this.reject(socket, 401, 'Unauthorized');
      return;
    }
    if (!this.sessions.acquireTerminal(grant.sessionId)) {
      this.reject(socket, 409, 'Session already attached');
      return;
    }
    if (!(await this.sessions.runtime.hasSession(grant.tmuxSessionName))) {
      this.sessions.releaseTerminal(grant.sessionId);
      this.reject(socket, 410, 'Session is no longer running');
      return;
    }

    this.webSocketServer.handleUpgrade(request, socket, head, webSocket => {
      this.connectTerminal(webSocket, grant.sessionId, grant.tmuxSessionName);
    });
  }

  private connectTerminal(
    webSocket: WebSocket,
    sessionId: string,
    tmuxSessionName: string
  ): void {
    let terminal;
    try {
      terminal = this.sessions.runtime.attach(tmuxSessionName, 120, 32);
    } catch (error) {
      this.sessions.releaseTerminal(sessionId);
      webSocket.close(1011, 'Failed to attach terminal');
      console.error('agent_session.attach_failed', {
        sessionId,
        error: error instanceof Error ? error.message : 'unknown',
      });
      return;
    }

    console.info('agent_session.attach', { sessionId });
    const dataSubscription = terminal.onData(data => {
      if (webSocket.readyState === WebSocket.OPEN) webSocket.send(data);
    });
    const exitSubscription = terminal.onExit(() => {
      if (webSocket.readyState === WebSocket.OPEN) {
        webSocket.close(1000, 'Terminal detached');
      }
    });

    webSocket.on('message', raw => {
      const serialized = raw.toString();
      if (Buffer.byteLength(serialized) > MAX_INPUT_BYTES) {
        webSocket.close(1009, 'Message too large');
        return;
      }
      let message: TerminalMessage;
      try {
        message = JSON.parse(serialized) as TerminalMessage;
      } catch {
        webSocket.close(1003, 'Invalid terminal message');
        return;
      }
      if (message.type === 'input' && typeof message.data === 'string') {
        terminal.write(message.data);
        return;
      }
      if (
        message.type === 'resize' &&
        Number.isInteger(message.cols) &&
        Number.isInteger(message.rows)
      ) {
        const cols = Math.max(20, Math.min(300, message.cols!));
        const rows = Math.max(5, Math.min(120, message.rows!));
        terminal.resize(cols, rows);
        return;
      }
      webSocket.close(1003, 'Unsupported terminal message');
    });

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      dataSubscription.dispose();
      exitSubscription.dispose();
      try {
        terminal.kill();
      } catch {
        // The attach process may already have exited.
      }
      this.sessions.releaseTerminal(sessionId);
      console.info('agent_session.detach', { sessionId });
    };
    webSocket.once('close', cleanup);
    webSocket.once('error', cleanup);
  }

  private isAllowedOrigin(origin: string | undefined): boolean {
    if (!origin) return process.env['NODE_ENV'] !== 'production';
    const allowed = (process.env['CORS_ORIGIN'] || 'http://localhost:5173')
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
    return allowed.includes(origin);
  }

  private reject(socket: Duplex, status: number, message: string): void {
    socket.write(
      `HTTP/1.1 ${status} ${message}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`
    );
    socket.destroy();
  }
}
