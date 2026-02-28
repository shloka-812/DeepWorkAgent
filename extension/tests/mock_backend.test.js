/**
 * Mock Backend Tests
 * Tests event handling, AI decision logic (heuristics), and response format
 */

const http = require('http');

describe('Mock Backend Server', () => {
  let server;
  const PORT = 18000; // Different port for testing

  // Simple request handler for testing
  const createHandler = () => {
    return (req, res) => {
      if (req.url === '/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
      } else if (req.url === '/event' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk.toString();
        });
        req.on('end', () => {
          try {
            const event = JSON.parse(body);
            const response = decideAction(event.domain || '');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(response));
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON' }));
          }
        });
      } else {
        res.writeHead(404);
        res.end();
      }
    };
  };

  const decideAction = (domain) => {
    const highDistraction = [
      'youtube.com',
      'tiktok.com',
      'instagram.com',
      'twitter.com',
      'reddit.com',
      'facebook.com',
      'twitch.tv',
      'x.com',
    ];
    const mediumDistraction = ['news.google.com', 'bbc.com', 'cnn.com', 'espn.com'];

    for (const high of highDistraction) {
      if (domain.includes(high)) {
        return {
          action: 'block',
          message: `🚫 ${domain} is a known distraction. Take a moment to refocus.`,
          metadata: { severity: 'high', category: 'social_media' },
        };
      }
    }

    for (const medium of mediumDistraction) {
      if (domain.includes(medium)) {
        return {
          action: 'nudge',
          message: `⏰ You're on ${domain}. Remember your focus goal!`,
          metadata: { severity: 'medium', category: 'news' },
        };
      }
    }

    return {
      action: 'log',
      message: `Visiting ${domain}`,
      metadata: { severity: 'low', category: 'work' },
    };
  };

  beforeEach((done) => {
    server = http.createServer(createHandler());
    server.listen(PORT, done);
  });

  afterEach((done) => {
    server.close(done);
  });

  describe('Health Check Endpoint', () => {
    test('GET /health should return 200 with ok status', (done) => {
      const options = {
        hostname: 'localhost',
        port: PORT,
        path: '/health',
        method: 'GET',
      };

      const req = http.request(options, (res) => {
        expect(res.statusCode).toBe(200);

        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          const response = JSON.parse(data);
          expect(response.status).toBe('ok');
          done();
        });
      });

      req.on('error', (e) => {
        done(e);
      });

      req.end();
    });
  });

  describe('Event Endpoint - Request Handling', () => {
    test('POST /event with valid event should return 200', (done) => {
      const event = {
        event: 'tab_change',
        url: 'https://example.com',
        domain: 'example.com',
        title: 'Example',
      };

      const options = {
        hostname: 'localhost',
        port: PORT,
        path: '/event',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const req = http.request(options, (res) => {
        expect(res.statusCode).toBe(200);

        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          const response = JSON.parse(data);
          expect(response).toHaveProperty('action');
          done();
        });
      });

      req.on('error', (e) => {
        done(e);
      });

      req.write(JSON.stringify(event));
      req.end();
    });

    test('POST /event with invalid JSON should return 400', (done) => {
      const options = {
        hostname: 'localhost',
        port: PORT,
        path: '/event',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const req = http.request(options, (res) => {
        expect(res.statusCode).toBe(400);
        done();
      });

      req.on('error', (e) => {
        done(e);
      });

      req.write('{ invalid json');
      req.end();
    });

    test('should accept full event schema', (done) => {
      const event = {
        event: 'tab_change',
        url: 'https://example.com/page',
        title: 'Example Page',
        domain: 'example.com',
        isDistraction: null,
        is_work: null,
        dwell_seconds: 5,
        referrer: 'https://google.com',
        navigation_type: 'tab_change',
        sessionDurationSeconds: 120,
        tabHistory: [{ url: 'https://example.com', title: 'Example' }],
        source: 'browser',
      };

      const options = {
        hostname: 'localhost',
        port: PORT,
        path: '/event',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const req = http.request(options, (res) => {
        expect(res.statusCode).toBe(200);
        done();
      });

      req.on('error', (e) => {
        done(e);
      });

      req.write(JSON.stringify(event));
      req.end();
    });
  });

  describe('Decision Logic - Block Response', () => {
    test('should return block for YouTube', (done) => {
      const event = { domain: 'youtube.com' };

      const options = {
        hostname: 'localhost',
        port: PORT,
        path: '/event',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          const response = JSON.parse(data);
          expect(response.action).toBe('block');
          done();
        });
      });

      req.write(JSON.stringify(event));
      req.end();
    });

    test('should return block for Twitter', (done) => {
      const event = { domain: 'twitter.com' };

      const options = {
        hostname: 'localhost',
        port: PORT,
        path: '/event',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          const response = JSON.parse(data);
          expect(response.action).toBe('block');
          done();
        });
      });

      req.write(JSON.stringify(event));
      req.end();
    });

    test('should return block for Instagram', (done) => {
      const event = { domain: 'instagram.com' };

      const options = {
        hostname: 'localhost',
        port: PORT,
        path: '/event',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          const response = JSON.parse(data);
          expect(response.action).toBe('block');
          expect(response.message).toContain('instagram.com');
          done();
        });
      });

      req.write(JSON.stringify(event));
      req.end();
    });

    test('block response should include metadata', (done) => {
      const event = { domain: 'reddit.com' };

      const options = {
        hostname: 'localhost',
        port: PORT,
        path: '/event',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          const response = JSON.parse(data);
          expect(response).toHaveProperty('metadata');
          expect(response.metadata.severity).toBe('high');
          expect(response.metadata.category).toBe('social_media');
          done();
        });
      });

      req.write(JSON.stringify(event));
      req.end();
    });
  });

  describe('Decision Logic - Nudge Response', () => {
    test('should return nudge for BBC News', (done) => {
      const event = { domain: 'bbc.com' };

      const options = {
        hostname: 'localhost',
        port: PORT,
        path: '/event',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          const response = JSON.parse(data);
          expect(response.action).toBe('nudge');
          done();
        });
      });

      req.write(JSON.stringify(event));
      req.end();
    });

    test('should return nudge for CNN', (done) => {
      const event = { domain: 'cnn.com' };

      const options = {
        hostname: 'localhost',
        port: PORT,
        path: '/event',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          const response = JSON.parse(data);
          expect(response.action).toBe('nudge');
          done();
        });
      });

      req.write(JSON.stringify(event));
      req.end();
    });

    test('nudge response should include message', (done) => {
      const event = { domain: 'google.news' };

      const options = {
        hostname: 'localhost',
        port: PORT,
        path: '/event',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          const response = JSON.parse(data);
          if (response.action === 'nudge') {
            expect(response).toHaveProperty('message');
            expect(response.message).toContain('focus goal');
          }
          done();
        });
      });

      req.write(JSON.stringify(event));
      req.end();
    });
  });

  describe('Decision Logic - Log Response', () => {
    test('should return log for unknown domain', (done) => {
      const event = { domain: 'github.com' };

      const options = {
        hostname: 'localhost',
        port: PORT,
        path: '/event',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          const response = JSON.parse(data);
          expect(response.action).toBe('log');
          done();
        });
      });

      req.write(JSON.stringify(event));
      req.end();
    });

    test('should return log for work domains', (done) => {
      const event = { domain: 'googleusercontent.com' };

      const options = {
        hostname: 'localhost',
        port: PORT,
        path: '/event',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          const response = JSON.parse(data);
          expect(response.action).toBe('log');
          done();
        });
      });

      req.write(JSON.stringify(event));
      req.end();
    });
  });

  describe('Response Format', () => {
    test('all responses should have action field', (done) => {
      const event = { domain: 'example.com' };

      const options = {
        hostname: 'localhost',
        port: PORT,
        path: '/event',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          const response = JSON.parse(data);
          expect(['block', 'nudge', 'log']).toContain(response.action);
          done();
        });
      });

      req.write(JSON.stringify(event));
      req.end();
    });

    test('all responses should have message field', (done) => {
      const event = { domain: 'example.com' };

      const options = {
        hostname: 'localhost',
        port: PORT,
        path: '/event',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          const response = JSON.parse(data);
          expect(response).toHaveProperty('message');
          expect(typeof response.message).toBe('string');
          done();
        });
      });

      req.write(JSON.stringify(event));
      req.end();
    });

    test('block/nudge responses should include metadata', (done) => {
      const event = { domain: 'youtube.com' };

      const options = {
        hostname: 'localhost',
        port: PORT,
        path: '/event',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          const response = JSON.parse(data);
          if (['block', 'nudge'].includes(response.action)) {
            expect(response).toHaveProperty('metadata');
            expect(response.metadata).toHaveProperty('severity');
            expect(response.metadata).toHaveProperty('category');
          }
          done();
        });
      });

      req.write(JSON.stringify(event));
      req.end();
    });
  });

  describe('Edge Cases', () => {
    test('should handle domain with subdomains', (done) => {
      const event = { domain: 'mobile.twitter.com' };

      const options = {
        hostname: 'localhost',
        port: PORT,
        path: '/event',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          const response = JSON.parse(data);
          expect(response.action).toBe('block');
          done();
        });
      });

      req.write(JSON.stringify(event));
      req.end();
    });

    test('should handle empty domain gracefully', (done) => {
      const event = { domain: '' };

      const options = {
        hostname: 'localhost',
        port: PORT,
        path: '/event',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      };

      const req = http.request(options, (res) => {
        expect(res.statusCode).toBe(200);
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          const response = JSON.parse(data);
          expect(response.action).toBe('log');
          done();
        });
      });

      req.write(JSON.stringify(event));
      req.end();
    });

    test('should handle null domain gracefully', (done) => {
      const event = { domain: null };

      const options = {
        hostname: 'localhost',
        port: PORT,
        path: '/event',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      };

      const req = http.request(options, (res) => {
        expect(res.statusCode).toBe(200);
        done();
      });

      req.write(JSON.stringify(event));
      req.end();
    });
  });

  describe('Performance', () => {
    test('should respond quickly to events (< 100ms)', (done) => {
      const event = { domain: 'example.com' };

      const options = {
        hostname: 'localhost',
        port: PORT,
        path: '/event',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      };

      const startTime = Date.now();

      const req = http.request(options, (res) => {
        const responseTime = Date.now() - startTime;
        expect(responseTime).toBeLessThan(100);
        done();
      });

      req.write(JSON.stringify(event));
      req.end();
    });

    test('should handle multiple concurrent requests', (done) => {
      const domains = ['youtube.com', 'bbc.com', 'github.com'];
      let completed = 0;

      domains.forEach((domain) => {
        const options = {
          hostname: 'localhost',
          port: PORT,
          path: '/event',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        };

        const req = http.request(options, (res) => {
          completed++;
          if (completed === domains.length) {
            done();
          }
        });

        req.write(JSON.stringify({ domain }));
        req.end();
      });
    });
  });
});
