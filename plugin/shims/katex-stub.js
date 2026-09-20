// Lightweight no-op stub for KaTeX in the Obsidian plugin.
// KaTeX is pulled in by micromark-extension-math, but the plugin only generates
// MathJax delimiters (\(...\) and \[...\]) for Anki and does not render HTML math.
export default {
	renderToString() {
		return '';
	},
	render() {},
};
export const renderToString = () => '';
export const render = () => {};
