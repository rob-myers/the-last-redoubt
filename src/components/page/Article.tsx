import { Link } from 'gatsby';
import React from 'react';
import { css, cx } from '@emotion/css'
import type { MDXComponents } from 'mdx/types';
import { MDXProvider } from '@mdx-js/react';

import { getTabsId } from 'model/tabs/tabs.model';
import useSiteStore, { FrontMatter } from 'store/site.store';
import { cssName } from 'projects/service/const';

import { Pre, vscDarkPlusCss } from './CodeBlock';
import Icon from './Icon';
import InlineCode from './InlineCode';

export default function Article(props: React.PropsWithChildren<{
  className?: string;
  frontmatter: FrontMatter;
  children: React.ReactNode;
}>) {

  const { frontmatter } = props;
  const { dateTime, tags } = computeDateAndExtendTags(frontmatter);

  const components = React.useMemo(() => Object.assign(
      articleComponents(frontmatter.key, { dateTime, tags }),
      { pre: Pre },
  ), [frontmatter.tags]);

  return (
    <article className={cx(
      props.className,
      articleCss,
      vscDarkPlusCss,
    )}>
      <span
        className="anchor"
        id={frontmatter.key}
      />
      <MDXProvider
        components={components}
      >
        {props.children}
      </MDXProvider>
    </article>
  );
}

