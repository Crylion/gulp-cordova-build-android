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

		const exists = fs.existsSync(androidPath);

		Promise.resolve()
			.then(() => {
				if (!exists) {
					// Add the android platform if it does not exist
					return cordova.platforms('add', 'android' + (options.version ? ('@' + options.version) : ''));
				}
			})
			.then(() => {
				if (sign) {
					const data = [];

					// Add all the options related to key signing to the array to be added to 'release-signing.properties'
					data.push('storeFile=' + options.storeFile);
					data.push('keyAlias=' + options.keyAlias);

					if (options.storePassword) {
						data.push('storePassword=' + options.storePassword);
					}

					if (options.keyPassword) {
						data.push('keyPassword=' + options.keyPassword);
					}

					if (options.storeType) {
						data.push('storeType=' + options.storeType);
					}

					// Write the release-signing.properties file
					fs.writeFileSync(path.join(androidPath, 'release-signing.properties'), data.join(os.EOL));
				}
			})
			.then(() => {
				const buildArguments = [];

				if (release) {
					// If the user wants to build for release, add the option
					buildArguments.push('--release');
				}

				if (buildMethod === 'ant') {
					buildArguments.push('--ant');
				}

				if (bundle) {
					buildArguments.push('--packageType=bundle');
				}

				// Build the platform
				return cordova.build({platforms: ['android'], options: {argv: buildArguments}});
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
