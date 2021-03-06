import React from "react";
import { navigate } from "gatsby";
import { maxScrollHeight, scrollFinished } from 'model/dom.model';
import { pause } from 'projects/service/generic';

export default function Link(props: Props) {
  return (
    <a
      href={props.href}
      className={props.className}
      title={props.title}
      onClick={async (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey) {
          return;
        }
        e.preventDefault();

        if (isExternalHref(props.href)) {
          return await navigateNatively(props);
        }

        // Otherwise, use client-side routing
        const { pathname, hash } = new URL(props.href, location.href);
        const changePage = pathname !== location.pathname;

        if (props.prePush) {
          await navigate(props.prePush);
        }

        if (changePage) {
          await navigate(pathname);
          window.scrollTo({ top: props.backward ? maxScrollHeight() : 0 });
          await pause(50);
        }
        
        const el = document.getElementById(hash.slice(1));
        if (el) {
          const { top } = el.getBoundingClientRect();
          window.scrollBy({ top, behavior: 'smooth' });
          if (! await scrollFinished(window.pageYOffset + top)) return;
        }

        if (props.prePush && !changePage) {
          // Push hash into history if we didn't change page,
          // otherwise we'll overwrite the prePush
          navigate(hash);
          // history.pushState({}, '', hash)
        } else {
          // navigate(hash, { replace: true });
          history.replaceState({}, '', hash);
        }

        props.postPush?.();
      }}
    >
      {props.id && (
        <span id={props.id} className="anchor" />
      )}
      {props.children}
    </a>
  );
}

type Props = React.PropsWithChildren<{
  href: string;
  title?: string;
  className?: string;
  id?: string;
  /**
   * Optional path to push before navigating, so can return afterwards.
   */
  prePush?: string;
  /**
   * If true (backward) goto end of next page, then smooth scroll up.
   * If false (forward) goto start of next page, then smooth scroll down.
   */
  backward?: boolean;
  postPush?: () => void;
}>

async function navigateNatively(props: Props) {
  if (props.id) {
    const { top } = document.getElementById(props.id)!.getBoundingClientRect();
    window.scrollBy({ top, behavior: 'smooth', });
    if (! await scrollFinished(window.pageYOffset + top)) {
      return;
    }
    history.replaceState({}, '', `#${props.id}`);
  }
  location.href = props.href;
}

export function isExternalHref(href: string) {
  return /^(?:http)|(?:mailto)/.test(href);
}