const articleCss = css`
  /* line-height: 2.8; */
  line-height: 1.6;
  border: 0 solid var(--page-border-color);
  border-width: 1px 0 0 0;
  font-size: 1rem;
  overflow-wrap: break-word;
  position: relative; /** For anchors */
  
  padding: 24px var(--article-right-padding) 12px 0;
  @media(max-width: 1024px) {
    padding: 16px var(--article-right-padding) 0 0;
  }
  @media(max-width: 600px) {
    padding: 0px var(--article-right-padding);
    font-size: 1.2rem;
    border: none;
    line-height: 2;
    font-weight: 300;
  }

  a {
    color: var(--page-link-color);
    code {
      color: unset;
    }
    &.has-anchor {
      position: relative;
      > span.anchor {
        position: absolute;
        top: -96px;
      }
    }
    &.new-tab {
      display: inline-block;
    }
    code:hover {
      text-decoration: underline;
    }
  }

  aside {
    margin: calc(48px + 8px) 0;
    padding: 48px 64px;
    font-weight: 300;
    color: var(--page-font-color);
    background-color: var(--aside-background-color);
    line-height: 2;

    p {
      margin: 12px 0;
    }
    p + blockquote, blockquote + p {
      margin-top: 0px;
    }

    position: relative;
    .${cssName.anchor} {
      position: absolute;
      top: -64px;
    }
    .${cssName.infoIcon} {
      position: absolute;
      top: -12px;
      left: calc(50% - 12px - 2px);
      transform: scale(1.4);
      transform-origin: center;
      border: 2px solid black;
      border-radius: 24px;
    }

    @media(max-width: 600px) {
      margin: 32px 0 24px 0;
      padding: 24px;
      line-height: 1.8;
      border: thin solid var(--page-border-color);
      .${cssName.infoIcon} {
        transform: scale(1.2);
      }
      font-size: 1rem;
      p {
        margin: 8px 0;
      }
    }
  }

  blockquote {
    /* line-height: 2; */
    padding-left: 30px;
    margin: 0 0 32px 0;

    p:first-child {
      margin-bottom: 12px;
    }
    p:nth-child(n + 2) {
      margin-top: 0;
    }
    border-left: 8px solid var(--page-blockquote-border-color);

    @media(max-width: 600px) {
      padding-left: 20px;
      margin: 0 0 20px 0;
      font-style: italic;
      p:first-child {
        margin-bottom: 8px;
      }
    }
  }

  code {
    font-family: 'Courier New', Courier, monospace;
  }
  code + span.side-note {
    top: 0;
  }

  figure.carousel {
    margin: 64px 0 64px 0;
    padding: 0;
    @media(max-width: 600px) {
      margin: 32px 0;
    }
  }
  div.def {
    margin: 48px 0;
    @media(max-width: 600px) {
      margin: 32px 0;
    }
  }

  figure.tabs {
    margin: calc(64px + 32px) 0 64px 0;
    /* padding: 64px; */
    /* border: 1px solid var(--page-border-color); */
    @media(max-width: 600px) {
      border: none;
      margin: calc(48px + 16px) 0 48px 0;
    }
  }

  h1, h2, h3, h4, h5 {
    font-family: 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif;
    font-weight: 300;
    letter-spacing: 2px;
    a {
      color: var(--page-header-color);
    }

    position: relative;
    > span.anchor {
      position: absolute;
      top: -48px;
    }
  }
  h2 {
    font-size: 2.4rem;
    @media(max-width: 1024px) {
      font-size: 2.4rem;
    }
    margin: 0px 0 16px 0;
    @media(max-width: 600px) {
      margin: 16px 0;
      font-size: 2.2rem;
    }
  }
  h2 + time + div.tags {
    display: flex;
    flex-wrap: wrap;
    font-family: sans-serif;
    font-size: 0.8rem;
    color: var(--page-font-color);
    letter-spacing: 2px;

    padding: 0;
    background-color: unset;
    
    > span {
      padding: 12px;
      margin-bottom: 0;
      line-height: 2;
      border: 1px solid var(--page-border-color);
      background-color: var(--aside-background-color);
    }
    
    margin-bottom: 48px;
    @media(max-width: 600px) {
      margin-bottom: 0;
      > span {
        flex-grow: 1;
      }
    }
  }
  h3 {
    font-size: 1.6rem;
    margin: 40px 0 32px 0;
    @media(max-width: 600px) {
      font-size: 1.5rem;
      margin: 24px 0 16px 0;
    }
  }
  h4 {
    font-size: 1.4rem;
    margin: 20px 0 12px 0;
    @media(max-width: 600px) {
      font-size: 1.3rem;
      margin: 12px 0 6px 0;
    }
  }
  h5 {
    font-size: 1.2rem;
    margin: 16px 0 12px 0;
    @media(max-width: 600px) {
      margin: 8px 0 4px 0;
    }
  }

  h2 + p, h3 + p {
    margin-top: 0px;
  }

  li {
    /* line-height: 2; */
    p {
      margin-bottom: 18px;
    }
    @media(max-width: 600px) {
      > p:first-child {
        margin-bottom: 8px;
      }
    }
  }

  li blockquote {
    p {
      margin: 16px 0;
    }
  }

  p {
    margin-top: 0;
    margin-bottom: 32px;
    @media(max-width: 600px) {
      margin-bottom: 20px;
    }
  }
  /* p + figure.carousel {
    @media(max-width: 600px) {
      margin-top: 20px;
    }
  } */

  pre {
    border: 1px solid var(--page-border-color);
    margin: 32px 0;
    @media(max-width: 600px) {
      margin: 24px 0;
    }
  }
  > pre {
    margin: 48px 0 72px 0;
    @media(max-width: 600px) {
      margin: 24px 0;
    }
  }


  span.cmd {
    color: #555;
    background: #eee;
    font-family: monospace;
    letter-spacing: 1px;
    font-size: smaller;
    padding: 2px 4px;
    @media(max-width: 600px) {
      user-select: all;
    }
  }

  > span.anchor {
    position: absolute;
    top: -48px;
  }

  table {
    padding: 8px;
    width: 100%;
    margin: 0 0 40px 0;
    border: 0 solid var(--page-border-color);
    border-width: 1px;
    line-height: 1.4;

    @media(max-width: 600px) {
      margin: 0 0 20px 0;
      border-width: 1px;
      border-color: var(--page-border-color);
    }
    th {
      text-transform: uppercase;
      font-size: 1rem;
      font-family: sans-serif;
      font-weight: 300;
    }
    th, td {
      padding: 0 16px 20px 16px;
      text-align: left;
      vertical-align: top;
      @media(max-width: 600px) {
        padding: 8px;
      }
    }
    table {
      th, td {
        padding: 8px;
      }
    }
  }

  ul, ol {
    margin-bottom: 32px;
    @media(max-width: 600px) {
      margin-bottom: 16px;
      padding-left: 20px;
    }
    + p {
      padding-top: 6px;
    }
  }

  ul li, ol li {
    margin: 4px 0;
    @media(min-width: 600px) {
      margin-bottom: 16px;
    }
  }

  @keyframes fadeInOut {
    from { opacity: 0; }
    50% { opacity: 1; }
    to   { opacity: 0; }
  }
`;

