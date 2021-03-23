/*global define*/
define([
    'deepforge/sciserver-auth',
], function(
    fetchToken,
) {
    const metadata = {
        name: 'SciServer Files Service',
        configStructure: [
            {
                name: 'username',
                displayName: 'Username',
                description: 'SciServer account to use',
                value: '',
                valueType: 'stringX',
                valueItemsURL: '/routers/SciServerAuth',
                extraValueItems: [
                    {
                        name: 'Link account...',
                        type: 'URL',
                        value: 'https://apps.sciserver.org/login-portal/login?callbackUrl=<%= window.location.origin %>/routers/SciServerAuth/register'
                    }
                ],
                readOnly: false,
                isAuth: true
            },
            {
                name: 'volume',
                displayName: 'Volume',
                description: 'Volume to use for upload.',
                value: 'USERNAME/deepforge_data',
                valueType: 'string',
                readOnly: false
            },
            {
                name: 'volumePool',
                displayName: 'Volume Pool',
                description: 'Folders and files in User Volumes under “Storage” will be backed up and permanent, but there is a quota limit of 10GB. Folders and files in User Volumes under “Temporary” are not backed up, and will be deleted after a particular time period.',
                value: 'Storage',
                valueItems: [
                    'Storage',
                    'Temporary'
                ]
            }
        ],
        prepare: async config => {
            const token = await fetchToken(config.username);
            config.token = token;
            return config;
        }
    };

    return metadata;
});
