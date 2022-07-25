/**
 * TODO
 * - use prismjs here
 * - remove unused props
 */
import React from "react";
import { useQuery } from "react-query";

export default function CodeEditor({
  filepath,
  code,
  lineNumbers,
  height,
  readOnly,
  wrap,
}: Props) {

  const { data: text = '' } = useQuery(filepath, async () => {
    return await code;
  });

  return (
    <textarea
      style={{ width: '100%', height: '100%' }}
      value={text}
    />
  )
}

export interface Props {
  filepath: string;
  code: string | Promise<string>;
  gridArea?: string;
  lineNumbers?: boolean;
  readOnly?: boolean;
  height: string;
  wrap?: boolean;
}