const articleComponents = (
  articleKey: string,
  meta: {
    dateTime?: string;
    tags: string[];
  },
): MDXComponents => ({

  a({ href, title, children, ...props}) {

    if (!href) {
      console.error(`a (${JSON.stringify({ title, ...props })}) lacks href and won't be rendered`);
      return null;
    }

    if (title === '@new-tab') {
      // New tab link
      return (
        <a
          href={href}
          title={title}
          target="_blank"
          rel="noopener"
          className="new-tab"
        >
          {children}
          {' '}<Icon icon="ext-link" inline small />
        </a>
      );
    }

    if (href === '#command') {
      // TODO use this?
      // Command link
      return (
        <a
          href={href}
          title={title}
          onClick={async (e) => {
            e.preventDefault();
            const [cmd, ...args] = title?.split(' ')??[];

            switch (cmd) {
              case 'open-tab': {
                const [tabsName, tabKey] = args;
                const tabsKey = getTabsId(articleKey, tabsName);
                const tabs = useSiteStore.getState().tabs[tabsKey];
                tabs?.selectTab(tabKey);
                tabs?.scrollTo();
                break;
              }
              // case 'sigkill': {
              //   import('store/session.store').then(({ default: useSessionStore }) => {
              //     const { ttyShell } = useSessionStore.api.getSession(args[0])
              //     ttyShell.xterm.sendSigKill();
              //   });
              //   break;
              // }
              default:
                console.warn('link triggered unrecognised command:', title);
            }
          }}
        >
          {children}
        </a>
      );
    }

    if (/^(?:http)|(?:mail)/.test(href)) {
      // External link
      return (
        <a
          href={href}
          title={title}
          id={getArticleLinkId(children)}
        >
          {children}
        </a>
      );  
    }

    // Otherwise, assume Gatsby link
    return (
      <Link
        to={href}
        title={title}
        id={getArticleLinkId(children)}
      >
        {children}
      </Link>
    );

  },

  code({ children }) {
    return <InlineCode>{children}</InlineCode>;
  },

  /** Occurs once in each article */
  h2({ children }: any) {
    return <>
      <h2 id={articleKey}>
        <Link to={`#${articleKey}`}>
          <span>{children}</span>
        </Link>
      </h2>
      <time dateTime={meta.dateTime}/>
      {meta.tags && (
        <div className="tags">
          {meta.tags.map((tag, i) =>
            <span
                key={tag}
                className={i === 0 && meta.dateTime ? "tag date" : "tag"}
                title={tag}
              >
              {tag}
            </span>
          )}
        </div>
      )}
    </>;
  },

  h3({ children }: any) {
    const id = React.useMemo(() => getArticleH3Id(children), []);
    return (
      <h3>
        <span id={id} className="anchor" />
        <Link to={`#${id}`}>
          {children}
        </Link>
      </h3>
    );
  },

  h4({ children }: any) {
    const id = React.useMemo(() => getArticleH3Id(children), []);
    return (
      <h4>
        <span id={id} className="anchor" />
        <Link to={`#${id}`}>
          {children}
        </Link>
      </h4>
    );
  },

});

function childrenToKebabText(children: React.ReactNode | React.ReactNode[]) {
  return React.Children.toArray(children)[0]
    .toString().trimEnd().toLowerCase().replace(/[\s.:]/g, '-');
}

const months = [
  'Jan', 'Feb', 'March', 'April', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec',
];

function dayth(x: number) {
  const last = Number(x.toString().slice(-1));
  if (last > 3) {
    return 'th';
  } else if (last === 1) {
    return 'st'
  } else if (last === 2) {
    return 'nd';
  } else if (last === 3) {
    return 'rd';
  }
}

/**
 * Hacky e.g. does not support markdown `[_foo_](bar)`.
 */
function getArticleH3Id(
  children: React.ReactNode | React.ReactNode[],
) {
  return childrenToKebabText(children);
}

function getArticleLinkId(
  children: React.ReactNode | React.ReactNode[],
) {
  return `link--${childrenToKebabText(children)}`;
}

function computeDateAndExtendTags(fm: FrontMatter) {
  const d = new Date(fm?.date);
  const dateText = `${d}` !== 'Invalid Date'
    ? `${d.getDate()}${dayth(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()}`
    : undefined;
  return {
    dateTime: dateText ? fm.date: undefined,
    tags: dateText ? [dateText].concat(fm.tags) : fm.tags,
  };
}
