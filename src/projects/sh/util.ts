import braces from 'braces';
import { last } from '../service/generic';
import { ProcessMeta, ProcessStatus, TtyLinkCtxt } from './session.store';
import { parseJsArg } from './cmd.service';
import { SigEnum } from './io';
import type * as Sh from './parse';

//#region expansion

export function normalizeWhitespace(word: string, trim = true): string[] {
  if (!word.trim()) {// Prevent [''].
    return [];
  } else if (trim) {
    return word.trim().replace(/[\s]+/g, ' ').split(' ');
  }

  // Otherwise preserve single leading/trailing space
  const words = word.replace(/[\s]+/g, ' ').split(' ');
  if (!words[0]) {// ['', 'foo'] -> [' foo']
    words.shift();
    words[0] = ' ' + words[0];
  }
  if (!last(words)) {// ['foo', ''] -> ['foo ']
    words.pop();
    words.push(words.pop() + ' ');
  }
  return words;
}

export interface Expanded {
  key: 'expanded';
  values: any[];
  /** This is values.join(' ') */
  value: string;
}

export function expand(values: string | any[]): Expanded {
  return {
    key: 'expanded',
    values: values instanceof Array ? values : [values],
    value: values instanceof Array ? values.join(' ') : values,
  };
}

export function handleProcessError(node: Sh.ParsedSh, e: ProcessError) {
  if (e.depth === undefined || e.depth--) {
    throw e; // Propagate signal (KILL)
  }
  node.exitCode = e.exitCode;
}

export function interpretEscapeSequences(input: string): string {
  return JSON.parse(JSON.stringify(input)
    // '\\e' -> '\\u001b'.
    .replace(/\\\\e/g, '\\u001b')
    // Hex escape-code (0-255) e.g. '\\\\x1b' -> '\\u001b'.
    .replace(/\\\\x([0-9a-f]{2})/g, '\\u00$1')
    // e.g. '\\\\n' -> '\\n'.
    .replace(/\\\\([bfnrt])/g, '\\$1'));
}

const bracesOpts: braces.Options = {
  expand: true,
  rangeLimit: Infinity,
};

