import React from "react";
import { css, cx } from "@emotion/css";

/**
 * @param {{ srcKey: 'geomorph-301' | 'redoubt-sketches' }} props 
 */
export default function Images(props) {

  if (props.srcKey === 'geomorph-301') {
    return (
      <div className={cx('scrollable', rootCss)}>
        <picture>
          <img
            draggable={false}
            src="/geomorph/g-301--bridge.debug.png"
          />
        </picture>
      </div>
    );
  }

  if (props.srcKey === 'redoubt-sketches') {
    return (
      <div
        className={cx(rootCss, css`
          background: black;
          padding: 16px;
          figure {
            filter: contrast(120%) grayscale(100%) brightness(120%);
            max-width: 800px;
            margin-bottom: 8px;
            background: #444;
            img {
              padding: 0 4px;
            }
          }
          figcaption {
            background: black;
            padding: 8px 0;
            border: 4px solid #444;
            color: #a3a3a3;
            font-size: 0.8rem;
            letter-spacing: 1px;
          }
        `)}
      >
        <figure>
          <figcaption>
            The 1st 1000 cities form a Ziggurat
          </figcaption>
          <img
            draggable={false}
            src="/pics/redoubt-sketch-1.png"
            // Providing true width and height attribs avoids vertical reflow
            width="1800"
            height="1436"
          />
        </figure>
        <figure>
          <figcaption
            title="1000 = 125 ﹡ 8"
          >
            The 1st 1000 cities span 125 floors
          </figcaption>
          <img
            draggable={false}
            src="/pics/redoubt-sketch-2.png"
            width="1978"
            height="1508"
          />
        </figure>
        <figure>
          <figcaption
            title="320 = 64 ﹡ 5"
          >
            The final 320 cities span the 64 floor Upper Pyramid
          </figcaption>
          <img
            draggable={false}
            src="/pics/redoubt-sketch-3.png"
            width="2250"
            height="1646"
          />
        </figure>
      </div>
    );
  }

  return null;
}

const rootCss = css`
  height: 100%;
  overflow-y: auto;
  figure {
    margin: 0 auto;
    figcaption, img {
      width: 100%;
    }
    img {
      animation: fadein 3s;
      height: auto;
      max-width: 100%;
    }
  }
  @keyframes fadein {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
`;
