import React from 'react';
import { css, cx } from '@emotion/css';
import useSiteStore from 'store/site.store';

export default function Video({ videoKey }: Props) {

  const loadVideo = useSiteStore(x => x.browserLoad);
  const lookup = React.useMemo(() => lookupFactory(loadVideo), [loadVideo]);

  return (
    <figure className={cx("video", rootCss)}>
      <span id={videoKey} className="anchor"/>
      {lookup[videoKey]}
    </figure>
  );
}

interface Props {
  videoKey: VideoKey;
}

const rootCss = css`
  position: relative;
  display: flex;
  justify-content: center;

  > span.anchor {
    position: absolute;
    top: -48px;
  }
`;

export type VideoKey = keyof ReturnType<typeof lookupFactory>;

const lookupFactory = (loadVideo: boolean) => ({
  'video--intro-first': (
    <iframe
      width="100%"
      height="464"
      {...loadVideo && {src: "https://www.youtube.com/embed/videoseries?list=PLTcU-Qpr40X6hq3GSbY8K92DR_DUSgzim"}}
      title="YouTube video player"
      frameBorder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      loading="lazy"
    />
  ),
  'video--intro-world-tty': (
    <iframe
      width="100%"
      height="464"
      {...loadVideo && {src: "https://www.youtube.com/embed/videoseries?list=PLTcU-Qpr40X4N1FH6I6_4oJs0UCy88WKo"}}
      title="YouTube video player"
      frameBorder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      loading="lazy"
    />
  ),
  'make-boxy-svg-symbol': (
    <iframe
      width={473}
      height={840}
      src="https://www.youtube.com/embed/o0F7gPSwVgM"
      title="make boxy svg symbol mov"
      frameBorder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
    />
  ),
});
