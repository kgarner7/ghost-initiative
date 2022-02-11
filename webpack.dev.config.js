const { resolve } = require("path");

const { getThemeVariables } = require('antd/dist/theme');
const HtmlWebpackPlugin = require('html-webpack-plugin')
const { HotModuleReplacementPlugin, NoEmitOnErrorsPlugin } = require("webpack");

const hmr = "webpack-hot-middleware/client?reload=true";

const base_directory = __dirname.replace("/out/backend", "");

module.exports = {
	entry: {
		main: [hmr, resolve("client/main.tsx")],
	},
	mode: "development",
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
		filename: "js/[name][contenthash].js",
		chunkFilename: "js/[name][contenthash].js",
		path: resolve(base_directory, "out/frontend"),
		pathinfo: false,
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
			use: [
				"style-loader",
				"css-loader"
			]
		}, {
			test: /\.less$/,
			use: [{
				loader: 'style-loader',
			}, {
				loader: 'css-loader',
			}, {
				loader: 'less-loader',
	      options: {
	        lessOptions: {
	          modifyVars: getThemeVariables({ dark: true , compact: false }),
	          javascriptEnabled: true,
	        },
	      },
			}],
		}]
	},
	plugins: [
		new HotModuleReplacementPlugin(),
		new NoEmitOnErrorsPlugin(),
		new HtmlWebpackPlugin({
			template: "client/html/index.html"
		})
	],
	externals: {
		"socket.io-client": "io",
	},
	stats: { children: false }
};
