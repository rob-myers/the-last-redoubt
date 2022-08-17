import React from 'react';
import { css, cx } from '@emotion/css'
import { MDXProvider } from '@mdx-js/react';

import { getTabsId } from 'model/tabs/tabs.model';
import useSiteStore, { FrontMatter } from 'store/site.store';
import { cssName } from 'projects/service/const';

import Link from './Link';
import Sep from './Sep';
import { pre, vscDarkPlusCss } from './CodeBlock';
import Icon from './Icon';

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
    [frontmatter.tags],
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
    &.has-anchor {
      position: relative;
      > span.anchor {
        position: absolute;
        top: -96px;
      }
    }
  }

  aside {
    margin: 40px 0 32px 0;
    padding: 12px 32px;
    font-size: 0.9rem;
    font-style: italic;
    font-weight: 300;
    border: 1px solid #bbb;
    
    p {
      margin: 12px 0;
    }
    p + blockquote, blockquote + p {
      margin-top: 0px;
    }
    code {
      font-size: inherit;
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
      margin: 24px 0 16px 0;
      padding: 16px 24px;
      border-radius: 12px;
      border-width: 1px;
      line-height: 2;
      .${cssName.infoIcon} {
        transform: scale(1.2);
      }
      font-size: 1rem;
    }
  }

  blockquote {
    line-height: 2;
    padding-left: 30px;
    margin: 0 0 24px 0;

    p:first-child {
      margin-bottom: 12px;
    }
    p:nth-child(n + 2) {
      margin-top: 0;
    }
    border-left: 8px solid #ddd;

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
    font-size: 1rem;
    padding: 2px 0;
    margin-right: 2px;
    @media(max-width: 600px) {
      font-size: 1.1rem;
    }
  }

  div.carousel {
    margin: 32px 0 40px 0;
    padding: 48px;
    background-color: #eee;
    @media(max-width: 600px) {
      margin: 0 0 24px 0;
      padding: 8px 0;
    }
  }

  figure.image {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;

    margin: 32px 0;
    border: 1px solid #ccc;
    padding: 36px 24px 0 24px;
    text-align: center;

    @media(max-width: 600px) {
      padding: 0;
      margin: 8px 0 16px 0;
    }

    img {
      max-width: 100%;
    }

    figcaption {
      font-style: italic;
      text-transform: uppercase;
      font-size: 0.9rem;
      text-align: center;
      padding: 8px 0;
    }
  }
  figure.tabs, figure.video {
    margin: calc(40px + 16px) 0 40px 0;
    padding: 48px;
    background-color: #eee;
    @media(max-width: 600px) {
      margin: calc(32px + 16px) 0 24px 0;
      padding: 8px 0 8px 0;
    }
  }
  p + figure.tabs {
    margin: 40px 0 40px 0;
    @media(max-width: 600px) {
      margin: 20px 0 20px 0;
    }
  }
  p + figure.video {
    margin: 32px 0 40px 0;
    @media(max-width: 600px) {
      margin: 20px 0 20px 0;
    }
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
      font-size: 2.4rem;
    }
    margin: 24px 0 16px 0;
    @media(max-width: 600px) {
      margin: 16px 0;
      font-size: 1.7rem;
    }
  }
  h2 + time + div.tags {
    display: flex;
    flex-wrap: wrap;
    font-family: sans-serif;
    font-size: 0.7rem;
    color: #fff;
    letter-spacing: 2px;

    margin-bottom: 20px;
    @media(max-width: 600px) {
      margin-bottom: 12px;
      font-size: 0.8rem;
    }

    > span {
      padding: 2px 8px;
      margin-right: 4px;
      margin-bottom: 4px;
      border-radius: 3px;
      border: 2px solid rgba(0, 0, 0, 0.1);
      background-color: #000;
    }
  }
  h3 {
    font-size: 1.8rem;
    margin: 0 0 4px 0;
    @media(max-width: 600px) {
      font-size: 1.4rem;
      margin: 0 0 12px 0;
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

  li {
    line-height: 2;
    > p:first-child {
      margin-bottom: 12px;
    }
    > p:nth-child(n + 2) {
      margin-top: 0;
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
    margin-bottom: 24px;
    @media(max-width: 600px) {
      margin-bottom: 16px;
    }
  }
  
  p + div.carousel {
    @media(max-width: 600px) {
      margin-top: 20px;
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
    border: 0 solid #eee;
    border-width: 48px;
    line-height: 1.4;

    @media(max-width: 600px) {
      margin: 0 0 20px 0;
      border-width: 1px;
      border-color: #ddd;
    }
    th {
      text-transform: uppercase;
      font-size: 1rem;
      font-family: sans-serif;
    }
    th, td {
      padding: 16px;
      text-align: left;
      vertical-align: top;
      @media(max-width: 600px) {
        padding: 8px;
      }
    }
  }

  ul, ol {
    margin-top: 0;
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

  @keyframes fadeInOut {
    from { opacity: 0; }
    50% { opacity: 1; }
    to   { opacity: 0; }
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
      return (
        <Link
          href={href}
          id={id}
          prePush={`#${id}`}
          title={title}
          hasAnchor
          // backward={!!part && (part < articlesMeta[articleKey].part)}
        >
          {children}
          &nbsp;{'['}<Icon icon="hash-icon" inline small />{']'}
        </Link>
      );
    }

    // New tab link
    if (title === '@new-tab') {
      return (
        <a
          href={href}
          title={title}
          target="_blank"
          rel="noopener"
        >
          {children}
          &nbsp;<Icon icon="ext-link" inline small />
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
        hasAnchor
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
        <Link href={`#${id}`}>
          <Icon icon="info-icon" invert />
        </Link>
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
        {meta.tags.map(tag => <span className="tag" key={tag}>{tag}</span>)}
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
