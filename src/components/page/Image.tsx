import React from 'react';

export default function Image(props: Props) {
  return (
    <figure className="image">
      <img {...props} />
      <figcaption>
        {props.title}
      </figcaption>
    </figure>
  );
}

interface Props extends React.HTMLAttributes<HTMLImageElement> {}
