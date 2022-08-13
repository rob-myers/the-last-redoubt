/**
 * Based on https://ntsim.uk/posts/how-to-add-vanilla-emotion-ssr-to-gatsby
 */
import { cache } from '@emotion/css';
import createEmotionServer from '@emotion/server/create-instance';
import { renderToString } from 'react-dom/server';

export { wrapPageElement } from "./src/components/page/Root";
import { localStorageKey } from "./src/projects/service/const";

export const replaceRenderer = ({ bodyComponent, setHeadComponents }) => {
  const { extractCritical } = createEmotionServer(cache);
  const { css, ids } = extractCritical(renderToString(bodyComponent));

  setHeadComponents([
    <style
      key="app-styles"
      data-emotion={`css ${ids.join(' ')}`}
      dangerouslySetInnerHTML={{ __html: css }}
    />,
  ]);
};

/**
 * @param {import('gatsby').RenderBodyArgs} arg
 */
export function onRenderBody({ setPreBodyComponents }) {
  setPreBodyComponents([
    <script key="set-dark-mode"
      dangerouslySetInnerHTML={{
        __html: `
  try {
    const darkModeEnabled = localStorage.getItem('${localStorageKey.darkModeEnabled}');
    if (darkModeEnabled === 'true') document.body.classList.add('dark-mode');
  } catch (e) {
    console.error(e)
  }
`,
    }}/>
  ]);
}