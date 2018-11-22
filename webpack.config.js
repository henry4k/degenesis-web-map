'use strict';

const webpack = require('webpack');
const path = require('path');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const NodeExternals = require('webpack-node-externals');
const AutoDllPlugin = require('autodll-webpack-plugin');
const ExtractTextPlugin = require("extract-text-webpack-plugin");

function relativePath(sub) {
    return path.resolve(__dirname, sub);
}

const nodeLibs = [
    'babel-polyfill',
    'regenerator-runtime',
    'core-js',

    // mapbox-gl:
    'mapbox-gl',

    // mapbox-gl-controls:
    'mapbox-gl-controls',
    '@turf',

    // mapbox-gl-geocoder:
    '@mapbox',
    'suggestions',
    'xtend',
    'fuzzy',
    'lodash.debounce',
    'events',
    'mapbox/lib/services',
    'rest',
    'url',
    'punycode',
    'querystring',

    // mapbox-gl-draw:
    //'@mapbox/mapbox-gl-draw'
    'wgs84',
    'hat',
    'geojson-flatten',
    'traverse',
    'lodash.isequal',
    'jsonlint-lines',

    // gun:
    'gun'
];
const outputPath = relativePath('out');
const generateSourceMaps = true;
const minimize = false;

const minimizePlugins = [];
if(minimize)
    minimizePlugins.push(new webpack.optimize.UglifyJsPlugin({
        sourceMap: generateSourceMaps
    }));

const extractCssPlugin = new ExtractTextPlugin({
    filename: 'style.css'
});

module.exports = function(env) {
    return [{
        context: path.resolve(__dirname),
        target: 'web',
        node: false,
        devtool: generateSourceMaps ? 'source-map' : '',
        watchOptions: {
            ignored: relativePath('node_modules')
        },
        externals: [
            NodeExternals({
                whitelist: nodeLibs.map(name => new RegExp('^'+name))
            })
        ],
        entry: [
            'babel-polyfill',
            relativePath('src/main.js'),
            relativePath('src/index.html'),
            relativePath('src/style.css')
        ],
        output: {
            path: outputPath,
            filename: 'script.js'
            //publicPath: '/'
        },
        module: {
            rules: [
                {
                    test: [/\.js$/],
                    loader: 'babel-loader',
                    include: relativePath('src'),
                    options: {
                        presets: [
                            ['env', {
                                targets: {
                                    browsers: ['last 2 versions']
                                },
                                useBuiltIns: 'entry'
                            }]
                        ]
                    }
                },
                {
                    test: [/\.html$/],
                    use: [
                        {
                            loader: 'file-loader',
                            options: {
                                name: '[name].[ext]'
                            }
                        },
                        {
                            loader: 'extract-loader'
                        },
                        {
                            loader: 'html-loader',
                            options: {
                                minimize: minimize,
                                attrs: [
                                    'img:src'
                                ]
                            }
                        }
                    ]
                },
                {
                    test: [/\.css$/],
                    use: extractCssPlugin.extract({
                        fallback: 'style-loader',
                        use: [
                            {
                                loader: 'css-loader',
                                options: {
                                    sourceMap: generateSourceMaps,
                                    minimize: minimize
                                }
                            }
                        ]
                    })
                }
            ]
        },
        plugins: [
            new webpack.DefinePlugin({
                'process.env': {
                    'NODE_ENV': JSON.stringify(process.env.NODE_ENV),
                },
            }),
            new CleanWebpackPlugin([outputPath]),
            extractCssPlugin,
            new AutoDllPlugin({
                filename: '[name].js',
                entry: {
                    vendor: nodeLibs
                },
                plugins: minimizePlugins,
                inherit: function(mainConfig) {
                    const config = Object.assign({}, mainConfig);
                    delete config.entry;
                    delete config.output;
                    delete config.plugins;
                    return config;
                }
            })
        ].concat(minimizePlugins)
    }];
};