export function literal({ Value, parent }: Sh.Lit): string[] {
  if (!parent) {
    throw Error(`Literal must have parent`);
  }
  /**
   * Remove at most one '\\\n'; can arise interactively in quotes,
   * see https://github.com/mvdan/sh/issues/321.
   */
  const value = Value.replace(/\\\n/, '');

  if (parent.type === 'DblQuoted') {
    // Double quotes: escape only ", \, $, `, no brace-expansion.
    return [value.replace(/\\(["\\$`])/g, '$1')];
  } else if (parent.type === 'TestClause') {
    // [[ ... ]]: Escape everything, no brace-expansion.
    return [value.replace(/\\(.|$)/g, '$1')];
  } else if (parent.type === 'Redirect') {
    // Redirection (e.g. here-doc): escape everything, no brace-expansion.
    return [value.replace(/\\(.|$)/g, '$1')];
  }
  // Otherwise escape everything and apply brace-expansion.
  // We escape square brackets for npm module `braces`.
  return braces(value.replace(/\[/g, '\\[').replace(/\]/g, '\\]'), bracesOpts);
}

export function singleQuotes({ Dollar: interpret, Value }: Sh.SglQuoted) {
  return [interpret ? interpretEscapeSequences(Value) : Value];
}

//#endregion

//#region process handling

export class ShError extends Error {
  constructor(message: string, public exitCode: number, public original?: Error) {
    super(message);
    // Set the prototype explicitly.
    Object.setPrototypeOf(this, ShError.prototype);
  }
}

export class ProcessError extends Error {
  constructor(
    public code: SigEnum,
    public pid: number,
    public sessionKey: string,
    public exitCode?: number,
    /** If defined, the number of ancestral processes to terminate */
    public depth?: number,
  ) {
    super(code);
    Object.setPrototypeOf(this, ProcessError.prototype);
  }
}

export function killError(meta: Sh.BaseMeta | ProcessMeta, exitCode?: number, depth?: number) {
  return new ProcessError(
    SigEnum.SIGKILL,
    'pid' in meta ? meta.pid : meta.key,
    meta.sessionKey,
    exitCode,
    depth,
  );
}

export function killProcess(p: ProcessMeta) {
  // console.log('KILLING', p.key, p.src);
  p.status = ProcessStatus.Killed;
  for (const cleanup of p.cleanups) {
    cleanup();
  }
  p.cleanups.length = 0;
}

//#endregion

//#region resolution

export function resolvePath(path: string, root: any, pwd: string) {
  const absParts = path.startsWith('/')
    ? path.split('/')
    : pwd.split('/').concat(path.split('/'));
  return resolveAbsParts(absParts, root);
}

export function computeNormalizedParts(varPath: string, pwd: string): string[] {
  const absParts = varPath.startsWith('/')
    ? varPath.split('/')
    : pwd.split('/').concat(varPath.split('/'));
  return normalizeAbsParts(absParts);
}

export function normalizeAbsParts(absParts: string[]) {
  return absParts.reduce((agg, item) => {
    if (!item || item === '.') return agg;
    if (item === '..') return agg.slice(0, -1);
    return agg.concat(item);
  }, [] as string[]);
}

export function resolveNormalized(parts: string[], root: any) {
  return parts.reduce((agg, item) => {
    // Support invocation of functions, where
    // args assumed valid JSON when []-wrapped,
    // e.g. myFunc("foo", 42) -> myFunc(...["foo", 42])
    if (item.endsWith(')')) {
      const matched = matchFuncFormat(item);
      if (matched) {
        const args = JSON.parse(`[${matched[1]}]`);
        return agg[item.slice(0, -(matched[1].length + 2))](...args);
      }
    }
    return agg[item];
  }, root)
}

export function resolveAbsParts(absParts: string[], root: any): any {
  return resolveNormalized(normalizeAbsParts(absParts), root);
}

export function matchFuncFormat(pathComponent: string) {
  return pathComponent.match(/\(([^\)]*)\)$/);
}

//#endregion

//#region ansi

export const ansiColor = {
  Black: '\x1b[30m',
  Blue: '\x1b[1;34m',
  Bold: '\x1b[1m',
  BrightGreen: '\x1b[92m',
  BrightGreenBg: '\x1b[102m\x1b[30m',
  DarkGreen: '\x1b[32m',
  Purple: '\x1b[35m',
  Red: '\x1b[31;1m',
  Reverse: '\x1b[7m',
  ReverseReset: '\x1b[27m',
  Reset: '\x1b[0m',
  // Warn: '\x1b[30;104m',
  White: '\x1b[0;37m',
  Underline: '\x1b[4m',
  Yellow: '\x1b[93m',
};

/** Source: https://www.npmjs.com/package/ansi-regex */
const ansiRegex = (function ansiRegex({onlyFirst = false} = {}) {
	const pattern = [
		'[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
		'(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))'
	].join('|');

	return new RegExp(pattern, onlyFirst ? undefined : 'g');
})();

export function stripAnsi(input: string) {
  return input.replace(ansiRegex, '');
}

//#endregion

//#region misc

/**
 * We'll compute text `textForTty` where each `[foo](bar)` is replaced by `[foo]`.
 * The relationship between foo and bar is stored in a `TtyLinkCtxt`.
 */
export function parseTtyMarkdownLinks(text: string, defaultValue: any) {
  const mdLinksRegex = /\[([^()]+?)\]\((.*?)\)/g;
  const matches = Array.from(text.matchAll(mdLinksRegex));
  const boundaries = matches.flatMap(match => [match.index!, match.index! + match[0].length]);
  // If added zero, links occur at odd indices of `parts` else even indices
  const addedZero = (boundaries[0] === 0 ? 0 : boundaries.unshift(0) && 1);
  const parts = boundaries
    .map((textIndex, i) => text.slice(textIndex, boundaries[i + 1] ?? text.length))
    .map((part, i) => (addedZero === (i % 2)) ? `[${ansiColor.Yellow}${part.slice(1, part.indexOf('(') - 1)}${ansiColor.Reset}]` : part)
  ;
  const ttyText = parts.join('');
  const ttyTextKey = stripAnsi(ttyText);

  const linkCtxtsFactory = matches.length ? (resolve: (v: any) => void): TtyLinkCtxt[] =>
    matches.map((match, i) => ({
      lineText: ttyTextKey,
      linkText: match[1], // 1 + ensures we're inside the square brackets
      linkStartIndex: 1 + stripAnsi(parts.slice(0, (2 * i) + addedZero).join('')).length,
      callback() {
        const value = parseJsArg(
          match[2] === '' // links [foo]() has value "foo"
            ? match[1] // links [foo](-) has value undefined
            : match[2] === '-' ? undefined : match[2]
        );
        resolve(value === undefined ? defaultValue : value);
      },
    })
  ) : undefined;

  return {
    ttyText,
    /** `ttyText` with extended ansi stripped */
    ttyTextKey,
    linkCtxtsFactory,
  };
}

//#endregion