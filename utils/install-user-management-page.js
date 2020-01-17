const npm = require('npm');
const { promisify } = require('util');
const load = promisify(npm.load);
const install = promisify(npm.install);
const path = require('path');
const fs = require('fs');
const CONFIG_DIR = path.join(__dirname, '..', 'config');
const GIT_URL = "umesh-timalsina/user-management-page";

const installUserManagementPage = async function () {
    const configFiles = fs.readdirSync(CONFIG_DIR)
        .filter((fileName) => {
            return fileName.endsWith('.js') && fileName !== 'index.js';
        });
    const validateConfig = require('webgme/config/validator');
    const requiresInstall = configFiles.some((file) => {
        const config = require(path.join(CONFIG_DIR, file));
        validateConfig(config);
        return config.authentication.enable;
    });
    if(requiresInstall){
        console.log('Authentication Enabled, Installing ', GIT_URL);
        try{
            await load({'unsafe-perm' : true});
            await install(GIT_URL);
        } catch (e) {
            console.log('Error: Installing user management page failed with following error: ', e);
        }

    } else {
        console.log('Installing user-management-page is not required');
    }
};

module.exports = installUserManagementPage();