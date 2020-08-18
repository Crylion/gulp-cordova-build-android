'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const through = require('through2');
const gutil = require('gulp-util');
const glob = require('glob');
const {cordova} = require('cordova-lib');

module.exports = function (options) {
	options = options || {};

	return through.obj((file, enc, cb) => {
		// Change the working directory
		process.env.PWD = file.path;

		cb();
	}, function (cb) {
		const androidPath = path.join(cordova.findProjectRoot(), 'platforms', 'android');
		const sign = options.storeFile && options.keyAlias;
		const release = options.release || sign;
		const buildMethod = options.buildMethod || process.env.ANDROID_BUILD;
		const bundle = options.bundle !== undefined ? options.bundle : false;
		const argv = options.argv !== undefined ? options.argv : [];

		const exists = fs.existsSync(androidPath);

		Promise.resolve()
			.then(() => {
				if (!exists) {
					// Add the android platform if it does not exist
					return cordova.platforms('add', 'android' + (options.version ? ('@' + options.version) : ''));
				}
			})
			.then(() => {
				const parsedOptions = {};

				if (release) {
					parsedOptions.release = true;
				}

				if (sign) {
					if (options.storeFile) {
						argv.push('--keystore=' + options.storeFile);
					}

					if (options.storePassword) {
						argv.push('--storePassword=' + options.storePassword);
					}

					if (options.keyAlias) {
						argv.push('--alias=' + options.keyAlias);
					}

					if (options.keyPassword) {
						argv.push('--password=' + options.keyPassword);
					}
				}

				if (bundle) {
					argv.push('--packageType=bundle');
				}

				// Build the platform
				return cordova.build({platforms: ['android'], options: {...parsedOptions, argv: argv}});
			})
			.then(() => {
				const apkOutputPath = buildMethod === 'ant' ? 'bin'
				: bundle ? 'app/build/outputs/bundle' : 'app/build/outputs/apk';
				const base = path.join(androidPath, apkOutputPath);
				const cwd = process.env.PWD;

				const files = glob.sync(bundle ? '**/*.aab' : '**/*.apk', {cwd: base});

				for (const file of files) {
					const filePath = path.join(base, file);

					// Push the file to the result set
					this.push(new gutil.File({
						base,
						cwd,
						path: filePath,
						contents: fs.readFileSync(path.join(base, file))
					}));
				}

				cb();
			})
			.catch(error => {
				console.error(error);
				// Return an error if something happened
				cb(new gutil.PluginError('gulp-cordova-build-android', error.message));
			});
	});
};
