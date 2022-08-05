import React from 'react';
import { css, cx } from '@emotion/css'
import { MDXProvider } from '@mdx-js/react';

import { getTabsId } from 'model/tabs/tabs.model';
import useSiteStore, { FrontMatter } from 'store/site.store';

import Link from './Link';
import Sep from './Sep';
import { iconCss } from './Icons';
import { pre, vscDarkPlusCss } from './CodeBlock';

export default function Article(props: React.PropsWithChildren<{
  className?: string;
  frontmatter: FrontMatter;
  children: React.ReactNode;
}>) {

  const { frontmatter } = props;

  const dateText = React.useMemo(() => {
    const d = frontmatter ? new Date(frontmatter.date) : new Date;
    return `${d.getDate()}${dayth(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }, []);

  const components = React.useMemo(() =>
    Object.assign(
      articleComponents(frontmatter.key as any, {
        dateTime: frontmatter.date,
        tags: [dateText].concat(frontmatter.tags),
      }),
      { pre },
    ),
    [],
  );

  return <>
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
    <Sep/>
  </>;
}

const articleCss = css`
  line-height: 2.2;
  border: 0 solid var(--article-border-color);
  border-width: 1px 0 0 1px;
  font-size: 1rem;
  overflow-wrap: break-word;
  position: relative; /** For anchors */
  
  padding: 12px 64px 12px 64px;
  @media(max-width: 1024px) {
    padding: 0px 48px;
  }
  @media(max-width: 600px) {
    padding: 0px 12px;
    font-size: 1.2rem;
    border: none;
    line-height: 2;
    font-weight: 300;
  }

  a {
    code {
      color: unset;
    }
    position: relative;
    > span.anchor {
      position: absolute;
      top: -96px;
    }
  }

  aside {
    margin: 0 0 24px 0;
    padding: 36px 48px;
    font-size: 0.9rem;
    font-weight: 300;
    border: 0 solid #ddd;
    background: #eee;
    
    p {
      margin: 12px 0;
    }
    p + blockquote, blockquote + p {
      margin-top: 0px;
    }
    
    @media(max-width: 600px) {
      margin: 0 0 16px 0;
      padding: 8px 20px;
      font-size: 0.9rem;
      border-radius: 12px;
      border-width: 0 2px 2px 0;
      line-height: 1.9;
    }

    blockquote {
      margin: 0;
      border-left: 8px solid #ccc;
    }
    figure.tabs {
      @media(min-width: 600px) {
        margin: 40px 0;
      }
    }

    position: relative;
    .anchor {
      position: absolute;
      top: -48px;
    }
  }

  blockquote {
    padding-left: 30px;
    margin: 0 0 32px 0;

    @media(max-width: 600px) {
      margin: 0 0 20px 0;
      padding-left: 20px;
      font-style: italic;
    }

    p:first-child:not(:last-child) {
      margin-bottom: 0;
    }
    p:nth-child(n + 2) {
      margin-top: 0;
    }

    border-left: 8px solid #ddd;
    font-weight: 300;
  }
  
  code {
    letter-spacing: 1px;
    color: #0f0;
    background-color: #000;
    letter-spacing: 2px;
    padding-left: 2px;
  }

  div.carousel {
    margin-bottom: 32px;
    @media(max-width: 600px) {
      margin-bottom: 24px;
    }
  }

  figcaption {
    text-align: center;
  }

  figure.tabs {
    margin: calc(32px + 16px) 0 32px 0;
  }

  h1, h2, h3, h4 {
    font-family: 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif;
    font-weight: 300;
    letter-spacing: 2px;
    a {
      color: #444;
    }
    @media(max-width: 600px) {
      font-weight: 400;
    }
  }
  h2 {
    font-size: 2.4rem;
    @media(max-width: 1024px) {
      font-size: 2.2rem;
    }
    margin: 24px 0 16px 0;
    @media(max-width: 600px) {
      margin: 16px 0 16px;
      font-size: 1.7rem;
    }
  }
  h2 + time + div.tags {

    margin-bottom: 32px;
    font-size: 0.7rem;
    @media(max-width: 600px) {
      margin-bottom: 16px;
      font-size: 0.8rem;
    }

    display: flex;
    flex-wrap: wrap;
    font-family: sans-serif;
    letter-spacing: 2px;
    span {
      padding: 2px 8px;
      margin-right: 4px;
      margin-bottom: 4px;
      border-radius: 3px;
      border: 2px solid rgba(0, 0, 0, 0.1);
      background-color: white; /** For dark-mode */
    }
  }
  h3 {
    font-size: 1.6rem;
    @media(max-width: 600px) {
      font-size: 1.3rem;
    }

    position: relative;
    > span.anchor {
      position: absolute;
      top: -48px;
    }
  }

  h2 + p, h3 + p {
    margin-top: 0px;
  }

  iframe.youtube {
    padding: 16px 0;
    background-color: #222;
    margin-bottom: 24px;
    @media(max-width: 600px) {
      margin-bottom: 8px;
    }
  }

  li blockquote {
    margin: 0;
    p {
      margin: 16px 0;
    }
  }

  p {
    margin-top: 0;
    margin-bottom: 40px;
    @media(max-width: 600px) {
      margin-bottom: 16px;
    }
  }

  p + blockquote {
    margin-top: -20px;
    @media(max-width: 600px) {
      margin-top: -4px;
    }
  }
  
  p + div.carousel {
    @media(max-width: 600px) {
      margin-top: 20px;
    }
  }

  p + ul {
    margin-top: -32px;
    @media(max-width: 600px) {
      margin-top: -4px;
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
    border: 1px solid #bbb;
    width: 100%;
    margin: 40px 0;
    @media(max-width: 600px) {
      margin: 20px 0;
    }
    th, td {
      padding: 6px;
      text-align: left;
      vertical-align: top;
      @media(max-width: 600px) {
        padding: 4px 2px;
      }
    }
  }

  ul, ol {
    @media(max-width: 600px) {
      padding-left: 20px;
    }
    + p {
      padding-top: 6px;
    }
  }

  ul li, ol li {
    margin: 4px 0;
  }
`;

const articleComponents = (
  articleKey: string,
  meta: {
    dateTime: string;
    tags: string[];
  },
) => ({

  a({ node, href, title, children, ...props}: any) {

    // Relative link with added auto-anchor
    if (title === '@anchor') {
      const id = getArticleLinkId(articleKey, children);
      const part = Number((href || '').split('#')[0]) || null;
      return (
        <Link
          href={href}
          className={cx("anchor-link", iconCss({ basename: 'hash-icon', margin: '0 2px 0 4px' }))}
          id={id}
          prePush={`#${id}`}
          title={title}
          // backward={!!part && (part < articlesMeta[articleKey].part)}
        >
          {children}
        </Link>
      );
    }

    // New tab link
    if (title === '@new-tab') {
      return (
        <a
          href={href}
          title={title}
          className={cx("new-tab-link", iconCss({ basename: 'ext-link', margin: '0 2px 0 4px' }))}
          target="_blank"
          rel="noopener"
        >
          {children}
        </a>
      );
    }

    // Command link
    if (href === '#command') {
      return (
        <a
          href={href}
          title={title}
          onClick={async (e) => {
            e.preventDefault();
            const [cmd, ...args] = title.split(' ');

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

    // Otherwise, external link or relative link sans auto-anchor
    return (
      <Link
        href={href}
        title={title}
        id={getArticleLinkId(articleKey, children)}
      >
        {children}
      </Link>
    );

  },

  aside({ node, children, title, ...props }: any) {
    const id = getAsideId(articleKey, title);
    return (
      <aside {...props}>
        <span {...title && { id }} className="anchor" />
        {children}
      </aside>
    );
  },

  // Occurs once in each article
  h2({ children }: any) {
    return <>
      <h2>
        <Link href={`#${articleKey}`}>
          <span>{children}</span>
        </Link>
      </h2>
      <time
        dateTime={meta.dateTime}
      />
      <div className="tags" title="tags">
        {meta.tags.map(tag => <span key={tag}>{tag}</span>)}
      </div>
    </>;
  },

  h3({ children }: any) {
    const id = React.useMemo(() => `${articleKey}--${
      React.Children.toArray(children)[0]
        .toString().toLowerCase().replace(/\s/g, '-')
    }`
  , []);

    return (
      <h3>
        <span id={id} className="anchor" />
        <Link href={`#${id}`}>
          {children}
        </Link>
      </h3>
    );
  }

});

function childrenToKebabText(children: React.ReactNode | React.ReactNode[]) {
  return React.Children.toArray(children)[0]
    .toString().toLowerCase().replace(/\s/g, '-');
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
function getArticleLinkId(
  articleKey: string,
  children: React.ReactNode | React.ReactNode[],
  ) {
    return `${articleKey}--link--${childrenToKebabText(children)}`;
  }
  
function getAsideId(
  articleKey: string,
  asideName: string,
) {
  return `${articleKey}--aside--${asideName}`;
}

interface FrontmatterData {
  allMdx: {
    edges: {
      node: {
        /** Values are technically possibly null */
        frontmatter: {
          key: string;
          date: string;
          tags: string[];
        };
      };
    }[];
  };
}
