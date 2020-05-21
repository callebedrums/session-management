const path = require('path');

let config = {
    mode: 'production',
    entry: './src/index.ts',
    devtool: 'source-map',
    output: {
        path: path.resolve(__dirname, 'dist/es5'),
        filename: 'provider.min.js',
        library: 'provider',
        libraryTarget: 'umd'
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                loader: 'ts-loader',
                exclude: /node_modules/,
                options: {
                    configFile: 'tsconfig.webpack.json'
                }
            }
        ]
    },
    resolve: {
        extensions: ['.ts', '.js']
    }
};

module.exports = config;
