import chalk from "chalk";
const isBrowser = typeof window !== 'undefined';

/**
 * @param  {...any} args 
 */
 export function error(...args) {
  if (isBrowser) {
    console.info('%cERROR', 'background: #ff0000', ...args);
  } else {
    console.info('ERROR', chalk.red(...args));
  }
}
/**
 * @param  {...any} args 
 */
export function info(...args) {
  if (isBrowser) {
    console.info('%cINFO', 'color: #7777ff', ...args);
  } else {
    console.info('INFO', chalk.blueBright( ...args));
  }
}
/**
 * @param  {...any} args 
 */
export function warn(...args) {
  if (isBrowser) {
    console.info('%cWARN', 'color: #ffff00', ...args);
  } else {
    console.info(chalk.yellowBright('WARN'), chalk.yellowBright(...args));
  }
}
