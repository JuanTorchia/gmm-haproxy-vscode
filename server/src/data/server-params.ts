/**
 * HAProxy server and default-server parameter definitions.
 *
 * Source: HAProxy 3.1 configuration.txt section 5.2
 * (Server and default-server options).
 *
 * These parameters appear on "server" and "default-server" lines:
 *   server web1 10.0.0.1:80 check inter 2s rise 2 fall 3
 *   default-server inter 2s rise 2 fall 3
 */

export interface ServerParamDef {
  readonly name: string;
  readonly signature: string;
  readonly description: string;
  readonly since: string;
  readonly deprecated?: string;
  readonly removed?: string;
}

export const SERVER_PARAMS: ServerParamDef[] = [
  // ── Address / port ────────────────────────────────────────────────────────

  {
    name: 'addr',
    signature: '<ipv4|ipv6>',
    description: 'Use a different IP address for health checks or agent checks.',
    since: '2.4',
  },
  {
    name: 'port',
    signature: '<port>',
    description: 'Set the TCP port used for health checks (overrides the server port).',
    since: '2.4',
  },
  {
    name: 'namespace',
    signature: '<name>',
    description: 'Set the Linux network namespace for this server connection.',
    since: '2.4',
  },
  {
    name: 'redir',
    signature: '<prefix>',
    description: 'Return a redirect to <prefix> instead of forwarding to this server.',
    since: '2.4',
  },
  {
    name: 'shard',
    signature: '<shard>',
    description: 'Assign this server to a specific shard for consistent hashing.',
    since: '2.8',
  },

  // ── Health checks ─────────────────────────────────────────────────────────

  {
    name: 'check',
    signature: '',
    description: 'Enable health checks on this server.',
    since: '2.4',
  },
  {
    name: 'no-check',
    signature: '',
    description: 'Disable health checks (overrides inherited check setting).',
    since: '2.4',
  },
  {
    name: 'check-ssl',
    signature: '',
    description: 'Force SSL/TLS for health checks regardless of normal traffic.',
    since: '2.4',
  },
  {
    name: 'no-check-ssl',
    signature: '',
    description: 'Disable SSL for health checks.',
    since: '2.4',
  },
  {
    name: 'check-send-proxy',
    signature: '',
    description: 'Send a PROXY protocol header with health check connections.',
    since: '2.4',
  },
  {
    name: 'check-alpn',
    signature: '<protocols>',
    description: 'Set the ALPN protocol list for health check connections.',
    since: '2.4',
  },
  {
    name: 'check-proto',
    signature: '<name>',
    description: 'Force a specific multiplexer protocol for health check connections.',
    since: '2.4',
  },
  {
    name: 'check-sni',
    signature: '<sni>',
    description: 'Set the SNI hostname for SSL health checks.',
    since: '2.4',
  },
  {
    name: 'check-via-socks4',
    signature: '',
    description: 'Route health checks through an upstream SOCKS4 proxy.',
    since: '2.4',
  },
  {
    name: 'inter',
    signature: '<delay>',
    description: 'Set the interval between health checks (default: 2000ms).',
    since: '2.4',
  },
  {
    name: 'fastinter',
    signature: '<delay>',
    description: 'Set the interval for transitional-state health checks.',
    since: '2.4',
  },
  {
    name: 'downinter',
    signature: '<delay>',
    description: 'Set the health check interval when the server is fully down.',
    since: '2.4',
  },
  {
    name: 'rise',
    signature: '<count>',
    description: 'Number of consecutive successful checks to consider server UP (default: 2).',
    since: '2.4',
  },
  {
    name: 'fall',
    signature: '<count>',
    description: 'Number of consecutive failed checks to consider server DOWN (default: 3).',
    since: '2.4',
  },
  {
    name: 'error-limit',
    signature: '<count>',
    description: 'Number of consecutive errors before triggering the on-error action.',
    since: '2.4',
  },
  {
    name: 'observe',
    signature: '<mode>',
    description: 'Enable health observing based on traffic (layers4, all).',
    since: '2.4',
  },
  {
    name: 'init-state',
    signature: '{ fully-up | up | down | fully-down }',
    description: 'Set the initial operational state of the server.',
    since: '2.8',
  },

  // ── Agent checks ──────────────────────────────────────────────────────────

  {
    name: 'agent-check',
    signature: '',
    description: 'Enable auxiliary agent health checks.',
    since: '2.4',
  },
  {
    name: 'no-agent-check',
    signature: '',
    description: 'Disable agent health checks.',
    since: '2.4',
  },
  {
    name: 'agent-port',
    signature: '<port>',
    description: 'Set the TCP port for agent checks.',
    since: '2.4',
  },
  {
    name: 'agent-addr',
    signature: '<addr>',
    description: 'Set the address for agent checks.',
    since: '2.4',
  },
  {
    name: 'agent-inter',
    signature: '<delay>',
    description: 'Set the interval between agent checks (default: 2000ms).',
    since: '2.4',
  },
  {
    name: 'agent-send',
    signature: '<string>',
    description: 'String to send to the agent upon connection.',
    since: '2.4',
  },

  // ── Load balancing weights ─────────────────────────────────────────────────

  {
    name: 'weight',
    signature: '<weight>',
    description: 'Set the server weight for load balancing (1-256, default: 1).',
    since: '2.4',
  },
  {
    name: 'minconn',
    signature: '<maxconn>',
    description: 'Enable dynamic max connections; set the minimum number.',
    since: '2.4',
  },
  {
    name: 'maxconn',
    signature: '<maxconn>',
    description: 'Set the maximum number of concurrent connections to this server.',
    since: '2.4',
  },
  {
    name: 'maxqueue',
    signature: '<maxqueue>',
    description: 'Set the maximum number of requests queued for this server.',
    since: '2.4',
  },
  {
    name: 'slowstart',
    signature: '<start_time_in_ms>',
    description: 'Ramp up a recovered server slowly over the given time window.',
    since: '2.4',
  },

  // ── State / backup ────────────────────────────────────────────────────────

  {
    name: 'backup',
    signature: '',
    description: 'Mark as a backup server (used only when all non-backup servers are down).',
    since: '2.4',
  },
  {
    name: 'no-backup',
    signature: '',
    description: 'Cancel any inherited backup designation.',
    since: '2.4',
  },
  {
    name: 'disabled',
    signature: '',
    description: 'Start the server in disabled (maintenance) state.',
    since: '2.4',
  },
  {
    name: 'enabled',
    signature: '',
    description: 'Reset any inherited disabled setting.',
    since: '2.4',
  },
  {
    name: 'non-stick',
    signature: '',
    description: 'Do not use this server for stick-table persistence.',
    since: '2.4',
  },
  {
    name: 'track',
    signature: '[<backend>/]<server>',
    description: 'Track another server\'s health state instead of running own checks.',
    since: '2.4',
  },

  // ── Connection settings ───────────────────────────────────────────────────

  {
    name: 'send-proxy',
    signature: '',
    description: 'Send a PROXY protocol v1 header to the server.',
    since: '2.4',
  },
  {
    name: 'no-send-proxy',
    signature: '',
    description: 'Disable PROXY protocol (overrides inherited setting).',
    since: '2.4',
  },
  {
    name: 'send-proxy-v2',
    signature: '',
    description: 'Send a PROXY protocol v2 binary header to the server.',
    since: '2.4',
  },
  {
    name: 'no-send-proxy-v2',
    signature: '',
    description: 'Disable PROXY protocol v2.',
    since: '2.4',
  },
  {
    name: 'send-proxy-v2-ssl',
    signature: '',
    description: 'Send PROXY protocol v2 with SSL info extension.',
    since: '2.4',
  },
  {
    name: 'no-send-proxy-v2-ssl',
    signature: '',
    description: 'Disable PROXY protocol v2 with SSL info extension.',
    since: '2.4',
  },
  {
    name: 'send-proxy-v2-ssl-cn',
    signature: '',
    description: 'Send PROXY protocol v2 with SSL CN extension.',
    since: '2.4',
  },
  {
    name: 'no-send-proxy-v2-ssl-cn',
    signature: '',
    description: 'Disable PROXY protocol v2 with SSL CN extension.',
    since: '2.4',
  },
  {
    name: 'proxy-v2-options',
    signature: '<option>[,<option>]*',
    description: 'Enable specific PROXY v2 TLV extensions (ssl, cert-cn, ssl-cipher, etc.).',
    since: '2.4',
  },
  {
    name: 'tfo',
    signature: '',
    description: 'Enable TCP Fast Open on connections to this server.',
    since: '2.4',
  },
  {
    name: 'no-tfo',
    signature: '',
    description: 'Disable TCP Fast Open.',
    since: '2.4',
  },
  {
    name: 'tcp-ut',
    signature: '<delay>',
    description: 'Set a TCP user timeout on connections to this server.',
    since: '2.4',
  },
  {
    name: 'proto',
    signature: '<name>',
    description: 'Force a specific multiplexer protocol for connections to this server.',
    since: '2.4',
  },

  // ── Connection pool ───────────────────────────────────────────────────────

  {
    name: 'pool-max-conn',
    signature: '<max>',
    description: 'Maximum number of idle connections kept in the pool.',
    since: '2.4',
  },
  {
    name: 'pool-low-conn',
    signature: '<max>',
    description: 'Minimum number of idle connections to maintain in the pool.',
    since: '2.4',
  },
  {
    name: 'pool-conn-name',
    signature: '<expr>',
    description: 'Expression used to name connections for pool matching (H2 multiplexing).',
    since: '2.4',
  },
  {
    name: 'pool-purge-delay',
    signature: '<delay>',
    description: 'Delay before closing idle connections above pool-low-conn.',
    since: '2.4',
  },
  {
    name: 'max-reuse',
    signature: '<count>',
    description: 'Maximum number of times a connection can be reused (-1 = unlimited).',
    since: '2.4',
  },

  // ── SSL/TLS ───────────────────────────────────────────────────────────────

  {
    name: 'ssl',
    signature: '',
    description: 'Enable SSL/TLS for connections to this server.',
    since: '2.4',
  },
  {
    name: 'no-ssl',
    signature: '',
    description: 'Disable SSL for connections to this server.',
    since: '2.4',
  },
  {
    name: 'ssl-reuse',
    signature: '',
    description: 'Allow SSL session reuse (default).',
    since: '2.4',
  },
  {
    name: 'no-ssl-reuse',
    signature: '',
    description: 'Disable SSL session reuse.',
    since: '2.4',
  },
  {
    name: 'tls-tickets',
    signature: '',
    description: 'Enable TLS session tickets.',
    since: '2.4',
  },
  {
    name: 'no-tls-tickets',
    signature: '',
    description: 'Disable TLS session tickets.',
    since: '2.4',
  },
  {
    name: 'sni',
    signature: '<expression>',
    description: 'SNI expression to use for SSL/TLS connections to this server.',
    since: '2.4',
  },
  {
    name: 'sni-auto',
    signature: '',
    description: 'Explicitly enable automatic SNI from the Host header (default since 3.3).',
    since: '3.3',
  },
  {
    name: 'no-sni-auto',
    signature: '',
    description: 'Disable automatic SNI from the Host header.',
    since: '3.3',
  },
  {
    name: 'check-sni-auto',
    signature: '',
    description: 'Explicitly enable automatic SNI in health checks (default since 3.3).',
    since: '3.3',
  },
  {
    name: 'no-check-sni-auto',
    signature: '',
    description: 'Disable automatic SNI in health checks.',
    since: '3.3',
  },
  {
    name: 'alpn',
    signature: '<protocols>',
    description: 'ALPN protocol list for TLS connections (e.g. h2,http/1.1).',
    since: '2.4',
  },
  {
    name: 'npn',
    signature: '<protocols>',
    description: 'NPN protocol list (legacy, prefer alpn).',
    since: '2.4',
    deprecated: '2.4',
  },
  {
    name: 'ws',
    signature: '{ auto | h1 | h2 }',
    description: 'Override the ALPN used for WebSocket connections.',
    since: '2.6',
  },
  {
    name: 'crt',
    signature: '<cert>',
    description: 'Client certificate PEM file to present to the server.',
    since: '2.4',
  },
  {
    name: 'ca-file',
    signature: '<cafile>',
    description: 'CA certificate file to verify the server certificate.',
    since: '2.4',
  },
  {
    name: 'crl-file',
    signature: '<crlfile>',
    description: 'Certificate revocation list file.',
    since: '2.4',
  },
  {
    name: 'verify',
    signature: '{ none | required }',
    description: 'Server certificate verification mode.',
    since: '2.4',
  },
  {
    name: 'verifyhost',
    signature: '<hostname>',
    description: 'Verify that the server certificate CN/SAN matches this hostname.',
    since: '2.4',
  },
  {
    name: 'no-verifyhost',
    signature: '',
    description: 'Disable server certificate hostname verification.',
    since: '2.4',
  },
  {
    name: 'ciphers',
    signature: '<ciphers>',
    description: 'SSL cipher suite string for TLSv1.2 and below.',
    since: '2.4',
  },
  {
    name: 'ciphersuites',
    signature: '<ciphersuites>',
    description: 'TLS 1.3 cipher suite string.',
    since: '2.4',
  },
  {
    name: 'curves',
    signature: '<curves>',
    description: 'Elliptic curve list for ECDHE (e.g. X25519:P-256).',
    since: '2.4',
  },
  {
    name: 'sigalgs',
    signature: '<sigalgs>',
    description: 'Signature algorithms for TLS negotiation.',
    since: '2.4',
  },
  {
    name: 'client-sigalgs',
    signature: '<sigalgs>',
    description: 'Signature algorithms for client certificate authentication.',
    since: '2.4',
  },
  {
    name: 'ssl-min-ver',
    signature: '[ SSLv3 | TLSv1.0 | TLSv1.1 | TLSv1.2 | TLSv1.3 ]',
    description: 'Minimum SSL/TLS version to use for server connections.',
    since: '2.4',
  },
  {
    name: 'ssl-max-ver',
    signature: '[ SSLv3 | TLSv1.0 | TLSv1.1 | TLSv1.2 | TLSv1.3 ]',
    description: 'Maximum SSL/TLS version to use for server connections.',
    since: '2.4',
  },
  {
    name: 'force-sslv3',
    signature: '',
    description: 'Force SSLv3 for server connections.',
    since: '2.4',
  },
  {
    name: 'force-tlsv10',
    signature: '',
    description: 'Force TLSv1.0 for server connections.',
    since: '2.4',
  },
  {
    name: 'force-tlsv11',
    signature: '',
    description: 'Force TLSv1.1 for server connections.',
    since: '2.4',
  },
  {
    name: 'force-tlsv12',
    signature: '',
    description: 'Force TLSv1.2 for server connections.',
    since: '2.4',
  },
  {
    name: 'force-tlsv13',
    signature: '',
    description: 'Force TLSv1.3 for server connections.',
    since: '2.4',
  },
  {
    name: 'no-sslv3',
    signature: '',
    description: 'Disable SSLv3.',
    since: '2.4',
  },
  {
    name: 'no-tlsv10',
    signature: '',
    description: 'Disable TLSv1.0.',
    since: '2.4',
  },
  {
    name: 'no-tlsv11',
    signature: '',
    description: 'Disable TLSv1.1.',
    since: '2.4',
  },
  {
    name: 'no-tlsv12',
    signature: '',
    description: 'Disable TLSv1.2.',
    since: '2.4',
  },
  {
    name: 'no-tlsv13',
    signature: '',
    description: 'Disable TLSv1.3.',
    since: '2.4',
  },
  {
    name: 'allow-0rtt',
    signature: '',
    description: 'Allow sending TLS 1.3 early data (0-RTT) to the server.',
    since: '2.4',
  },

  // ── DNS resolution ────────────────────────────────────────────────────────

  {
    name: 'resolvers',
    signature: '<resolvers-id>',
    description: 'Use the named resolvers section for this server\'s DNS lookups.',
    since: '2.4',
  },
  {
    name: 'resolve-prefer',
    signature: '<family>',
    description: 'Preferred address family for DNS resolution (ipv4 or ipv6).',
    since: '2.4',
  },
  {
    name: 'resolve-net',
    signature: '<network>[,<network>]',
    description: 'Filter DNS results to addresses in these networks.',
    since: '2.4',
  },
  {
    name: 'resolve-opts',
    signature: '<option>[,<option>]',
    description: 'DNS resolution options (allow-dup-ip, ignore-weight, prevent-dup-ip).',
    since: '2.4',
  },
  {
    name: 'resolve_retries',
    signature: '<nb>',
    description: 'Number of DNS query retries before giving up.',
    since: '2.4',
  },
  {
    name: 'init-addr',
    signature: '{ last | libc | none | <ip> }[,...]',
    description: 'Specify address resolution order at startup for FQDN servers.',
    since: '2.4',
  },
  {
    name: 'parse-resolv-conf',
    signature: '',
    description: 'Parse /etc/resolv.conf at startup for DNS nameserver configuration.',
    since: '2.4',
  },

  // ── Log server params ─────────────────────────────────────────────────────

  {
    name: 'log-bufsize',
    signature: '<bufsize>',
    description: 'Buffer size for log forwarding servers.',
    since: '2.4',
  },
  {
    name: 'log-proto',
    signature: '<logproto>',
    description: 'Log protocol to use for log server connections (legacy or octet-count).',
    since: '2.4',
  },

  // ── Persistence / cookie ──────────────────────────────────────────────────

  {
    name: 'cookie',
    signature: '<value>',
    description: 'Cookie value assigned to this server for persistence.',
    since: '2.4',
  },
  {
    name: 'stick',
    signature: '',
    description: 'Enable stick-table tracking for this server.',
    since: '2.4',
  },

  // ── Identity ──────────────────────────────────────────────────────────────

  {
    name: 'id',
    signature: '<value>',
    description: 'Set a persistent numeric ID for this server (server only, not default-server).',
    since: '2.4',
  },
  {
    name: 'guid',
    signature: '<string>',
    description: 'Set a globally unique string ID for this server.',
    since: '2.8',
  },
  {
    name: 'hash-key',
    signature: '{ id | addr | addr-port }',
    description: 'Define how consistent hash node keys are computed for this server.',
    since: '2.4',
  },

  // ── Timeouts (server-level overrides) ─────────────────────────────────────

  {
    name: 'timeout',
    signature: '<event> <time>',
    description: 'Override a specific timeout for connections to this server.',
    since: '2.4',
  },
];
