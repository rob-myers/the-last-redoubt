import React from 'react';

export default function InnerTable(props: React.PropsWithChildren<{
  style?: React.CSSProperties;
}>) {

  const rows = React.Children.toArray(props.children).map(row => (
    React.Children.toArray((row as any)?.props?.children)
  ));

  return (
    <table
      style={{
        fontSize: '0.95rem',
        padding: 8,
        marginBottom: 8,
        ...props.style,
      }}
    >
      <tbody>
        {rows.map((row, key) => (
          <tr key={key}>
            {row.map((col, i) => <td key={i}>{col}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
