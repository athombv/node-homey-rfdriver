'use strict';

module.exports = class Scripts {

	static run(config, rootDir) {
		throw new Error(`RFDriver is no longer compatible with homey-config-composer. 
To user RFDriver you need to install the latest version of athom-cli (using 'npm i -g athom-cli')
and add '[{"id": "rf"}]' to the .homeyplugins.json file in the root of your project.
Then RFDriver will copy template files to the .homeycompose folder when you run 'athom app build' or 'athom app run'.
For more information visit https://github.com/athombv/node-athom-cli and https://github.com/athombv/node-homey-rfdriver`);
	}

};
