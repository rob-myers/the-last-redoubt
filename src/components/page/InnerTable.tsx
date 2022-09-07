import React from 'react';

export default function InnerTable(props: React.PropsWithChildren<{}>) {

  const rows = React.Children.toArray(props.children).map(row => (
    React.Children.toArray((row as any)?.props?.children)
  ).filter(Boolean)); // Ignore incorrectly formatted rows

  console.log({rows})

  return (
    <table
      style={{
        fontSize: '0.95rem',
        padding: 8,
        marginBottom: 8
      }}
    >
      <tbody>
        {rows.map((row, key) => (
          <tr key={key}>
            {row.map((col, i) => <td key={i}>{col}</td>)}
          </tr>
        ))}
        {/* <tr>
          <td>[The Night Land](https://en.wikipedia.org/wiki/The_Night_Land "@new-tab")</td>
          <td>An early sci-fi story (1912).</td>
        </tr>
        <tr>
          <td>[Theravada Buddhism](https://en.wikipedia.org/wiki/Theravada "@new-tab")</td>
          <td>The religion of the last of humanity.</td>
        </tr>
        <tr>
          <td> [Fallout 1, 2](https://en.wikipedia.org/wiki/Fallout_(video_game) "@new-tab")</td>
          <td>Oblique turn-based RPGs.</td>
        </tr> */}
      </tbody>
    </table>
  );
}
