import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit } from '@/lib/rateLimit';

// Mock simples de NextRequest
function createMockRequest(ip: string = '127.0.0.1'): any {
  return {
    ip,
    headers: new Map(),
  };
}

describe('Rate Limiting', () => {
  it('permite primeira requisicao', async () => {
    const result = await checkRateLimit(createMockRequest(), 'general');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeGreaterThan(0);
  });

  it('permite multiplas requisicoes dentro do limite', async () => {
    const req = createMockRequest('1.2.3.4');
    for (let i = 0; i < 5; i++) {
      const result = await checkRateLimit(req, 'general');
      expect(result.allowed).toBe(true);
    }
  });

  it('bloqueia apos exceder limite', async () => {
    const req = createMockRequest('5.6.7.8');
    // Faz 70 requisicoes (limite = 60)
    for (let i = 0; i < 70; i++) {
      await checkRateLimit(req, 'general');
    }
    const result = await checkRateLimit(req, 'general');
    expect(result.allowed).toBe(false);
  });

  it('categorias diferentes tem limites diferentes', async () => {
    const req = createMockRequest('9.10.11.12');
    const general = await checkRateLimit(req, 'general');
    const ocr = await checkRateLimit(req, 'ocr');
    
    expect(general.limit).toBe(60);
    expect(ocr.limit).toBe(10);
  });

  it('IPs diferentes nao compartilham limites', async () => {
    const req1 = createMockRequest('ip-a');
    const req2 = createMockRequest('ip-b');
    
    // Esgota o limite do ip-a
    for (let i = 0; i < 70; i++) {
      await checkRateLimit(req1, 'general');
    }
    
    const blocked = await checkRateLimit(req1, 'general');
    const allowed = await checkRateLimit(req2, 'general');
    
    expect(blocked.allowed).toBe(false);
    expect(allowed.allowed).toBe(true);
  });
});
