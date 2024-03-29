import React from 'react';
import { css, cx } from '@emotion/css';
import LiteYouTubeEmbed from 'react-lite-youtube-embed';
import 'react-lite-youtube-embed/dist/LiteYouTubeEmbed.css'

export default function Video({ videoKey, height }: Props) {
  return (
    <figure className={cx("video", rootCss)} style={{ height }}>
      <span id={videoKey} className="anchor"/>
      {videoKey === 'cli-demo-1' && <EmbeddedVideo id="oE3tLx5fIAA" title="cli demo 1" />}
      {videoKey === 'make-boxy-svg-symbol' && <EmbeddedVideo id="o0F7gPSwVgM" title="make boxy svg symbol mov" />}
      {videoKey === 'video--intro-world-tty' && <EmbeddedVideo playlist id="PLTcU-Qpr40X4N1FH6I6_4oJs0UCy88WKo" title="intro world tty" />}
      {videoKey === 'video--intro-first' && <EmbeddedVideo playlist id="PLTcU-Qpr40X6hq3GSbY8K92DR_DUSgzim" title="intro first" />}
      {videoKey === 'first-peek-test-1' && <EmbeddedVideo id="Djc_0e5TQiY" title="first-peek-test-1" />}
      {videoKey === 'first-peek-test-2' && <EmbeddedVideo id="eAFHK-BXFLs" title="first-peek-test-2" />}
      {videoKey === 'first-peek' && <EmbeddedVideo id="Xj4S5Dyj-Ms" title="first-peek" />}
      {videoKey === 'do-all-the-things' && <EmbeddedVideo id="2rVyI9o7nug" title="first-peek" />}
    </figure>
  );
}

interface Props {
  videoKey: VideoKey;
  height?: number | string;
}

const rootCss = css`
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;

  margin: 0;
  border: 1px solid var(--page-border-color);
  background-color: black;

  > span.anchor {
    position: absolute;
    top: -48px;
  }

  article {
    width: 100%;
    height: 100%;
    background-size: contain;
    background-repeat: no-repeat;
    
    max-height: calc(100% - 128px);
    @media(max-width: 600px) {
      max-height: unset;
    }
  }

  .spacing {
    min-height: 64px;
  }
`;

export type VideoKey = (
  | 'cli-demo-1'
  | 'make-boxy-svg-symbol'
  | 'video--intro-world-tty'
  | 'video--intro-first'
  | 'first-peek-test-1'
  | 'first-peek-test-2'
  | 'first-peek'
  | 'do-all-the-things'
);

function EmbeddedVideo(props: {
  id: string;
  title: string;
  muted?: boolean;
  playlist?: boolean;
  playlistCoverId?: string;
}) {
  return (
      <LiteYouTubeEmbed
        id={props.id}
        muted={props.muted}
        playlist={props.playlist}
        playlistCoverId={props.playlistCoverId}
        title={props.title}
        poster="maxresdefault"
        webp
        params='rel=0' // restrict related to current channel (?)
      />
  );
}
