// Get a mongodb connection

var mongodb = require('mongodb'),
    connection;

module.exports = function(gmeConfig) {
    if (!connection) {
        connection = mongodb.MongoClient.connect(gmeConfig.mongo.uri, gmeConfig.mongo.options)
            .then(db => {
                mongo = db.collection(MONGO_COLLECTION);
                logger.debug('Connected to mongo!');
                return db;
            })
            .catch(err => {
                logger.error(`Could not connect to mongo: ${err}`);
                throw err;
            });
    }
    return connection;
};
