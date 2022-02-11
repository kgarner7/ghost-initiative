const { resolve } = require("path");

const { getThemeVariables } = require('antd/dist/theme');
const HtmlWebpackPlugin = require('html-webpack-plugin')
const TerserJSPlugin = require("terser-webpack-plugin");

module.exports = {
	entry: {
		main: [resolve("client/main.tsx")],
	},
	mode: "production",
	resolve: {
		alias: { 
      "react": "preact/compat",
      "react-dom/test-utils": "preact/test-utils",
      "react-dom": "preact/compat",
      "react/jsx-runtime": "preact/jsx-runtime"
    },
		extensions: [".js", ".jsx",".ts", ".tsx", ".json"]
	},
	output: {
		filename: "[name][contenthash].js",
		chunkFilename: "[name][contenthash].js",
		path: resolve(__dirname, "out/frontend"),
		pathinfo: false
	},
	module: {
		rules: [{
			test: /\.ts(x?)$/,
			exclude: [/node_modules/],
			use: [{
				loader: "babel-loader"
			}]
		}, {
			test: /\.css$/,
			use: ["style-loader", "css-loader"]
		}, {
			test: /\.less$/,
			use: [
				"style-loader",
				"css-loader",
				{
					loader: "less-loader",
					options: {
						lessOptions: {
							javascriptEnabled: true,
							modifyVars: getThemeVariables({
								dark: true
							}),
						}
					}
				}
			]
		}]
	},
	optimization: {
		minimize: true,
    minimizer: [new TerserJSPlugin({ parallel: true })]
	},
	plugins: [
		new HtmlWebpackPlugin({
			template: "client/html/index.html"
		})
	],
	externals: {
		"socket.io-client": "io",
	},
	stats: { children: false }
};
