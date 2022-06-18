import React from 'react';
import { css, cx } from '@emotion/css'
import { MDXProvider } from '@mdx-js/react';

import { getTabsId } from 'model/tabs/tabs.model';
import useSiteStore, { FrontMatter } from 'store/site.store';

import Link from './Link';
import Sep from './Sep';
import { iconCss } from './Icons';

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
    articleComponents(frontmatter.key as any, {
      dateTime: frontmatter?.date || `${(new Date).getFullYear()}-${(new Date).getDate()}-${(new Date).getDay()}`,
      dateText,
      tags: frontmatter?.tags || [],
    }),
    [],
  );

  return <>
    <article className={cx(props.className, articleCss)}>
      <span className="anchor" id={frontmatter.key} />
      <MDXProvider components={components} >
        {props.children}
      </MDXProvider>
    </article>
    <Sep/>
  </>;
}

const articleCss = css`
  line-height: 2.2;
  /* background: var(--focus-bg); */
  /* border: var(--blog-border-width) solid var(--border-bg); */
  border: 0 solid var(--border-bg);
  border-width: 1px 0 0 1px;
  font-size: 1rem;
  overflow-wrap: break-word;
  position: relative; /** For anchors */
  
  padding: 64px 164px 96px 164px;
  @media(max-width: 1024px) {
    padding: 64px 48px;
  }
  @media(max-width: 600px) {
    padding: 8px 12px;
    font-size: 1.1rem;
    border: none;
    line-height: 2;
    font-weight: 300;
    background: white;
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
    margin: 24px 0;
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
    margin: 32px 0;
    border-left: 8px solid #ddd;
    padding-left: 30px;
    font-weight: 300;
    
    @media(max-width: 600px) {
      margin: 20px 0;
      padding-left: 20px;
      font-style: italic;
    }
  }
  blockquote + p {
    margin-top: -12px;
    @media(max-width: 600px) {
      margin-top: 0;
    }
  }
  
  code {
    font-family: 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif;
    letter-spacing: 1px;
    color: #444;
    letter-spacing: 2px;
    padding: 0 2px;
  }

  figcaption {
    text-align: center;
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
    font-size: 2.8rem;
    @media(max-width: 1024px) {
      font-size: 2.6rem;
    }
    @media(max-width: 600px) {
      margin: 16px 0 16px;
      font-size: 1.7rem;
    }
  }
  h2 + time {
    display: block;
    margin-top: -24px;
    margin-bottom: 32px;
    font-size: 0.7rem;
    line-height: 3;
    > span {
      margin-right: 16px;
      white-space: pre;
      > span {
        padding: 6px 10px;
        margin: 0 1px;
        border: 1px solid #aaa;
        border-radius: 2px;
        color: #333;
      }
    }
    @media(max-width: 600px) {
      margin-top: 0;
      > span {
        padding: 4px 0px;
        margin-right: 12px;
        > span {
          padding: 6px 8px;
        }
      }
    }
  }
  h2 + time + div.tags {
    margin-top: -12px;
    display: flex;
    flex-wrap: wrap;
    font-size: 0.7rem;
    font-family: sans-serif;
    letter-spacing: 2px;
    span {
      padding: 2px 8px;
      margin-right: 4px;
      margin-bottom: 4px;
      border-radius: 3px;
      border: 2px solid rgba(0, 0, 0, 0.1);
      background: #555;
      color: #fff;
    }
    @media(max-width: 600px) {
      margin-top: -16px;
      margin-bottom: 32px;
    }
  }
  h3 {
    font-size: 1.7rem;
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

  li blockquote {
    margin: 0;
    p {
      margin: 16px 0;
    }
  }

  p {
   margin: 40px 0;
   @media(max-width: 600px) {
     margin: 16px 0;
   }

   code {
     font-size: 1rem;
   }
  }

  p + blockquote {
    margin-top: -20px;
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
    dateText: string;
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
          className={cx("anchor-link", iconCss('anchor-icon', '0 2px 0 4px'))}
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
          className={cx("new-tab-link", iconCss('ext-link-icon', '0 2px 0 4px'))}
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
      <time dateTime={meta.dateTime}>
        {meta.dateText.split(' ').map(
          (word) => <span key={word}>
            {Array.from(word).map((letter, i) => <span key={i}>{letter}</span>)}
          </span>
        )}
      </time>
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
          <a>{children}</a>
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
