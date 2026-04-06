/**
 * Directive definitions for HAProxy non-proxy sections:
 * peers, resolvers, userlist, mailers, ring, log-forward, program,
 * http-errors, and cache.
 *
 * These sections don't follow the proxy keyword matrix and are
 * modelled separately from directives.ts.
 *
 * Source: https://docs.haproxy.org/3.1/configuration.html
 */
import { SectionType } from '../parser/ast';

const DOCS = 'https://docs.haproxy.org/3.1/configuration.html';

/** Simplified definition for directives that belong to non-proxy sections. */
export interface SpecialSectionDef {
  readonly name: string;
  readonly sections: readonly SectionType[];
  readonly description: string;
  readonly signature: string;
  readonly since: string;
  readonly deprecated?: string;
  readonly removed?: string;
  readonly docsUrl?: string;
}

// ─── PEERS ────────────────────────────────────────────────────────────────────

const PEERS: SpecialSectionDef[] = [
  {
    name: 'peer',
    sections: ['peers'],
    signature: 'peer <name> <ip>:<port>',
    description: 'Declare a peer in a peers section (legacy single-peer syntax).',
    since: '1.5',
    docsUrl: `${DOCS}#3.5`,
  },
  {
    name: 'server',
    sections: ['peers'],
    signature: 'server <name> <addr>[:<port>] [params]',
    description: 'Declare a peer server in a peers section.',
    since: '2.5',
  },
  {
    name: 'bind',
    sections: ['peers'],
    signature: 'bind [<address>]:<port> [params]',
    description: 'Define the listening address for the peers channel.',
    since: '2.5',
  },
  {
    name: 'table',
    sections: ['peers'],
    signature: 'table <name> type { ip|ipv6|integer|string|binary } size <size> [store <data>,...]',
    description: 'Define a stick table to be synchronized between peers.',
    since: '2.0',
  },
  {
    name: 'shards',
    sections: ['peers'],
    signature: 'shards <count>',
    description: 'Set the number of shards to use for this peers section.',
    since: '2.4',
  },
  {
    name: 'default-server',
    sections: ['peers'],
    signature: 'default-server [params]',
    description: 'Set default parameters for all servers in this peers section.',
    since: '2.5',
  },
  {
    name: 'disabled',
    sections: ['peers'],
    signature: 'disabled',
    description: 'Disable the peers section at startup.',
    since: '2.0',
  },
  {
    name: 'timeout connect',
    sections: ['peers'],
    signature: 'timeout connect <timeout>',
    description: 'Set the maximum time to wait for a connection to a peer.',
    since: '2.0',
  },
  {
    name: 'timeout server',
    sections: ['peers'],
    signature: 'timeout server <timeout>',
    description: 'Set the maximum inactivity time on the server side for a peer.',
    since: '2.0',
  },
  {
    name: 'timeout client',
    sections: ['peers'],
    signature: 'timeout client <timeout>',
    description: 'Set the maximum inactivity time on the client side for a peer.',
    since: '2.0',
  },
  {
    name: 'id',
    sections: ['peers'],
    signature: 'id <value>',
    description: 'Set a unique numeric ID for this peers section.',
    since: '2.0',
  },
];

// ─── RESOLVERS ────────────────────────────────────────────────────────────────

