// jshint node: true
'use strict';

let config = require('./config.base'),
    validateConfig = require('webgme/config/validator');
const path = require('path');
const privateKeyPath = process.env.DEEPFORGE_PRIVATE_KEY || path.join(__dirname, '..', '..', 'token_keys', 'private_key');
const publicKeyPath = process.env.DEEPFORGE_PUBLIC_KEY || path.join(__dirname, '..', '..','token_keys', 'public_key');

config.seedProjects.basePaths = ['src/seeds/project'];

config.authentication.enable = true;
config.authentication.jwt.publicKey = publicKeyPath;
config.authentication.jwt.privateKey = privateKeyPath;

config.authentication.allowGuests = true;
config.authentication.allowUserRegistration = true;
config.authentication.guestAccount = 'guest';
config.authentication.userManagementPage = 'webgme-user-management-page';

config.authentication.logInUrl = '/profile/login';
config.authentication.logOutUrl = '/profile/login';

validateConfig(config);
module.exports = config;