import React from 'react';
import Highlight, { defaultProps } from 'prism-react-renderer';
import { css } from "@emotion/css";

/**
 * https://levelup.gitconnected.com/syntax-highlighting-in-gatsby-mdx-f0187ce51f4f
 * https://github.com/FormidableLabs/prism-react-renderer
 */
export function Pre(props: any) {

  const className = props.children.props.className || '';
  const matches = className.match(/language-(?<lang>.+)/);

  return (
    <Highlight
      {...defaultProps}
      theme={undefined}
      code={props.children.props.children}
      language={
        matches && matches.groups && matches.groups.lang
          ? matches.groups.lang
          : ''
      }
    >
      {({ className, style, tokens, getLineProps, getTokenProps }) => (
        <pre
          className={className}
          style={style}
        >
          {tokens.map((line, i) => (
            <div {...getLineProps({ line, key: i })}>
              {line.map((token, key) => (
                <span {...getTokenProps({ token, key })} />
              ))}
            </div>
          ))}
        </pre>
      )}
    </Highlight>
  );
};

/**
 * https://github.com/PrismJS/prism-themes/blob/master/themes/prism-vsc-dark-plus.css
 */
export const vscDarkPlusCss = css`
  pre[class*="language-"],
  code[class*="language-"] {
    color: #d4d4d4;
    font-size: 12px;
    letter-spacing: 0;
    line-height: 1.4;
    text-shadow: none;
    font-family: Menlo, Monaco, Consolas, "Andale Mono", "Ubuntu Mono", "Courier New", monospace;
    direction: ltr;
    text-align: left;
    white-space: pre;
    word-spacing: normal;
    word-break: normal;
    -moz-tab-size: 2;
    -o-tab-size: 2;
    tab-size: 2;
    -webkit-hyphens: none;
    -moz-hyphens: none;
    -ms-hyphens: none;
    hyphens: none;
  }

  pre[class*="language-"]::selection,
  code[class*="language-"]::selection,
  pre[class*="language-"] *::selection,
  code[class*="language-"] *::selection {
    text-shadow: none;
    background: #264F78;
  }

  @media print {
    pre[class*="language-"],
    code[class*="language-"] {
      text-shadow: none;
    }
  }

  pre[class*="language-"] {
    padding: 48px 48px 16px 48px;
    @media (max-width: 600px) {
      padding: 24px 16px 8px 16px;
    }
    overflow: auto;
    background: #1e1e1e;
  }

  :not(pre) > code[class*="language-"] {
    padding: .1em .3em;
    border-radius: .3em;
    color: #db4c69;
    background: #1e1e1e;
  }
  
  /*********************************************************
  * Tokens
  */

  /**
   * __CUSTOM__ for css-in-js
   * TODO better approach
   */
  .language-css.template-string {
    color: #ce9178;
  }
  .language-css.template-string.number, .language-css.template-string.unit {
    color: rgb(161, 196, 149);
  }
  .language-css.atrule.rule {
    color: #c586c0;
  }

  .namespace {
    opacity: .7;
  }

  .token.doctype .token.doctype-tag {
    color: #569CD6;
  }

  .token.doctype .token.name {
    color: #9cdcfe;
  }

  .token.comment,
  .token.prolog {
    color: #6a9955;
  }

  .token.punctuation,
  .language-html .language-css .token.punctuation,
  .language-html .language-javascript .token.punctuation {
    color: #d4d4d4;
  }

  .token.property,
  .token.tag,
  .token.boolean,
  .token.number,
  .token.constant,
  .token.symbol,
  .token.inserted,
  .token.unit {
    color: #b5cea8;
  }
  
  /** Custom */
  .token.tag {
    color: rgb(103, 153, 209);
  }
  .token.tag.property-access {
    color: #b5cea8;
  }
  .token.tag.attr-name + .punctuation + .punctuation + .script {
    color: rgb(72, 179, 255);
  }

  .token.selector,
  .token.attr-name,
  .token.string,
  .token.char,
  .token.builtin,
  .token.deleted {
    color: #ce9178;
  }

  .language-css .token.string.url {
    text-decoration: underline;
  }

  .token.operator,
  .token.entity {
    color: #d4d4d4;
  }

  .token.operator.arrow {
    color: #569CD6;
  }

  .token.atrule {
    color: #ce9178;
  }

  .token.atrule .token.rule {
    color: #c586c0;
  }

  .token.atrule .token.url {
    color: #9cdcfe;
  }

  .token.atrule .token.url .token.function {
    color: #dcdcaa;
  }

  .token.atrule .token.url .token.punctuation {
    color: #d4d4d4;
  }

  .token.keyword {
    color: #569CD6;
  }

  .token.keyword.module,
  .token.keyword.control-flow {
    color: #c586c0;
  }

  .token.function,
  .token.function .token.maybe-class-name {
    color: #dcdcaa;
  }

  .token.regex {
    color: #d16969;
  }

  .token.important {
    color: #569cd6;
  }

  .token.italic {
    font-style: italic;
  }

  .token.constant {
    color: #9cdcfe;
  }

  .token.class-name,
  .token.maybe-class-name {
    color: #4ec9b0;
  }

  .token.console {
    color: #9cdcfe;
  }

  .token.parameter {
    color: #9cdcfe;
  }

  .token.interpolation {
    color: #9cdcfe;
  }

  .token.punctuation.interpolation-punctuation {
    color: #569cd6;
  }

  .token.boolean {
    color: #569cd6;
  }

  .token.property,
  .token.variable,
  .token.imports .token.maybe-class-name,
  .token.exports .token.maybe-class-name {
    color: #9cdcfe;
  }

  .token.selector {
    color: #d7ba7d;
  }

  .token.escape {
    color: #d7ba7d;
  }

  .token.tag .token.punctuation {
    color: #808080;
  }

  .token.cdata {
    color: #808080;
  }

  .token.attr-name {
    color: #9cdcfe;
  }

  .token.attr-value,
  .token.attr-value .token.punctuation {
    color: #ce9178;
  }

  .token.attr-value .token.punctuation.attr-equals {
    color: #d4d4d4;
  }

  .token.entity {
    color: #569cd6;
  }

  .token.namespace {
    color: #4ec9b0;
  }
  /*********************************************************
  * Language Specific
  */

  pre[class*="language-javascript"],
  code[class*="language-javascript"],
  pre[class*="language-jsx"],
  code[class*="language-jsx"],
  pre[class*="language-typescript"],
  code[class*="language-typescript"],
  pre[class*="language-tsx"],
  code[class*="language-tsx"] {
    color: #9cdcfe;
  }

  pre[class*="language-css"],
  code[class*="language-css"] {
    color: #ce9178;
  }

  pre[class*="language-html"],
  code[class*="language-html"] {
    color: #d4d4d4;
  }

  pre[class*="language-bash"] {
    color: #00ff00;
    .token.class-name {
      color: #4eb0c9;
    }
    .token.operator {
      color: #ffff00;
    }
  }

  .language-regex .token.anchor {
    color: #dcdcaa;
  }

  .language-html .token.punctuation {
    color: #808080;
  }
  /*********************************************************
  * Line highlighting
  */
  pre[class*="language-"] > code[class*="language-"] {
    position: relative;
    z-index: 1;
  }

  .line-highlight.line-highlight {
    background: #f7ebc6;
    box-shadow: inset 5px 0 0 #f7d87c;
    z-index: 0;
  }

  /**
   * __CUSTOM__ for js
   * TODO better approach
   */
  .token.tag.class-name {
    color: rgb(69, 187, 151);
  }
  .token.tag.punctuation:not(.script, .attr-value) {
    color: rgb(100, 100, 100);
  }
  .token.tag.language-javascript.number {
    color: rgb(161, 196, 149);
  }
  .token.tag.attr-name + .punctuation {
    color: white;
  }
  .token.comment.language-javascript {
    color: #6a9955;
  }


`;
