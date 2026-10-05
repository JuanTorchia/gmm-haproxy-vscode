import {
  DETECTION_LINE_LIMIT,
  isDetectionCandidate,
  looksLikeHaproxyConfig,
} from '../../client/src/haproxyDetection';

describe('looksLikeHaproxyConfig', () => {
  it('detects a real HAProxy config', () => {
    const text = 'global\n    maxconn 4096\n\ndefaults\n    mode http\n\nbackend web\n    server s1 10.0.0.1:80 check\n';
    expect(looksLikeHaproxyConfig(text)).toBe(true);
  });

  it('detects a named section with a trailing comment', () => {
    expect(looksLikeHaproxyConfig('frontend fe_http # public\n    bind :80\n')).toBe(true);
  });

  it('detects every documented section keyword', () => {
    for (const kw of ['global', 'defaults', 'frontend', 'backend', 'listen', 'userlist', 'peers',
      'resolvers', 'mailers', 'ring', 'log-forward', 'program', 'http-errors', 'cache', 'acme']) {
      expect(looksLikeHaproxyConfig(`${kw} x\n`)).toBe(true);
    }
  });

  it('handles CRLF line endings', () => {
    expect(looksLikeHaproxyConfig('# lb\r\nfrontend fe\r\n    bind :80\r\n')).toBe(true);
  });

  it('ignores an nginx config', () => {
    const nginx = 'upstream backend {\n    server 10.0.0.1;\n}\nserver {\n    listen 80;\n    location / { proxy_pass http://backend; }\n}\n';
    expect(looksLikeHaproxyConfig(nginx)).toBe(false);
  });

  it('ignores a Samba config with a [global] section', () => {
    expect(looksLikeHaproxyConfig('[global]\n   workgroup = WORKGROUP\n')).toBe(false);
  });

  it('ignores a Python setup.cfg', () => {
    expect(looksLikeHaproxyConfig('[metadata]\nname = demo\n\n[options]\npackages = find:\n')).toBe(false);
  });

  it('ignores keywords that are only a prefix of a word', () => {
    expect(looksLikeHaproxyConfig('globals = 1\nbackends=2\n')).toBe(false);
  });

  it('ignores indented section headers', () => {
    expect(looksLikeHaproxyConfig('    frontend fe\n        bind :80\n')).toBe(false);
  });

  it('only reads the first DETECTION_LINE_LIMIT lines', () => {
    const filler = '# comment\n'.repeat(DETECTION_LINE_LIMIT);
    expect(looksLikeHaproxyConfig(`${filler}frontend late\n`)).toBe(false);
  });
});

describe('isDetectionCandidate', () => {
  const base = { languageId: 'properties', fileName: '/etc/lb/lb.cfg', uriScheme: 'file' };

  it('accepts .cfg and .conf files opened as plaintext, ini or properties', () => {
    for (const languageId of ['plaintext', 'ini', 'properties']) {
      expect(isDetectionCandidate({ ...base, languageId })).toBe(true);
      expect(isDetectionCandidate({ ...base, languageId, fileName: '/etc/lb/lb.conf' })).toBe(true);
    }
  });

  it('accepts upper-case extensions', () => {
    expect(isDetectionCandidate({ ...base, fileName: '/etc/LB.CFG' })).toBe(true);
  });

  it('never overrides a language another extension assigned', () => {
    expect(isDetectionCandidate({ ...base, languageId: 'nginx' })).toBe(false);
    expect(isDetectionCandidate({ ...base, languageId: 'haproxy' })).toBe(false);
  });

  it('ignores other extensions and non-file schemes', () => {
    expect(isDetectionCandidate({ ...base, fileName: '/etc/lb/lb.txt' })).toBe(false);
    expect(isDetectionCandidate({ ...base, uriScheme: 'untitled' })).toBe(false);
    expect(isDetectionCandidate({ ...base, uriScheme: 'git' })).toBe(false);
  });
});
