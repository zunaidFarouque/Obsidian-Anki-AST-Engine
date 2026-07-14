import { plugin } from 'bun';

plugin({
	name: 'svg-text-loader',
	setup(build) {
		build.onLoad({ filter: /\.svg$/ }, async (args) => {
			const text = await Bun.file(args.path).text();
			return {
				contents: `export default ${JSON.stringify(text)};`,
				loader: 'js',
			};
		});
	},
});
