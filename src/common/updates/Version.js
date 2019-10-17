/* globals define */
define([
], function(
) {
    const Version = function(versionString) {
        this.versionNumbers = versionString.trim().split('.')
            .map(version => +version);
    };

    Version.prototype.compare = function(otherVersion) {
        for (let i = 0; i < this.versionNumbers.length; i++) {
            if (this.versionNumbers[i] < otherVersion.versionNumbers[i]) {
                return -1;
            } else if (this.versionNumbers[i] > otherVersion.versionNumbers[i]) {
                return 1;
            }
        }
        return 0;
    };

    Version.prototype.lessThan = function(otherVersion) {
        return this.compare(otherVersion) === -1;
    };

    Version.prototype.equalTo = function(otherVersion) {
        return this.compare(otherVersion) === 0;
    };

    Version.prototype.greaterThan = function(otherVersion) {
        return this.compare(otherVersion) === 1;
    };

    Version.prototype.toString = function() {
        return this.versionNumbers.join('.');
    };

    return Version;
});
