import { Link } from 'gatsby';
import React from 'react';
import { css, cx } from '@emotion/css'
import { MDXProvider } from '@mdx-js/react';

import { getTabsId } from 'model/tabs/tabs.model';
import useSiteStore, { FrontMatter } from 'store/site.store';
import { cssName } from 'projects/service/const';

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
  line-height: 2.2;
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
  }

  aside {
    margin: 48px 0 32px 0;
    padding: 32px 64px;
    font-size: 0.9rem;
    /* font-style: italic; */
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
    line-height: 2;
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
    font-size: 1rem;
    padding: 2px 0;
    margin-right: 2px;
    @media(max-width: 600px) {
      font-size: 1.1rem;
    }
  }

  figure.carousel {
    margin: 40px 0 40px 0;
    padding: 0;
    /**
     * max-width 600px causes difficulty with
     * swiper carousel breakpoints
     */
    @media(max-width: 800px) {
      margin: 28px 0 24px 0;
      padding: 0;
    }
  }

  figure.tabs, figure.video {
    margin: calc(40px + 16px) 0 40px 0;
    padding: 64px;
    border: 1px solid var(--page-border-color);
    @media(max-width: 600px) {
      border: none;
      margin: calc(32px + 16px) 0 24px 0;
      padding: 8px 0;
    }
  }
  p + figure.tabs {
    margin: 40px 0 40px 0;
    @media(max-width: 600px) {
      margin: 20px 0 20px 0;
    }
  }
  blockquote + figure.video, p + figure.video {
    margin: 32px 0 40px 0;
    @media(max-width: 600px) {
      margin: 20px 0 20px 0;
    }
  }

  h1, h2, h3, h4, h5 {
    font-family: 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif;
    font-weight: 300;
    letter-spacing: 2px;
    a {
      color: var(--page-header-color);
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

    margin-bottom: 32px;
    @media(max-width: 600px) {
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

    /** 1st tag should be date */
    > span:first-child {
      border-color: #aaa;
      padding: 2px 16px;
      text-align: center;
    }
  }
  h3 {
    font-size: 1.8rem;
    margin: 0 0 20px 0;
    @media(max-width: 600px) {
      font-size: 1.4rem;
      margin: 20px 0 12px 0;
    }

    position: relative;
    > span.anchor {
      position: absolute;
      top: -48px;
    }
  }
  h4 {
    font-size: 1.4rem;
    margin: 20px 0 12px 0;
    @media(max-width: 600px) {
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
    line-height: 2;
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

  > pre {
    margin: 48px 0 48px 0;
    @media(max-width: 600px) {
      margin: 24px 0;
    }
  }

  pre {
    border: 1px solid var(--page-border-color);
    margin-bottom: 24px;
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

  a({ node, href, title, children, ...props}: {
    href: string;
    title: string;
    children: any;
    node: any;
  }) {

    if (title === '@new-tab') {
      // New tab link
      return (
        <a
          href={href}
          title={title}
          target="_blank"
          rel="noopener"
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

  aside({ node, children, title, ...props }: any) {
    const id = getAsideId(title);
    return (
      <aside {...props}>
        <span {...title && { id }} className="anchor" />
        <Link to={`#${id}`}>
          <Icon icon="info-icon" invert className={cssName.ignoreDark} />
        </Link>
        {children}
      </aside>
    );
  },

  /** Occurs once in each article */
  h2({ children }: any) {
    return <>
      <h2>
        <Link to={`#${articleKey}`}>
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
    const id = React.useMemo(() => getArticleH3Id(children), []);
    return (
      <h3>
        <span id={id} className="anchor" />
        <Link to={`#${id}`}>
          {children}
        </Link>
      </h3>
    );
  }

});

function childrenToKebabText(children: React.ReactNode | React.ReactNode[]) {
  return React.Children.toArray(children)[0]
    .toString().toLowerCase().replace(/[\s.]/g, '-');
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

/** One article per page */
function getAsideId(
  asideName: string,
) {
  return `aside--${asideName}`;
}
