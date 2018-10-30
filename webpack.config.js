const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const {VueLoaderPlugin} = require('vue-loader');
const ExtractTextPlugin = require('extract-text-webpack-plugin');

module.exports = {
	devtool: 'source-map',
	entry:   './app/js/app.js',
	output:  {
		path:       path.resolve(__dirname, 'public/bundles'),
		publicPath: '/bundles/',
		filename:   'app.js',
	},
	plugins: [
		// Copy our app's index.html to the build folder.
		new CopyWebpackPlugin([
			{from: './app/index.html', to: '../index.html'},
		]),
		new VueLoaderPlugin(),
		new ExtractTextPlugin('app.css'),
	],
	module:  {
		rules: [
			{
				test:    /\.scss$/,
				include: path.resolve(__dirname, 'app/scss'),
				use:     ExtractTextPlugin.extract({
					fallback: 'style-loader',
					use:      ['css-loader', 'postcss-loader', 'sass-loader'],
				}),
			},
			{
				test:    /\.css$/,
				include: path.resolve(__dirname, 'node_modules'),
				use:     ExtractTextPlugin.extract({
					fallback: 'style-loader',
					use:      ['css-loader', 'postcss-loader'],
				}),
			},
			{
				test:    /(\.js)|(\.jsx)$/,
				exclude: /(node_modules|bower_components)/,
				use:     [
					{
						loader: 'babel-loader',
					},
				],
			},
			{
				test: /\.json$/,
				use:  [
					{
						loader: 'json5-loader',
					},
				],
			},
			{
				test: /\.vue$/,
				use:  [
					{
						loader: 'vue-loader',
					},
				],
			},
			{
				test:    /(\.png)|(\.jpg)|(\.jpeg)|(\.gif)|(\.svg)|(\.ico)$/,
				include: path.resolve(__dirname, 'node_modules'),
				use:     [
					{
						loader:  'file-loader',
						options: {
							name: '../img/[name].[ext]',
						},
					},
				],
			},
			{
				test:    /(\.otf)|(\.eot)|(\.ttf)|(\.woff)|(\.svg)$/,
				exclude: path.resolve(__dirname, 'app/img'),
				use:     [
					{
						loader:  'file-loader',
						options: {
							name: '../fonts/[name].[ext]',
						},
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