const RESOLVERS: SpecialSectionDef[] = [
  {
    name: 'nameserver',
    sections: ['resolvers'],
    signature: 'nameserver <id> <ip>:<port>',
    description: 'Add a DNS nameserver to the resolvers section.',
    since: '1.6',
    docsUrl: `${DOCS}#5.3`,
  },
  {
    name: 'parse-resolv-conf',
    sections: ['resolvers'],
    signature: 'parse-resolv-conf',
    description: 'Load nameservers from /etc/resolv.conf.',
    since: '1.6',
  },
  {
    name: 'resolve_retries',
    sections: ['resolvers'],
    signature: 'resolve_retries <number>',
    description: 'Set the number of retries before a nameserver is considered unresponsive.',
    since: '1.6',
  },
  {
    name: 'hold',
    sections: ['resolvers'],
    signature: 'hold { nx | obsolete | other | refused | timeout | valid | warning } <period>',
    description: 'Set the period to cache a DNS record by resolution status.',
    since: '1.6',
  },
  {
    name: 'timeout retry',
    sections: ['resolvers'],
    signature: 'timeout retry <delay>',
    description: 'Set the time between two consecutive resolution attempts.',
    since: '1.6',
  },
  {
    name: 'timeout resolve',
    sections: ['resolvers'],
    signature: 'timeout resolve <delay>',
    description: 'Set the maximum time to wait for a DNS resolution.',
    since: '1.6',
  },
  {
    name: 'accepted_payload_size',
    sections: ['resolvers'],
    signature: 'accepted_payload_size <number>',
    description: 'Set the maximum payload size accepted for DNS responses (bytes).',
    since: '1.7',
  },
];

// ─── USERLIST ─────────────────────────────────────────────────────────────────

const USERLIST: SpecialSectionDef[] = [
  {
    name: 'user',
    sections: ['userlist'],
    signature: 'user <username> { password | insecure-password } <password> [groups <group>[,<group>...]]',
    description: 'Declare a user with a password (hashed or plain) in a userlist.',
    since: '1.5',
    docsUrl: `${DOCS}#3.4`,
  },
  {
    name: 'group',
    sections: ['userlist'],
    signature: 'group <groupname> [users <user>[,<user>...]]',
    description: 'Declare a group and its members in a userlist.',
    since: '1.5',
  },
];

// ─── MAILERS ──────────────────────────────────────────────────────────────────

const MAILERS: SpecialSectionDef[] = [
  {
    name: 'mailer',
    sections: ['mailers'],
    signature: 'mailer <mailername> <ip>:<port>',
    description: 'Declare a mail relay endpoint for alert emails.',
    since: '1.6',
    docsUrl: `${DOCS}#3.6`,
  },
  {
    name: 'timeout mail',
    sections: ['mailers'],
    signature: 'timeout mail <delay>',
    description: 'Set the maximum time to wait for a mail server response.',
    since: '1.6',
  },
];

// ─── RING ─────────────────────────────────────────────────────────────────────

const RING: SpecialSectionDef[] = [
  {
    name: 'description',
    sections: ['ring'],
    signature: 'description <text>',
    description: 'Set a human-readable description for this ring buffer.',
    since: '2.2',
    docsUrl: `${DOCS}#3.9`,
  },
  {
    name: 'format',
    sections: ['ring'],
    signature: 'format { iso | raw | rfc3164 | rfc5424 | short | timed }',
    description: 'Set the log format for messages written to this ring.',
    since: '2.2',
  },
  {
    name: 'maxlen',
    sections: ['ring', 'log-forward'],
    signature: 'maxlen <length>',
    description: 'Set the maximum length for log messages in this ring or log-forward.',
    since: '2.2',
  },
  {
    name: 'server',
    sections: ['ring'],
    signature: 'server <name> <addr>:<port> [params]',
    description: 'Declare a remote syslog server to forward ring entries to.',
    since: '2.2',
  },
  {
    name: 'bind',
    sections: ['ring'],
    signature: 'bind [<address>]:<port> [params]',
    description: 'Bind to an address to accept log messages pushed into this ring.',
    since: '2.2',
  },
  {
    name: 'timeout connect',
    sections: ['ring'],
    signature: 'timeout connect <timeout>',
    description: 'Set the connection timeout to the remote syslog server.',
    since: '2.2',
  },
];

// ─── LOG-FORWARD ──────────────────────────────────────────────────────────────

