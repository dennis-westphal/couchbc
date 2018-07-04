const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
	entry:   './app/js/app.js',
	output:  {
		path:     path.resolve(__dirname, 'build'),
		filename: 'app.js',
	},
	plugins: [
		// Copy our app's index.html to the build folder.
		new CopyWebpackPlugin([
			{from: './app/index.html', to: 'index.html'},
		]),
	],
	module:  {
		rules: [
			{
				test: /\.css$/,
				use:  ['style-loader', 'css-loader'],
			},
			{
				test:    /\.(js)|(jsx)$/,
				exclude: /(node_modules|bower_components)/,
				use:     [
					{
						loader: 'babel-loader',
					},
				],
			},
			{
				test: /\.json/,
				use:  [
					{
						loader: 'json5-loader',
					},
				],
			},
		],
	},
	resolve: {
		alias: {
			vue: 'vue/dist/vue.js',
		},
	},
};
