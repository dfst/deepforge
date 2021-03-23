/*globals define*/
define([
], function(
) {
    return {
        name: 'SciServer Compute',
        dashboard: './dashboard/index',
        configStructure: [
            {
                name: 'username',
                displayName: 'Username',
                description: 'SciServer username',
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
                name: 'computeDomain',
                displayName: 'Compute Domain',
                description: 'A small job shares resources with up to 4 other jobs and has a max quota for RAM of approx 32GB. A large job runs exclusively and has all CPU cores and RAM available (approx 240GB), however since only one large job will run at a time, there may be a longer wait for the job to start.',
                value: 'Small Jobs Domain',
                valueItems: [
                    'Small Jobs Domain',
                    'Large Jobs Domain'
                ]
            }
        ],
    };
});
