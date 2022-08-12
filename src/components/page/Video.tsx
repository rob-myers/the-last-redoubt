import React from 'react';
import { css, cx } from '@emotion/css';

export default function Video({ videoKey }: Props) {
  return (
    <figure className={cx("video", rootCss)}>
      <span id={videoKey} className="anchor" />
      {
        videoKey === 'intro-first-videos' && (
          <iframe
            width="100%"
            height="464"
            src="https://www.youtube.com/embed/videoseries?list=PLTcU-Qpr40X6hq3GSbY8K92DR_DUSgzim"
            title="YouTube video player"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) || null
      }
    </figure>
  );
}

interface Props {
  videoKey: (
    | 'intro-first-videos'
  );
}

const rootCss = css`
  position: relative;
  > span.anchor {
    position: absolute;
    top: -48px;
  }
`;
