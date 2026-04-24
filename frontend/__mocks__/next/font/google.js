/**
 * Mock for next/font/google.
 *
 * next/font/google performs build-time font fetching that is not available
 * in the Jest test environment. This mock returns objects with the same
 * shape as the real next/font API (including .variable and .className)
 * so that layout.tsx can be imported without errors in tests.
 *
 * Each font function returns an object with:
 *   - variable: the CSS variable name (matches what was passed in options.variable)
 *   - className: a stable class name for direct usage
 *   - style: { fontFamily: '...' }
 */

function makeFont(name) {
  return function fontFactory(options) {
    const variable = (options && options.variable) ? options.variable : `--font-${name.toLowerCase()}`;
    return {
      variable: `__${name}_variable`,
      className: `__${name}_className`,
      style: { fontFamily: name },
    };
  };
}

module.exports = {
  Inter: makeFont("Inter"),
  JetBrains_Mono: makeFont("JetBrains_Mono"),
  Noto_Sans_Kannada: makeFont("Noto_Sans_Kannada"),
  Roboto: makeFont("Roboto"),
  Open_Sans: makeFont("Open_Sans"),
  Lato: makeFont("Lato"),
  Montserrat: makeFont("Montserrat"),
  Poppins: makeFont("Poppins"),
};