const LOG_FORWARD: SpecialSectionDef[] = [
  {
    name: 'bind',
    sections: ['log-forward'],
    signature: 'bind [<address>]:<port> [params]',
    description: 'Bind to a TCP address to accept log messages.',
    since: '2.2',
    docsUrl: `${DOCS}#3.8`,
  },
  {
    name: 'dgram-bind',
    sections: ['log-forward'],
    signature: 'dgram-bind <address>:<port>',
    description: 'Bind to a UDP address to accept syslog messages.',
    since: '2.2',
  },
  {
    name: 'log',
    sections: ['log-forward'],
    signature: 'log <address> [len <length>] [format <format>] <facility> [max level [min level]]',
    description: 'Forward received log messages to a remote syslog server.',
    since: '2.2',
  },
];

// ─── PROGRAM ──────────────────────────────────────────────────────────────────

const PROGRAM: SpecialSectionDef[] = [
  {
    name: 'command',
    sections: ['program'],
    signature: 'command <cmdline>',
    description: 'Set the command to execute for this program section.',
    since: '2.0',
    docsUrl: `${DOCS}#3.10`,
  },
  {
    name: 'option start-on-reload',
    sections: ['program'],
    signature: 'option start-on-reload',
    description: 'Start (or restart) the program when HAProxy reloads its configuration.',
    since: '2.0',
  },
  {
    name: 'user',
    sections: ['program'],
    signature: 'user <user>',
    description: 'Run the program as the given user.',
    since: '2.0',
  },
  {
    name: 'group',
    sections: ['program'],
    signature: 'group <group>',
    description: 'Run the program under the given supplementary group.',
    since: '2.0',
  },
];

// ─── HTTP-ERRORS ──────────────────────────────────────────────────────────────

const HTTP_ERRORS: SpecialSectionDef[] = [
  {
    name: 'errorfile',
    sections: ['http-errors'],
    signature: 'errorfile <code> <file>',
    description: 'Return a pre-formatted HTTP response from a file for the given error code.',
    since: '2.4',
    docsUrl: `${DOCS}#4.3`,
  },
  {
    name: 'errorfiles',
    sections: ['http-errors'],
    signature: 'errorfiles <name> [from <dir>]',
    description: 'Assign a set of errorfiles to this http-errors section.',
    since: '2.4',
  },
];

// ─── CACHE ────────────────────────────────────────────────────────────────────

const CACHE: SpecialSectionDef[] = [
  {
    name: 'max-age',
    sections: ['cache'],
    signature: 'max-age <maxage>',
    description: 'Set the maximum expiration age for cached objects (seconds).',
    since: '1.8',
    docsUrl: `${DOCS}#5.2`,
  },
  {
    name: 'max-object-size',
    sections: ['cache'],
    signature: 'max-object-size <bytes>',
    description: 'Set the maximum size of a cacheable object in bytes.',
    since: '1.8',
  },
  {
    name: 'min-object-size',
    sections: ['cache'],
    signature: 'min-object-size <bytes>',
    description: 'Set the minimum size of a cacheable object in bytes.',
    since: '1.8',
  },
  {
    name: 'process-vary',
    sections: ['cache'],
    signature: 'process-vary <on|off>',
    description: 'Enable or disable processing of Vary headers for cache key generation.',
    since: '2.1',
  },
  {
    name: 'total-max-size',
    sections: ['cache'],
    signature: 'total-max-size <megabytes>',
    description: 'Set the maximum total memory used by this cache (megabytes).',
    since: '1.8',
  },
  {
    name: 'max-secondary-entries',
    sections: ['cache'],
    signature: 'max-secondary-entries <number>',
    description: 'Set the maximum number of secondary entries (Vary variants) for a single cache key.',
    since: '2.1',
  },
];

/** All special-section directives, consolidated. */
export const SPECIAL_SECTION_DIRECTIVES: SpecialSectionDef[] = [
  ...PEERS,
  ...RESOLVERS,
  ...USERLIST,
  ...MAILERS,
  ...RING,
  ...LOG_FORWARD,
  ...PROGRAM,
  ...HTTP_ERRORS,
  ...CACHE,
];
