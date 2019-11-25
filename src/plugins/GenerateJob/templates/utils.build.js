

/*globals define*/

/*eslint-env node, browser*/

/**
 * Client module for accessing the blob.
 *
 * @author lattmann / https://github.com/lattmann
 */
define('blob/BlobConfig',[], function () {
  'use strict';

  var BlobConfig = {
    hashMethod: 'sha1',
    // TODO: in the future we may switch to sha512
    hashRegex: new RegExp('^[0-9a-f]{40}$')
  };
  return BlobConfig;
});


/*globals define*/

/*eslint-env node, browser*/

/**
 * Client module for accessing the blob.
 *
 * @author lattmann / https://github.com/lattmann
 */
define('blob/BlobMetadata',['blob/BlobConfig'], function (BlobConfig) {
  'use strict';
  /**
   * Initializes a new instance of BlobMetadata
   * @param {object} metadata - A serialized metadata object.
   * @param {string} metadata.name
   * @param {string|Object} metadata.content
   * @param {number} [metadata.size=0]
   * @param {BlobMetadata.CONTENT_TYPES} [metadata.contentType=BlobMetadata.CONTENT_TYPES.OBJECT]
   * @param {string} [metadata.mime='']
   * @param {boolean} [metadata.isPublic=false]
   * @param {string[]} [metadata.tags=[]]
   * @constructor
   * @alias BlobMetadata
   */

  var BlobMetadata = function BlobMetadata(metadata) {
    var key;

    if (metadata) {
      this.name = metadata.name;
      this.size = metadata.size || 0;
      this.mime = metadata.mime || '';
      this.isPublic = metadata.isPublic || false;
      this.tags = metadata.tags || [];
      this.content = metadata.content;
      this.contentType = metadata.contentType || BlobMetadata.CONTENT_TYPES.OBJECT;

      if (this.contentType === BlobMetadata.CONTENT_TYPES.COMPLEX) {
        for (key in this.content) {
          if (this.content.hasOwnProperty(key)) {
            if (BlobConfig.hashRegex.test(this.content[key].content) === false) {
              throw new Error('BlobMetadata is malformed: hash \'' + this.content[key].content + '\'is invalid');
            }
          }
        }
      }
    } else {
      throw new Error('metadata parameter is not defined');
    }
  };
  /**
   * Type of the metadata
   * @type {{OBJECT: string, COMPLEX: string, SOFT_LINK: string}}
   */


  BlobMetadata.CONTENT_TYPES = {
    OBJECT: 'object',
    COMPLEX: 'complex',
    SOFT_LINK: 'softLink'
  };
  /**
   * Serializes the metadata to a JSON object.
   * @returns {{
   *  name: string,
   *  size: number,
   *  mime: string,
   *  tags: Array.<string>,
   *  content: (string|Object),
   *  contentType: string}}
   */

  BlobMetadata.prototype.serialize = function () {
    var metadata = {
      name: this.name,
      size: this.size,
      mime: this.mime,
      isPublic: this.isPublic,
      tags: this.tags,
      content: this.content,
      contentType: this.contentType
    };
    metadata.tags.sort();

    if (this.contentType === BlobMetadata.CONTENT_TYPES.COMPLEX) {
      // override on  purpose to normalize content
      metadata.content = {};
      var fnames = Object.keys(this.content);
      fnames.sort();

      for (var j = 0; j < fnames.length; j += 1) {
        metadata.content[fnames[j]] = this.content[fnames[j]];
      }
    }

    return metadata;
  };

  return BlobMetadata;
});


var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

var _typeof2 = _interopRequireDefault(require("@babel/runtime/helpers/typeof"));

/*globals define*/

/*eslint-env node, browser*/

/*eslint camelcase: 0*/

/**
 * @author mmaroti / https://github.com/mmaroti
 */
(function () {
  'use strict'; // ------- assert -------

  var TASYNC_TRACE_ENABLE = true;

  function setTrace(value) {
    TASYNC_TRACE_ENABLE = value;
  }

  function assert(cond) {
    if (!cond) {
      throw new Error('tasync internal error');
    }
  } // ------- Future -------


  var STATE_LISTEN = 0;
  var STATE_REJECTED = 1;
  var STATE_RESOLVED = 2;

  var Future = function Future() {
    this.state = STATE_LISTEN;
    this.value = [];
  };

  Future.prototype.register = function (target) {
    assert(this.state === STATE_LISTEN);
    assert((0, _typeof2["default"])(target) === 'object' && target !== null);
    this.value.push(target);
  };

  Future.prototype.resolve = function (value) {
    assert(this.state === STATE_LISTEN && !(value instanceof Future));
    var listeners = this.value;
    this.state = STATE_RESOLVED;
    this.value = value;
    var i;

    for (i = 0; i < listeners.length; ++i) {
      listeners[i].onResolved(value);
    }
  };

  Future.prototype.reject = function (error) {
    assert(this.state === STATE_LISTEN && error instanceof Error);
    var listeners = this.value;
    this.state = STATE_REJECTED;
    this.value = error;
    var i;

    for (i = 0; i < listeners.length; ++i) {
      listeners[i].onRejected(error);
    }
  }; // ------- Delay -------


  function delay(timeout, value) {
    if (timeout < 0) {
      return value;
    }

    var future = new Future();
    setTimeout(function () {
      future.resolve(value);
    }, timeout);
    return future;
  } // ------- Lift -------


  var FutureLift = function FutureLift(array, index) {
    Future.call(this);
    this.array = array;
    this.index = index;
  };

  FutureLift.prototype = Object.create(Future.prototype);

  FutureLift.prototype.onResolved = function (value) {
    assert(this.state === STATE_LISTEN);
    var array = this.array;
    array[this.index] = value;

    while (++this.index < array.length) {
      value = array[this.index];

      if (value instanceof Future) {
        if (value.state === STATE_RESOLVED) {
          array[this.index] = value.value;
        } else if (value.state === STATE_LISTEN) {
          value.register(this);
          return;
        } else {
          assert(value.state === STATE_REJECTED);
          this.reject(value.value);
          return;
        }
      }
    }

    this.array = null;
    this.resolve(array);
  };

  FutureLift.prototype.onRejected = function (error) {
    this.array = null;
    this.reject(error);
  };

  var lift = function lift(array) {
    if (!(array instanceof Array)) {
      throw new Error('array argument is expected');
    }

    var index;

    for (index = 0; index < array.length; ++index) {
      var value = array[index];

      if (value instanceof Future) {
        if (value.state === STATE_RESOLVED) {
          array[index] = value.value;
        } else if (value.state === STATE_LISTEN) {
          var future = new FutureLift(array, index);
          value.register(future);
          return future;
        } else {
          assert(value.state === STATE_REJECTED);
          return value;
        }
      }
    }

    return array;
  }; // ------- Apply -------


  var ROOT = {
    subframes: 0
  };
  var FRAME = ROOT;

  var FutureApply = function tasync_trace_end(func, that, args, index) {
    Future.call(this);
    this.caller = FRAME;
    this.position = ++FRAME.subframes;
    this.subframes = 0;

    if (TASYNC_TRACE_ENABLE) {
      this.trace = new Error();
    }

    this.func = func;
    this.that = that;
    this.args = args;
    this.index = index;
  };

  FutureApply.prototype = Object.create(Future.prototype);

  FutureApply.prototype.getPath = function () {
    var future = this.caller,
        path = [this.position];

    while (future !== ROOT) {
      path.push(future.position);
      future = future.caller;
    }

    return path;
  };

  function getSlice(trace) {
    assert(typeof trace === 'string');
    var end = trace.indexOf('tasync_trace_start');

    if (end >= 0) {
      end = trace.lastIndexOf('\n', end) + 1;
    } else {
      if (trace.charAt(trace.length - 1) !== '\n') {// trace += '\n';
      }

      end = undefined;
    }

    var start = trace.indexOf('tasync_trace_end');

    if (start >= 0) {
      start = trace.indexOf('\n', start) + 1;

      if (start >= 0) {
        start = trace.indexOf('\n', start) + 1;
      }
    } else {
      start = 0;
    }

    return trace.substring(start, end);
  }

  function createError(error, future) {
    if (!(error instanceof Error)) {
      error = new Error(error);
    }

    if (TASYNC_TRACE_ENABLE) {
      error.trace = getSlice(error.stack);

      do {
        error.trace += '*** callback ***\n';
        error.trace += getSlice(future.trace.stack);
        future = future.caller;
      } while (future !== ROOT);
    }

    return error;
  }

  FutureApply.prototype.onRejected = function (error) {
    this.args = null;
    this.reject(error);
  };

  FutureApply.prototype.onResolved = function tasync_trace_start(value) {
    assert(this.state === STATE_LISTEN);
    var args = this.args;
    args[this.index] = value;

    while (--this.index >= 0) {
      value = args[this.index];

      if (value instanceof Future) {
        if (value.state === STATE_RESOLVED) {
          args[this.index] = value.value;
        } else if (value.state === STATE_LISTEN) {
          value.register(this);
          return;
        } else {
          assert(value.state === STATE_REJECTED);
          this.reject(value.value);
          return;
        }
      }
    }

    assert(FRAME === ROOT);
    FRAME = this;
    this.args = null;

    try {
      value = this.func.apply(this.that, args);
    } catch (error) {
      FRAME = ROOT;
      this.reject(createError(error, this));
      return;
    }

    FRAME = ROOT;

    if (value instanceof Future) {
      assert(value.state === STATE_LISTEN);
      this.onResolved = this.resolve;
      value.register(this);
    } else {
      this.resolve(value);
    }
  };

  var apply = function apply(func, args, that) {
    if (typeof func !== 'function') {
      throw new Error('function argument is expected');
    } else if (!(args instanceof Array)) {
      throw new Error('array argument is expected');
    }

    var index = args.length;

    while (--index >= 0) {
      var value = args[index];

      if (value instanceof Future) {
        if (value.state === STATE_LISTEN) {
          var future = new FutureApply(func, that, args, index);
          value.register(future);
          return future;
        } else if (value.state === STATE_RESOLVED) {
          args[index] = value.value;
        } else {
          assert(value.state === STATE_REJECTED);
          return value;
        }
      }
    }

    return func.apply(that, args);
  }; // ------- Call -------


  var FutureCall = function tasync_trace_end(args, index) {
    Future.call(this);
    this.caller = FRAME;
    this.position = ++FRAME.subframes;
    this.subframes = 0;

    if (TASYNC_TRACE_ENABLE) {
      this.trace = new Error();
    }

    this.args = args;
    this.index = index;
  };

  FutureCall.prototype = Object.create(Future.prototype);
  FutureCall.prototype.getPath = FutureApply.prototype.getPath;
  FutureCall.prototype.onRejected = FutureApply.prototype.onRejected;
  var FUNCTION_CALL = Function.call;

  FutureCall.prototype.onResolved = function tasync_trace_start(value) {
    assert(this.state === STATE_LISTEN);
    var args = this.args;
    args[this.index] = value;

    while (--this.index >= 0) {
      value = args[this.index];

      if (value instanceof Future) {
        if (value.state === STATE_RESOLVED) {
          args[this.index] = value.value;
        } else if (value.state === STATE_LISTEN) {
          value.register(this);
          return;
        } else {
          assert(value.state === STATE_REJECTED);
          this.reject(value.value);
          return;
        }
      }
    }

    assert(FRAME === ROOT);
    FRAME = this;
    this.args = null;

    try {
      var func = args[0];
      args[0] = null;
      value = FUNCTION_CALL.apply(func, args);
    } catch (error) {
      FRAME = ROOT;
      this.reject(createError(error, this));
      return;
    }

    FRAME = ROOT;

    if (value instanceof Future) {
      assert(value.state === STATE_LISTEN);
      this.onResolved = this.resolve;
      value.register(this);
    } else {
      this.resolve(value);
    }
  };

  var call = function call() {
    var index = arguments.length;

    while (--index >= 0) {
      var value = arguments[index];

      if (value instanceof Future) {
        if (value.state === STATE_LISTEN) {
          var future = new FutureCall(arguments, index);
          value.register(future);
          return future;
        } else if (value.state === STATE_RESOLVED) {
          arguments[index] = value.value;
        } else {
          assert(value.state === STATE_REJECTED);
          return value;
        }
      }
    }

    var func = arguments[0];
    return FUNCTION_CALL.apply(func, arguments);
  }; // ------- TryCatch -------


  function FutureTryCatch(handler) {
    Future.call(this);
    this.handler = handler;
  }

  FutureTryCatch.prototype = Object.create(Future.prototype);

  FutureTryCatch.prototype.onRejected = function (error) {
    try {
      var value = this.handler(error);

      if (value instanceof Future) {
        this.onRejected = Future.prorotype.reject;
        value.register(this);
      } else {
        this.resolve(value);
      }
    } catch (err) {
      this.reject(err);
    }
  };

  FutureTryCatch.prototype.onResolved = Future.prototype.resolve;

  function trycatch(func, handler) {
    if (typeof func !== 'function' || typeof handler !== 'function') {
      throw new Error('function arguments are expected');
    }

    try {
      var value = func();

      if (value instanceof Future) {
        var future = new FutureTryCatch(handler);
        value.register(future);
        return future;
      } else {
        return value;
      }
    } catch (error) {
      return handler(error);
    }
  } // ------- Wrap -------


  function wrap(func) {
    if (typeof func !== 'function') {
      throw new Error('function argument is expected');
    }

    if (func.tasync_wraped === undefined) {
      func.tasync_wraped = function () {
        var args = arguments;
        var future = new Future();

        args[args.length++] = function (error, value) {
          if (error) {
            future.reject(error instanceof Error ? error : new Error(error));
          } else {
            future.resolve(value);
          }
        };

        func.apply(this, args);

        if (future.state === STATE_LISTEN) {
          return future;
        } else if (future.state === STATE_RESOLVED) {
          return future.value;
        } else {
          assert(future.state === STATE_REJECTED);
          throw future.value;
        }
      };

      func.tasync_wraped.tasync_unwraped = func;
    }

    return func.tasync_wraped;
  } // ------- Unwrap -------


  function UnwrapListener(callback) {
    this.callback = callback;
  }

  UnwrapListener.prototype.onRejected = function (error) {
    this.callback(error);
  };

  UnwrapListener.prototype.onResolved = function (value) {
    this.callback(null, value);
  };

  function unwrap(func) {
    if (typeof func !== 'function') {
      throw new Error('function argument is expected');
    }

    if (func.tasync_unwraped === undefined) {
      func.tasync_unwraped = function () {
        var args = arguments;
        var callback = args[--args.length];
        assert(typeof callback === 'function');
        var value;

        try {
          value = func.apply(this, args);
        } catch (error) {
          callback(error);
          return;
        }

        if (value instanceof Future) {
          assert(value.state === STATE_LISTEN);
          var listener = new UnwrapListener(callback);
          value.register(listener);
        } else {
          callback(null, value);
        }
      };

      func.tasync_unwraped.tasync_wraped = func;
    }

    return func.tasync_unwraped;
  } // ------- Throttle -------


  function FutureThrottle(func, that, args) {
    Future.call(this);
    this.func = func;
    this.that = that;
    this.args = args;
    this.caller = FRAME;
    this.position = ++FRAME.subframes;
    this.path = this.getPath();
  }

  FutureThrottle.prototype = Object.create(Future.prototype);

  FutureThrottle.prototype.execute = function () {
    var value;

    try {
      assert(FRAME === ROOT);
      FRAME = this;
      value = this.func.apply(this.that, this.args);
      FRAME = ROOT;
    } catch (error) {
      FRAME = ROOT;
      this.reject(error);
      return;
    }

    if (value instanceof Future) {
      assert(value.state === STATE_LISTEN);
      value.register(this);
    } else {
      this.resolve(value);
    }
  };

  FutureThrottle.prototype.getPath = FutureApply.prototype.getPath;
  FutureThrottle.prototype.onResolved = Future.prototype.resolve;
  FutureThrottle.prototype.onRejected = Future.prototype.reject;

  FutureThrottle.prototype.compare = function (second) {
    var first = this.path;
    second = second.path;
    var i,
        limit = first.length < second.length ? first.length : second.length;

    for (i = 0; i < limit; ++i) {
      if (first[i] !== second[i]) {
        return first[i] - second[i];
      }
    }

    return first.length - second.length;
  };

  function ThrottleListener(limit) {
    this.running = 0;
    this.limit = limit;
    this.queue = [];
  }

  function priorityQueueInsert(queue, elem) {
    var low = 0;
    var high = queue.length;

    while (low < high) {
      var mid = Math.floor((low + high) / 2);
      assert(low <= mid && mid < high);

      if (elem.compare(queue[mid]) < 0) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    queue.splice(low, 0, elem);
  }

  ThrottleListener.prototype.execute = function (func, that, args) {
    if (this.running < this.limit) {
      var value = func.apply(that, args);

      if (value instanceof Future) {
        assert(value.state === STATE_LISTEN);
        ++this.running;
        value.register(this);
      }

      return value;
    } else {
      var future = new FutureThrottle(func, that, args);
      priorityQueueInsert(this.queue, future);
      return future;
    }
  };

  ThrottleListener.prototype.onResolved = function () {
    if (this.queue.length > 0) {
      var future = this.queue.pop();
      future.register(this);
      future.execute();
    } else {
      --this.running;
    }
  };

  ThrottleListener.prototype.onRejected = ThrottleListener.prototype.onResolved; // TODO: prevent recursion, otheriwise throttle will not work

  function throttle(func, limit) {
    if (typeof func !== 'function') {
      throw new Error('function argument is expected');
    } else if (typeof limit !== 'number') {
      throw new Error('number argument is expected');
    }

    var listener = new ThrottleListener(limit);
    return function () {
      return listener.execute(func, this, arguments);
    };
  } // ------- Join -------


  function FutureJoin(first) {
    Future.call(this);
    this.first = first;
    this.missing = first instanceof Future && first.state === STATE_LISTEN ? 1 : 0;
  }

  FutureJoin.prototype = Object.create(Future.prototype);

  FutureJoin.prototype.onResolved = function ()
  /*value*/
  {
    if (--this.missing === 0) {
      assert(this.state !== STATE_RESOLVED);

      if (this.state === STATE_LISTEN) {
        if (this.first instanceof Future) {
          assert(this.first.state === STATE_RESOLVED);
          this.resolve(this.first.value);
        } else {
          this.resolve(this.first);
        }
      }
    }
  };

  FutureJoin.prototype.onRejected = function (error) {
    if (this.state === STATE_LISTEN) {
      this.reject(error);
    }
  };

  function join(first, second) {
    if (first instanceof Future && first.state === STATE_REJECTED) {
      return first;
    } else if (second instanceof Future) {
      if (second.state === STATE_RESOLVED) {
        return first;
      } else if (second.state === STATE_REJECTED) {
        return second;
      }
    } else {
      return first;
    }

    if (!(first instanceof FutureJoin)) {
      first = new FutureJoin(first);
    }

    first.missing += 1;
    second.register(first);
    return first;
  } // ------- TASYNC -------


  var TASYNC = {
    setTrace: setTrace,
    delay: delay,
    lift: lift,
    apply: apply,
    call: call,
    trycatch: trycatch,
    wrap: wrap,
    unwrap: unwrap,
    throttle: throttle,
    join: join
  };

  if (typeof define === 'function' && define.amd) {
    define('common/core/tasync',[], function () {
      return TASYNC;
    });
  } else {
    module.exports = TASYNC;
  }
})();


/*globals define*/

/*eslint-env node, browser*/

/**
 * @author lattmann / https://github.com/lattmann
 */
define('blob/Artifact',['blob/BlobMetadata', 'blob/BlobConfig', 'common/core/tasync', 'q'], function (BlobMetadata, BlobConfig, tasync, Q) {
  'use strict';
  /**
   * Creates a new instance of artifact, i.e. complex object, in memory. This object can be saved in the blob-storage
   * on the server and later retrieved with its metadata hash.
   * @param {string} name Artifact's name without extension
   * @param {BlobClient} blobClient
   * @param {BlobMetadata} descriptor
   * @constructor
   * @alias Artifact
   */

  var Artifact = function Artifact(name, blobClient, descriptor) {
    this.name = name;
    this.blobClient = blobClient;
    this.blobClientPutFile = tasync.unwrap(tasync.throttle(tasync.wrap(blobClient.putFile), 5));
    this.blobClientGetMetadata = tasync.unwrap(tasync.throttle(tasync.wrap(blobClient.getMetadata), 5)); // TODO: use BlobMetadata class here

    this.descriptor = descriptor || {
      name: name + '.zip',
      size: 0,
      mime: 'application/zip',
      content: {},
      contentType: 'complex'
    }; // name and hash pairs
  };
  /**
   * Adds content to the artifact as a file.
   * @param {string} name - filename
   * @param {Blob} content - File object or Blob.
   * @param {function} [callback] - if provided no promise will be returned.
   *
   * @return {external:Promise}  On success the promise will be resolved with {string} <b>metadataHash</b>.<br>
   * On error the promise will be rejected with {@link Error} <b>error</b>.
   */


  Artifact.prototype.addFile = function (name, content, callback) {
    var self = this,
        filename = name.substring(name.lastIndexOf('/') + 1),
        deferred = Q.defer();
    self.blobClientPutFile.call(self.blobClient, filename, content, function (err, metadataHash) {
      if (err) {
        deferred.reject(err);
        return;
      }

      self.addObjectHash(name, metadataHash, function (err, metadataHash) {
        if (err) {
          deferred.reject(err);
          return;
        }

        deferred.resolve(metadataHash);
      });
    });
    return deferred.promise.nodeify(callback);
  };
  /**
   * Adds files as soft-link.
   * @param {string} name - filename.
   * @param {Blob} content - File object or Blob.
   * @param {function} [callback] - if provided no promise will be returned.
   *
   * @return {external:Promise}  On success the promise will be resolved with {string} <b>metadataHash</b>.<br>
   * On error the promise will be rejected with {@link Error} <b>error</b>.
   */


  Artifact.prototype.addFileAsSoftLink = function (name, content, callback) {
    var deferred = Q.defer(),
        self = this,
        filename = name.substring(name.lastIndexOf('/') + 1);
    self.blobClientPutFile.call(self.blobClient, filename, content, function (err, metadataHash) {
      if (err) {
        deferred.reject(err);
        return;
      }

      var size;

      if (content.size !== undefined) {
        size = content.size;
      }

      if (content.length !== undefined) {
        size = content.length;
      }

      self.addMetadataHash(name, metadataHash, size).then(deferred.resolve)["catch"](deferred.reject);
    });
    return deferred.promise.nodeify(callback);
  };
  /**
   * Adds a hash to the artifact using the given file path.
   * @param {string} name - Path to the file in the artifact. Note: 'a/b/c.txt'
   * @param {string} metadataHash - Metadata hash that has to be added.
   * @param {function} [callback] - if provided no promise will be returned.
   *
   * @return {external:Promise}  On success the promise will be resolved with {string} <b>hash</b>.<br>
   * On error the promise will be rejected with {@link Error} <b>error</b>.
   */


  Artifact.prototype.addObjectHash = function (name, metadataHash, callback) {
    var self = this,
        deferred = Q.defer();

    if (BlobConfig.hashRegex.test(metadataHash) === false) {
      deferred.reject('Blob hash is invalid');
    } else {
      self.blobClientGetMetadata.call(self.blobClient, metadataHash, function (err, metadata) {
        if (err) {
          deferred.reject(err);
          return;
        }

        if (self.descriptor.content.hasOwnProperty(name)) {
          deferred.reject(new Error('Another content with the same name was already added. ' + JSON.stringify(self.descriptor.content[name])));
        } else {
          self.descriptor.size += metadata.size;
          self.descriptor.content[name] = {
            content: metadata.content,
            contentType: BlobMetadata.CONTENT_TYPES.OBJECT
          };
          deferred.resolve(metadataHash);
        }
      });
    }

    return deferred.promise.nodeify(callback);
  };
  /**
   * Adds a hash to the artifact using the given file path.
   * @param {string} name - Path to the file in the artifact. Note: 'a/b/c.txt'
   * @param {string} metadataHash - Metadata hash that has to be added.
   * @param {number} [size] - Size of the referenced blob.
   * @param {function} [callback] - if provided no promise will be returned.
   *
   * @return {external:Promise}  On success the promise will be resolved with {string} <b>hash</b>.<br>
   * On error the promise will be rejected with {@link Error} <b>error</b>.
   */


  Artifact.prototype.addMetadataHash = function (name, metadataHash, size, callback) {
    var self = this,
        deferred = Q.defer(),
        addMetadata = function addMetadata(size) {
      if (self.descriptor.content.hasOwnProperty(name)) {
        deferred.reject(new Error('Another content with the same name was already added. ' + JSON.stringify(self.descriptor.content[name])));
      } else {
        self.descriptor.size += size;
        self.descriptor.content[name] = {
          content: metadataHash,
          contentType: BlobMetadata.CONTENT_TYPES.SOFT_LINK
        };
        deferred.resolve(metadataHash);
      }
    };

    if (typeof size === 'function') {
      callback = size;
      size = undefined;
    }

    if (BlobConfig.hashRegex.test(metadataHash) === false) {
      deferred.reject(new Error('Blob hash is invalid'));
    } else if (size === undefined) {
      self.blobClientGetMetadata.call(self.blobClient, metadataHash, function (err, metadata) {
        if (err) {
          deferred.reject(err);
          return;
        }

        addMetadata(metadata.size);
      });
    } else {
      addMetadata(size);
    }

    return deferred.promise.nodeify(callback);
  };
  /**
   * Adds multiple files.
   * @param {Object.<string, Blob>} files files to add
   * @param {function} [callback] - if provided no promise will be returned.
   *
   * @return {external:Promise}  On success the promise will be resolved with {string[]} <b>metadataHashes</b>.<br>
   * On error the promise will be rejected with {@link Error|string} <b>error</b>.
   */


  Artifact.prototype.addFiles = function (files, callback) {
    var self = this,
        fileNames = Object.keys(files);
    return Q.all(fileNames.map(function (fileName) {
      return self.addFile(fileName, files[fileName]);
    })).nodeify(callback);
  };
  /**
   * Adds multiple files as soft-links.
   * @param {Object.<string, Blob>} files files to add
   * @param {function} [callback] - if provided no promise will be returned.
   *
   * @return {external:Promise}  On success the promise will be resolved with {string[]} <b>metadataHashes</b>.<br>
   * On error the promise will be rejected with {@link Error} <b>error</b>.
   */


  Artifact.prototype.addFilesAsSoftLinks = function (files, callback) {
    var self = this,
        fileNames = Object.keys(files);
    return Q.all(fileNames.map(function (fileName) {
      return self.addFileAsSoftLink(fileName, files[fileName]);
    })).nodeify(callback);
  };
  /**
   * Adds hashes to the artifact using the given file paths.
   * @param {object.<string, string>} metadataHashes - Keys are file paths and values metadata hashes.
   * @param {function} [callback] - if provided no promise will be returned.
   *
   * @return {external:Promise}  On success the promise will be resolved with {string[]} <b>hashes</b>.<br>
   * On error the promise will be rejected with {@link Error} <b>error</b>.
   */


  Artifact.prototype.addObjectHashes = function (metadataHashes, callback) {
    var self = this,
        fileNames = Object.keys(metadataHashes);
    return Q.all(fileNames.map(function (fileName) {
      return self.addObjectHash(fileName, metadataHashes[fileName]);
    })).nodeify(callback);
  };
  /**
   * Adds hashes to the artifact using the given file paths.
   * @param {object.<string, string>} metadataHashes - Keys are file paths and values metadata hashes.
   * @param {function} [callback] - if provided no promise will be returned.
   *
   * @return {external:Promise}  On success the promise will be resolved with {string[]} <b>hashes</b>.<br>
   * On error the promise will be rejected with {@link Error} <b>error</b>.
   */


  Artifact.prototype.addMetadataHashes = function (metadataHashes, callback) {
    var self = this,
        fileNames = Object.keys(metadataHashes);
    return Q.all(fileNames.map(function (fileName) {
      return self.addMetadataHash(fileName, metadataHashes[fileName]);
    })).nodeify(callback);
  };
  /**
   * Saves this artifact and uploads the metadata to the server's storage.
   * @param {function} [callback] - if provided no promise will be returned.
   *
   * @return {external:Promise}  On success the promise will be resolved with {string} <b>metadataHash</b>.<br>
   * On error the promise will be rejected with {@link Error} <b>error</b>.
   */


  Artifact.prototype.save = function (callback) {
    var deferred = Q.defer();
    this.blobClient.putMetadata(this.descriptor, function (err, hash) {
      if (err) {
        deferred.reject(err);
      } else {
        deferred.resolve(hash);
      }
    });
    return deferred.promise.nodeify(callback);
  };

  return Artifact;
});


/*globals define*/

/*eslint-env node, browser*/

/**
 * @author kecso / https://github.com/kecso
 */
define('common/util/uint',[],function () {
  'use strict'; //this helper function is necessary as in case of large json objects,
  // the library standard function causes stack overflow

  function uint8ArrayToString(uintArray) {
    var resultString = '',
        i;

    for (i = 0; i < uintArray.byteLength; i++) {
      resultString += String.fromCharCode(uintArray[i]);
    }

    return decodeURIComponent(escape(resultString));
  }

  return {
    uint8ArrayToString: uint8ArrayToString
  };
});


var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

var _typeof2 = _interopRequireDefault(require("@babel/runtime/helpers/typeof"));

/*globals define, Uint8Array, ArrayBuffer*/

/*eslint-env node, browser*/

/**
 * Client module for accessing the blob.
 *
 * @author lattmann / https://github.com/lattmann
 * @author ksmyth / https://github.com/ksmyth
 */
define('blob/BlobClient',['blob/Artifact', 'blob/BlobMetadata', 'superagent', 'q', 'common/util/uint'], function (Artifact, BlobMetadata, superagent, Q, UINT) {
  'use strict';
  /**
   * Client to interact with the blob-storage. <br>
   *
   * @param {object} parameters
   * @param {object} parameters.logger
   * @constructor
   * @alias BlobClient
   */

  var BlobClient = function BlobClient(parameters) {
    var self = this; // Store these to be able to create a new instance from an instance.

    this.parameters = parameters;
    this.artifacts = [];

    if (parameters && parameters.logger) {
      this.logger = parameters.logger;
    } else {
      /*eslint-disable no-console*/
      var doLog = function doLog() {
        console.log.apply(console, arguments);
      };

      this.logger = {
        debug: doLog,
        log: doLog,
        info: doLog,
        warn: doLog,
        error: doLog
      };
      console.warn('Since v1.3.0 BlobClient requires a logger, falling back on console.log.');
      /*eslint-enable no-console*/
    }

    if (parameters && parameters.uploadProgressHandler) {
      this.uploadProgressHandler = parameters.uploadProgressHandler;
    } else {
      this.uploadProgressHandler = function (fName, e) {
        self.logger.debug('File upload of', fName, e.percent, '%');
      };
    }

    this.logger.debug('ctor', {
      metadata: parameters
    });

    if (parameters) {
      this.server = parameters.server || this.server;
      this.serverPort = parameters.serverPort || this.serverPort;
      this.httpsecure = parameters.httpsecure !== undefined ? parameters.httpsecure : this.httpsecure;
      this.webgmeToken = parameters.webgmeToken;
      this.keepaliveAgentOptions = parameters.keepaliveAgentOptions || {
        /* use defaults */
      };
    } else {
      this.keepaliveAgentOptions = {
        /* use defaults */
      };
    }

    this.origin = '';

    if (this.httpsecure !== undefined && this.server && this.serverPort) {
      this.origin = (this.httpsecure ? 'https://' : 'http://') + this.server + ':' + this.serverPort;
    }

    this.relativeUrl = '/rest/blob/';
    this.blobUrl = this.origin + this.relativeUrl;
    this.isNodeOrNodeWebKit = typeof process !== 'undefined';

    if (this.isNodeOrNodeWebKit) {
      // node or node-webkit
      this.logger.debug('Running under node or node-web-kit');

      if (this.httpsecure) {
        this.Agent = require('agentkeepalive').HttpsAgent;
      } else {
        this.Agent = require('agentkeepalive');
      }

      if (this.keepaliveAgentOptions.hasOwnProperty('ca') === false) {
        this.keepaliveAgentOptions.ca = require('https').globalAgent.options.ca;
      }

      this.keepaliveAgent = new this.Agent(this.keepaliveAgentOptions);
    }

    this.logger.debug('origin', this.origin);
    this.logger.debug('blobUrl', this.blobUrl);
  };
  /**
   * Creates and returns a new instance of a BlobClient with the same settings as the current one.
   * This can be used to avoid issues with the artifacts being book-kept at the instance.
   * @returns {BlobClient} A new instance of a BlobClient
   */


  BlobClient.prototype.getNewInstance = function () {
    return new BlobClient(this.parameters);
  };

  BlobClient.prototype.getMetadataURL = function (hash) {
    return this.origin + this.getRelativeMetadataURL(hash);
  };

  BlobClient.prototype.getRelativeMetadataURL = function (hash) {
    var metadataBase = this.relativeUrl + 'metadata';

    if (hash) {
      return metadataBase + '/' + hash;
    } else {
      return metadataBase;
    }
  };

  BlobClient.prototype._getURL = function (base, hash, subpath) {
    var subpathURL = '';

    if (subpath) {
      subpathURL = subpath;
    }

    return this.relativeUrl + base + '/' + hash + '/' + encodeURIComponent(subpathURL);
  };

  BlobClient.prototype.getViewURL = function (hash, subpath) {
    return this.origin + this.getRelativeViewURL(hash, subpath);
  };

  BlobClient.prototype.getRelativeViewURL = function (hash, subpath) {
    return this._getURL('view', hash, subpath);
  };
  /**
   * Returns the get-url for downloading a blob.
   * @param {string} metadataHash
   * @param {string} [subpath] - optional file-like path to sub-object if complex blob
   * @return {string} get-url for blob
   */


  BlobClient.prototype.getDownloadURL = function (metadataHash, subpath) {
    return this.origin + this.getRelativeDownloadURL(metadataHash, subpath);
  };

  BlobClient.prototype.getRelativeDownloadURL = function (hash, subpath) {
    return this._getURL('download', hash, subpath);
  };

  BlobClient.prototype.getCreateURL = function (filename, isMetadata) {
    return this.origin + this.getRelativeCreateURL(filename, isMetadata);
  };

  BlobClient.prototype.getRelativeCreateURL = function (filename, isMetadata) {
    if (isMetadata) {
      return this.relativeUrl + 'createMetadata/';
    } else {
      return this.relativeUrl + 'createFile/' + encodeURIComponent(filename);
    }
  };
  /**
   * Adds a file to the blob storage.
   * @param {string} name - file name.
   * @param {string|Buffer|ArrayBuffer} data - file content.
   * @param {function} [callback] - if provided no promise will be returned.
   *
   * @return {external:Promise} On success the promise will be resolved with {string} <b>metadataHash</b>.<br>
   * On error the promise will be rejected with {@link Error} <b>error</b>.
   */


  BlobClient.prototype.putFile = function (name, data, callback) {
    var deferred = Q.defer(),
        self = this,
        contentLength,
        req;
    this.logger.debug('putFile', name);

    function toArrayBuffer(buffer) {
      var ab = new ArrayBuffer(buffer.length),
          view = new Uint8Array(ab);

      for (var i = 0; i < buffer.length; ++i) {
        view[i] = buffer[i];
      }

      return ab;
    } // On node-webkit, we use XMLHttpRequest, but xhr.send thinks a Buffer is a string and encodes it in utf-8 -
    // send an ArrayBuffer instead.


    if (typeof window !== 'undefined' && typeof Buffer !== 'undefined' && data instanceof Buffer) {
      data = toArrayBuffer(data); // FIXME will this have performance problems
    } // on node, empty Buffers will cause a crash in superagent


    if (typeof window === 'undefined' && typeof Buffer !== 'undefined' && data instanceof Buffer) {
      if (data.length === 0) {
        data = '';
      }
    }

    contentLength = data.hasOwnProperty('length') ? data.length : data.byteLength;
    req = superagent.post(this.getCreateURL(name));

    if (typeof window === 'undefined') {
      req.agent(this.keepaliveAgent);
    }

    if (this.webgmeToken) {
      req.set('Authorization', 'Bearer ' + this.webgmeToken);
    }

    if (typeof data !== 'string' && !(data instanceof String) && typeof window === 'undefined') {
      req.set('Content-Length', contentLength);
    }

    req.set('Content-Type', 'application/octet-stream').send(data).on('progress', function (event) {
      self.uploadProgressHandler(name, event);
    }).end(function (err, res) {
      if (err || res.status > 399) {
        deferred.reject(err || new Error(res.status));
        return;
      }

      var response = res.body; // Get the first one

      var hash = Object.keys(response)[0];
      self.logger.debug('putFile - result', hash);
      deferred.resolve(hash);
    });
    return deferred.promise.nodeify(callback);
  };

  BlobClient.prototype.putMetadata = function (metadataDescriptor, callback) {
    var metadata = new BlobMetadata(metadataDescriptor),
        deferred = Q.defer(),
        self = this,
        blob,
        contentLength,
        req; // FIXME: in production mode do not indent the json file.

    this.logger.debug('putMetadata', {
      metadata: metadataDescriptor
    });

    if (typeof Blob !== 'undefined') {
      blob = new Blob([JSON.stringify(metadata.serialize(), null, 4)], {
        type: 'text/plain'
      });
      contentLength = blob.size;
    } else {
      blob = new Buffer(JSON.stringify(metadata.serialize(), null, 4), 'utf8');
      contentLength = blob.length;
    }

    req = superagent.post(this.getCreateURL(metadataDescriptor.name, true));

    if (this.webgmeToken) {
      req.set('Authorization', 'Bearer ' + this.webgmeToken);
    }

    if (typeof window === 'undefined') {
      req.agent(this.keepaliveAgent);
      req.set('Content-Length', contentLength);
    }

    req.set('Content-Type', 'application/octet-stream').send(blob).end(function (err, res) {
      if (err || res.status > 399) {
        deferred.reject(err || new Error(res.status));
        return;
      } // Uploaded.


      var response = JSON.parse(res.text); // Get the first one

      var hash = Object.keys(response)[0];
      self.logger.debug('putMetadata - result', hash);
      deferred.resolve(hash);
    });
    return deferred.promise.nodeify(callback);
  };
  /**
   * Adds multiple files to the blob storage.
   * @param {object.<string, string|Buffer|ArrayBuffer>} o - Keys are file names and values the content.
   * @param {function} [callback] - if provided no promise will be returned.
   *
   * @return {external:Promise} On success the promise will be resolved with {object}
   * <b>fileNamesToMetadataHashes</b>.<br>
   * On error the promise will be rejected with {@link Error} <b>error</b>.
   */


  BlobClient.prototype.putFiles = function (o, callback) {
    var self = this,
        deferred = Q.defer(),
        error,
        filenames = Object.keys(o),
        remaining = filenames.length,
        hashes = {},
        putFile;

    if (remaining === 0) {
      deferred.resolve(hashes);
    }

    putFile = function putFile(filename, data) {
      self.putFile(filename, data, function (err, hash) {
        remaining -= 1;
        hashes[filename] = hash;

        if (err) {
          error = err;
          self.logger.error('putFile failed with error', {
            metadata: err
          });
        }

        if (remaining === 0) {
          if (error) {
            deferred.reject(error);
          } else {
            deferred.resolve(hashes);
          }
        }
      });
    };

    for (var j = 0; j < filenames.length; j += 1) {
      putFile(filenames[j], o[filenames[j]]);
    }

    return deferred.promise.nodeify(callback);
  };

  BlobClient.prototype.getSubObject = function (hash, subpath, callback) {
    return this.getObject(hash, callback, subpath);
  };
  /**
   * Retrieves object from blob storage as a Buffer under node and as an ArrayBuffer in the client.
   * N.B. if the retrieved file is a json-file and running in a browser, the content will be decoded and
   * the string parsed as a JSON.
   * @param {string} metadataHash - hash of metadata for object.
   * @param {function} [callback] - if provided no promise will be returned.
   * @param {string} [subpath] - optional file-like path to sub-object if complex blob
   *
   * @return {external:Promise} On success the promise will be resolved with {Buffer|ArrayBuffer|object}
   * <b>content</b>.<br>
   * On error the promise will be rejected with {@link Error} <b>error</b>.
   */


  BlobClient.prototype.getObject = function (metadataHash, callback, subpath) {
    var deferred = Q.defer(),
        self = this;
    this.logger.debug('getObject', metadataHash, subpath);

    superagent.parse['application/zip'] = function (obj, parseCallback) {
      if (parseCallback) {// Running on node; this should be unreachable due to req.pipe() below
      } else {
        return obj;
      }
    }; //superagent.parse['application/json'] = superagent.parse['application/zip'];


    var req = superagent.get(this.getViewURL(metadataHash, subpath));

    if (this.webgmeToken) {
      req.set('Authorization', 'Bearer ' + this.webgmeToken);
    }

    if (typeof window === 'undefined') {
      // running on node
      req.agent(this.keepaliveAgent);

      var Writable = require('stream').Writable;

      var BuffersWritable = function BuffersWritable(options) {
        Writable.call(this, options);
        var self = this;
        self.buffers = [];
      };

      require('util').inherits(BuffersWritable, Writable);

      BuffersWritable.prototype._write = function (chunk, encoding, cb) {
        this.buffers.push(chunk);
        cb();
      };

      var buffers = new BuffersWritable();
      buffers.on('finish', function () {
        if (req.req.res.statusCode > 399) {
          deferred.reject(new Error(req.req.res.statusCode));
        } else {
          deferred.resolve(Buffer.concat(buffers.buffers));
        }
      });
      buffers.on('error', function (err) {
        deferred.reject(err);
      });
      req.pipe(buffers);
    } else {
      req.removeAllListeners('end');
      req.on('request', function () {
        if (typeof this.xhr !== 'undefined') {
          this.xhr.responseType = 'arraybuffer';
        }
      }); // req.on('error', callback);

      req.on('end', function () {
        if (req.xhr.status > 399) {
          deferred.reject(new Error(req.xhr.status));
        } else {
          var contentType = req.xhr.getResponseHeader('content-type');
          var response = req.xhr.response; // response is an arraybuffer

          if (contentType === 'application/json') {
            response = JSON.parse(UINT.uint8ArrayToString(new Uint8Array(response)));
          }

          self.logger.debug('getObject - result', {
            metadata: response
          });
          deferred.resolve(response);
        }
      }); // TODO: Why is there an end here too? Isn't req.on('end',..) enough?

      req.end(function (err, result) {
        if (err) {
          deferred.reject(err);
        } else {
          self.logger.debug('getObject - result', {
            metadata: result
          });
          deferred.resolve(result);
        }
      });
    }

    return deferred.promise.nodeify(callback);
  };
  /**
   * If running under nodejs and getting large objects use this method to pipe the downloaded
   * object to your provided writeStream.
   * @example
   * // Piping object to the filesystem..
   * var writeStream = fs.createWriteStream('my.zip');
   *
   * writeStream.on('error', function (err) {
   *   // handle error
   * });
   *
   * writeStream.on('finish', function () {
   *   // my.zip exists at this point
   * });
   *
   * blobClient.getStreamObject(metadataHash, writeStream);
   *
   * @param {string} metadataHash - hash of metadata for object.
   * @param {stream.Writable} writeStream - stream the requested data will be piped to.
   * @param {string} [subpath] - optional file-like path to sub-object if complex blob
   */


  BlobClient.prototype.getStreamObject = function (metadataHash, writeStream, subpath) {
    this.logger.debug('getStreamObject', metadataHash, subpath);
    var req = superagent.get(this.getViewURL(metadataHash, subpath));

    if (this.webgmeToken) {
      req.set('Authorization', 'Bearer ' + this.webgmeToken);
    }

    if (typeof Buffer !== 'undefined') {
      // running on node
      req.agent(this.keepaliveAgent);
      req.pipe(writeStream);
    } else {
      throw new Error('streamObject only supported under nodejs, use getObject instead.');
    }
  };
  /**
   * Retrieves object from blob storage and parses the content as a string.
   * @param {string} metadataHash - hash of metadata for object.
   * @param {function} [callback] - if provided no promise will be returned.
   *
   * @return {external:Promise} On success the promise will be resolved with {string} <b>contentString</b>.<br>
   * On error the promise will be rejected with {@link Error} <b>error</b>.
   */


  BlobClient.prototype.getObjectAsString = function (metadataHash, callback) {
    var self = this;
    return self.getObject(metadataHash).then(function (content) {
      if (typeof content === 'string') {
        // This does currently not happen..
        return content;
      } else if (typeof Buffer !== 'undefined' && content instanceof Buffer) {
        return UINT.uint8ArrayToString(new Uint8Array(content));
      } else if (content instanceof ArrayBuffer) {
        return UINT.uint8ArrayToString(new Uint8Array(content));
      } else if (content !== null && (0, _typeof2["default"])(content) === 'object') {
        return JSON.stringify(content);
      } else {
        throw new Error('Unknown content encountered: ' + content);
      }
    }).nodeify(callback);
  };
  /**
   * Retrieves object from blob storage and parses the content as a JSON. (Will resolve with error if not valid JSON.)
   * @param {string} metadataHash - hash of metadata for object.
   * @param {function} [callback] - if provided no promise will be returned.
   *
   * @return {external:Promise} On success the promise will be resolved with {object} <b>contentJSON</b>.<br>
   * On error the promise will be rejected with {@link Error} <b>error</b>.
   */


  BlobClient.prototype.getObjectAsJSON = function (metadataHash, callback) {
    var self = this;
    return self.getObject(metadataHash).then(function (content) {
      if (typeof content === 'string') {
        // This does currently not happen..
        return JSON.parse(content);
      } else if (typeof Buffer !== 'undefined' && content instanceof Buffer) {
        return JSON.parse(UINT.uint8ArrayToString(new Uint8Array(content)));
      } else if (content instanceof ArrayBuffer) {
        return JSON.parse(UINT.uint8ArrayToString(new Uint8Array(content)));
      } else if (content !== null && (0, _typeof2["default"])(content) === 'object') {
        return content;
      } else {
        throw new Error('Unknown content encountered: ' + content);
      }
    }).nodeify(callback);
  };
  /**
   * Retrieves metadata from blob storage.
   * @param {string} metadataHash - hash of metadata.
   * @param {function} [callback] - if provided no promise will be returned.
   *
   * @return {external:Promise} On success the promise will be resolved with {object} <b>metadata</b>.<br>
   * On error the promise will be rejected with {@link Error} <b>error</b>.
   */


  BlobClient.prototype.getMetadata = function (metadataHash, callback) {
    var req = superagent.get(this.getMetadataURL(metadataHash)),
        deferred = Q.defer(),
        self = this;
    this.logger.debug('getMetadata', metadataHash);

    if (this.webgmeToken) {
      req.set('Authorization', 'Bearer ' + this.webgmeToken);
    }

    if (typeof window === 'undefined') {
      req.agent(this.keepaliveAgent);
    }

    req.end(function (err, res) {
      if (err || res.status > 399) {
        deferred.reject(err || new Error(res.status));
      } else {
        self.logger.debug('getMetadata', res.text);
        deferred.resolve(JSON.parse(res.text));
      }
    });
    return deferred.promise.nodeify(callback);
  };
  /**
   * Creates a new artifact and adds it to array of artifacts of the instance.
   * @param {string} name - Name of artifact
   * @return {Artifact}
   */


  BlobClient.prototype.createArtifact = function (name) {
    var artifact = new Artifact(name, this);
    this.artifacts.push(artifact);
    return artifact;
  };
  /**
   * Retrieves the {@link Artifact} from the blob storage.
   * @param {hash} metadataHash - hash associated with the artifact.
   * @param {function} [callback] - if provided no promise will be returned.
   *
   * @return {external:Promise}  On success the promise will be resolved with
   * {@link Artifact} <b>artifact</b>.<br>
   * On error the promise will be rejected with {@link Error} <b>error</b>.
   */


  BlobClient.prototype.getArtifact = function (metadataHash, callback) {
    // TODO: get info check if complex flag is set to true.
    // TODO: get info get name.
    var self = this,
        deferred = Q.defer();
    this.logger.debug('getArtifact', metadataHash);
    this.getMetadata(metadataHash, function (err, info) {
      if (err) {
        deferred.reject(err);
        return;
      }

      self.logger.debug('getArtifact - return', {
        metadata: info
      });

      if (info.contentType === BlobMetadata.CONTENT_TYPES.COMPLEX) {
        var artifact = new Artifact(info.name, self, info);
        self.artifacts.push(artifact);
        deferred.resolve(artifact);
      } else {
        deferred.reject(new Error('not supported contentType ' + JSON.stringify(info, null, 4)));
      }
    });
    return deferred.promise.nodeify(callback);
  };
  /**
   * Saves all the artifacts associated with the current instance.
   * @param {function} [callback] - if provided no promise will be returned.
   *
   * @return {external:Promise}  On success the promise will be resolved with
   * {string[]} <b>artifactHashes</b> (metadataHashes).<br>
   * On error the promise will be rejected with {@link Error} <b>error</b>.
   */


  BlobClient.prototype.saveAllArtifacts = function (callback) {
    var promises = [];

    for (var i = 0; i < this.artifacts.length; i += 1) {
      promises.push(this.artifacts[i].save());
    }

    return Q.all(promises).nodeify(callback);
  };
  /**
   * Converts bytes to a human readable string.
   * @param {number} - File size in bytes.
   * @param {boolean} [si] - If true decimal conversion will be used (by default binary is used).
   * @returns {string}
   */


  BlobClient.prototype.getHumanSize = function (bytes, si) {
    var thresh = si ? 1000 : 1024,
        units = si ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'] : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'],
        u = -1;

    if (bytes < thresh) {
      return bytes + ' B';
    }

    do {
      bytes = bytes / thresh;
      u += 1;
    } while (bytes >= thresh);

    return bytes.toFixed(1) + ' ' + units[u];
  };

  BlobClient.prototype.setToken = function (token) {
    this.webgmeToken = token;
  };

  return BlobClient;
});


var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));

/* globals define */
define('deepforge/storage/backends/StorageBackend',[], function () {
  var StorageBackend = function StorageBackend(id, metadata) {
    var name = metadata.name,
        client = metadata.client;
    this.id = id;
    this.name = name;
    this.clientPath = client || './Client';
  };

  StorageBackend.prototype.getClient = function _callee(logger, config) {
    var Client;
    return _regenerator["default"].async(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            _context.next = 2;
            return _regenerator["default"].awrap(this.require("deepforge/storage/backends/".concat(this.id, "/").concat(this.clientPath)));

          case 2:
            Client = _context.sent;
            return _context.abrupt("return", new Client(this.id, this.name, logger, config));

          case 4:
          case "end":
            return _context.stop();
        }
      }
    }, null, this);
  };

  StorageBackend.prototype.require = function (path) {
    // helper for loading async
    return new Promise(function (resolve, reject) {
      return require([path], resolve, reject);
    });
  };

  return StorageBackend;
});


/**
 * @license text 2.0.16 Copyright jQuery Foundation and other contributors.
 * Released under MIT license, http://github.com/requirejs/text/LICENSE
 */

/*jslint regexp: true */

/*global require, XMLHttpRequest, ActiveXObject,
  define, window, process, Packages,
  java, location, Components, FileUtils */
define('text',['module'], function (module) {
  'use strict';

  var text,
      fs,
      Cc,
      Ci,
      xpcIsWindows,
      progIds = ['Msxml2.XMLHTTP', 'Microsoft.XMLHTTP', 'Msxml2.XMLHTTP.4.0'],
      xmlRegExp = /^\s*<\?xml(\s)+version=[\'\"](\d)*.(\d)*[\'\"](\s)*\?>/im,
      bodyRegExp = /<body[^>]*>\s*([\s\S]+)\s*<\/body>/im,
      hasLocation = typeof location !== 'undefined' && location.href,
      defaultProtocol = hasLocation && location.protocol && location.protocol.replace(/\:/, ''),
      defaultHostName = hasLocation && location.hostname,
      defaultPort = hasLocation && (location.port || undefined),
      buildMap = {},
      masterConfig = module.config && module.config() || {};

  function useDefault(value, defaultValue) {
    return value === undefined || value === '' ? defaultValue : value;
  } //Allow for default ports for http and https.


  function isSamePort(protocol1, port1, protocol2, port2) {
    if (port1 === port2) {
      return true;
    } else if (protocol1 === protocol2) {
      if (protocol1 === 'http') {
        return useDefault(port1, '80') === useDefault(port2, '80');
      } else if (protocol1 === 'https') {
        return useDefault(port1, '443') === useDefault(port2, '443');
      }
    }

    return false;
  }

  text = {
    version: '2.0.16',
    strip: function strip(content) {
      //Strips <?xml ...?> declarations so that external SVG and XML
      //documents can be added to a document without worry. Also, if the string
      //is an HTML document, only the part inside the body tag is returned.
      if (content) {
        content = content.replace(xmlRegExp, "");
        var matches = content.match(bodyRegExp);

        if (matches) {
          content = matches[1];
        }
      } else {
        content = "";
      }

      return content;
    },
    jsEscape: function jsEscape(content) {
      return content.replace(/(['\\])/g, '\\$1').replace(/[\f]/g, "\\f").replace(/[\b]/g, "\\b").replace(/[\n]/g, "\\n").replace(/[\t]/g, "\\t").replace(/[\r]/g, "\\r").replace(/[\u2028]/g, "\\u2028").replace(/[\u2029]/g, "\\u2029");
    },
    createXhr: masterConfig.createXhr || function () {
      //Would love to dump the ActiveX crap in here. Need IE 6 to die first.
      var xhr, i, progId;

      if (typeof XMLHttpRequest !== "undefined") {
        return new XMLHttpRequest();
      } else if (typeof ActiveXObject !== "undefined") {
        for (i = 0; i < 3; i += 1) {
          progId = progIds[i];

          try {
            xhr = new ActiveXObject(progId);
          } catch (e) {}

          if (xhr) {
            progIds = [progId]; // so faster next time

            break;
          }
        }
      }

      return xhr;
    },

    /**
     * Parses a resource name into its component parts. Resource names
     * look like: module/name.ext!strip, where the !strip part is
     * optional.
     * @param {String} name the resource name
     * @returns {Object} with properties "moduleName", "ext" and "strip"
     * where strip is a boolean.
     */
    parseName: function parseName(name) {
      var modName,
          ext,
          temp,
          strip = false,
          index = name.lastIndexOf("."),
          isRelative = name.indexOf('./') === 0 || name.indexOf('../') === 0;

      if (index !== -1 && (!isRelative || index > 1)) {
        modName = name.substring(0, index);
        ext = name.substring(index + 1);
      } else {
        modName = name;
      }

      temp = ext || modName;
      index = temp.indexOf("!");

      if (index !== -1) {
        //Pull off the strip arg.
        strip = temp.substring(index + 1) === "strip";
        temp = temp.substring(0, index);

        if (ext) {
          ext = temp;
        } else {
          modName = temp;
        }
      }

      return {
        moduleName: modName,
        ext: ext,
        strip: strip
      };
    },
    xdRegExp: /^((\w+)\:)?\/\/([^\/\\]+)/,

    /**
     * Is an URL on another domain. Only works for browser use, returns
     * false in non-browser environments. Only used to know if an
     * optimized .js version of a text resource should be loaded
     * instead.
     * @param {String} url
     * @returns Boolean
     */
    useXhr: function useXhr(url, protocol, hostname, port) {
      var uProtocol,
          uHostName,
          uPort,
          match = text.xdRegExp.exec(url);

      if (!match) {
        return true;
      }

      uProtocol = match[2];
      uHostName = match[3];
      uHostName = uHostName.split(':');
      uPort = uHostName[1];
      uHostName = uHostName[0];
      return (!uProtocol || uProtocol === protocol) && (!uHostName || uHostName.toLowerCase() === hostname.toLowerCase()) && (!uPort && !uHostName || isSamePort(uProtocol, uPort, protocol, port));
    },
    finishLoad: function finishLoad(name, strip, content, onLoad) {
      content = strip ? text.strip(content) : content;

      if (masterConfig.isBuild) {
        buildMap[name] = content;
      }

      onLoad(content);
    },
    load: function load(name, req, onLoad, config) {
      //Name has format: some.module.filext!strip
      //The strip part is optional.
      //if strip is present, then that means only get the string contents
      //inside a body tag in an HTML string. For XML/SVG content it means
      //removing the <?xml ...?> declarations so the content can be inserted
      //into the current doc without problems.
      // Do not bother with the work if a build and text will
      // not be inlined.
      if (config && config.isBuild && !config.inlineText) {
        onLoad();
        return;
      }

      masterConfig.isBuild = config && config.isBuild;
      var parsed = text.parseName(name),
          nonStripName = parsed.moduleName + (parsed.ext ? '.' + parsed.ext : ''),
          url = req.toUrl(nonStripName),
          useXhr = masterConfig.useXhr || text.useXhr; // Do not load if it is an empty: url

      if (url.indexOf('empty:') === 0) {
        onLoad();
        return;
      } //Load the text. Use XHR if possible and in a browser.


      if (!hasLocation || useXhr(url, defaultProtocol, defaultHostName, defaultPort)) {
        text.get(url, function (content) {
          text.finishLoad(name, parsed.strip, content, onLoad);
        }, function (err) {
          if (onLoad.error) {
            onLoad.error(err);
          }
        });
      } else {
        //Need to fetch the resource across domains. Assume
        //the resource has been optimized into a JS module. Fetch
        //by the module name + extension, but do not include the
        //!strip part to avoid file system issues.
        req([nonStripName], function (content) {
          text.finishLoad(parsed.moduleName + '.' + parsed.ext, parsed.strip, content, onLoad);
        }, function (err) {
          if (onLoad.error) {
            onLoad.error(err);
          }
        });
      }
    },
    write: function write(pluginName, moduleName, _write, config) {
      if (buildMap.hasOwnProperty(moduleName)) {
        var content = text.jsEscape(buildMap[moduleName]);

        _write.asModule(pluginName + "!" + moduleName, "define(function () { return '" + content + "';});\n");
      }
    },
    writeFile: function writeFile(pluginName, moduleName, req, write, config) {
      var parsed = text.parseName(moduleName),
          extPart = parsed.ext ? '.' + parsed.ext : '',
          nonStripName = parsed.moduleName + extPart,
          //Use a '.js' file name so that it indicates it is a
      //script that can be loaded across domains.
      fileName = req.toUrl(parsed.moduleName + extPart) + '.js'; //Leverage own load() method to load plugin value, but only
      //write out values that do not have the strip argument,
      //to avoid any potential issues with ! in file names.

      text.load(nonStripName, req, function (value) {
        //Use own write() method to construct full module value.
        //But need to create shell that translates writeFile's
        //write() to the right interface.
        var textWrite = function textWrite(contents) {
          return write(fileName, contents);
        };

        textWrite.asModule = function (moduleName, contents) {
          return write.asModule(moduleName, fileName, contents);
        };

        text.write(pluginName, nonStripName, textWrite, config);
      }, config);
    }
  };

  if (masterConfig.env === 'node' || !masterConfig.env && typeof process !== "undefined" && process.versions && !!process.versions.node && !process.versions['node-webkit'] && !process.versions['atom-shell']) {
    //Using special require.nodeRequire, something added by r.js.
    fs = require.nodeRequire('fs');

    text.get = function (url, callback, errback) {
      try {
        var file = fs.readFileSync(url, 'utf8'); //Remove BOM (Byte Mark Order) from utf8 files if it is there.

        if (file[0] === "\uFEFF") {
          file = file.substring(1);
        }

        callback(file);
      } catch (e) {
        if (errback) {
          errback(e);
        }
      }
    };
  } else if (masterConfig.env === 'xhr' || !masterConfig.env && text.createXhr()) {
    text.get = function (url, callback, errback, headers) {
      var xhr = text.createXhr(),
          header;
      xhr.open('GET', url, true); //Allow plugins direct access to xhr headers

      if (headers) {
        for (header in headers) {
          if (headers.hasOwnProperty(header)) {
            xhr.setRequestHeader(header.toLowerCase(), headers[header]);
          }
        }
      } //Allow overrides specified in config


      if (masterConfig.onXhr) {
        masterConfig.onXhr(xhr, url);
      }

      xhr.onreadystatechange = function (evt) {
        var status, err; //Do not explicitly handle errors, those should be
        //visible via console output in the browser.

        if (xhr.readyState === 4) {
          status = xhr.status || 0;

          if (status > 399 && status < 600) {
            //An http 4xx or 5xx error. Signal an error.
            err = new Error(url + ' HTTP status: ' + status);
            err.xhr = xhr;

            if (errback) {
              errback(err);
            }
          } else {
            callback(xhr.responseText);
          }

          if (masterConfig.onXhrComplete) {
            masterConfig.onXhrComplete(xhr, url);
          }
        }
      };

      xhr.send(null);
    };
  } else if (masterConfig.env === 'rhino' || !masterConfig.env && typeof Packages !== 'undefined' && typeof java !== 'undefined') {
    //Why Java, why is this so awkward?
    text.get = function (url, callback) {
      var stringBuffer,
          line,
          encoding = "utf-8",
          file = new java.io.File(url),
          lineSeparator = java.lang.System.getProperty("line.separator"),
          input = new java.io.BufferedReader(new java.io.InputStreamReader(new java.io.FileInputStream(file), encoding)),
          content = '';

      try {
        stringBuffer = new java.lang.StringBuffer();
        line = input.readLine(); // Byte Order Mark (BOM) - The Unicode Standard, version 3.0, page 324
        // http://www.unicode.org/faq/utf_bom.html
        // Note that when we use utf-8, the BOM should appear as "EF BB BF", but it doesn't due to this bug in the JDK:
        // http://bugs.sun.com/bugdatabase/view_bug.do?bug_id=4508058

        if (line && line.length() && line.charAt(0) === 0xfeff) {
          // Eat the BOM, since we've already found the encoding on this file,
          // and we plan to concatenating this buffer with others; the BOM should
          // only appear at the top of a file.
          line = line.substring(1);
        }

        if (line !== null) {
          stringBuffer.append(line);
        }

        while ((line = input.readLine()) !== null) {
          stringBuffer.append(lineSeparator);
          stringBuffer.append(line);
        } //Make sure we return a JavaScript string and not a Java string.


        content = String(stringBuffer.toString()); //String
      } finally {
        input.close();
      }

      callback(content);
    };
  } else if (masterConfig.env === 'xpconnect' || !masterConfig.env && typeof Components !== 'undefined' && Components.classes && Components.interfaces) {
    //Avert your gaze!
    Cc = Components.classes;
    Ci = Components.interfaces;
    Components.utils['import']('resource://gre/modules/FileUtils.jsm');
    xpcIsWindows = '@mozilla.org/windows-registry-key;1' in Cc;

    text.get = function (url, callback) {
      var inStream,
          convertStream,
          fileObj,
          readData = {};

      if (xpcIsWindows) {
        url = url.replace(/\//g, '\\');
      }

      fileObj = new FileUtils.File(url); //XPCOM, you so crazy

      try {
        inStream = Cc['@mozilla.org/network/file-input-stream;1'].createInstance(Ci.nsIFileInputStream);
        inStream.init(fileObj, 1, 0, false);
        convertStream = Cc['@mozilla.org/intl/converter-input-stream;1'].createInstance(Ci.nsIConverterInputStream);
        convertStream.init(inStream, "utf-8", inStream.available(), Ci.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);
        convertStream.readString(inStream.available(), readData);
        convertStream.close();
        inStream.close();
        callback(readData.value);
      } catch (e) {
        throw new Error((fileObj && fileObj.path || '') + ': ' + e);
      }
    };
  }

  return text;
});

define('text!deepforge/storage/backends/sciserver-files/metadata.json',[],function () { return '{\n    "name": "SciServer Files Service",\n    "configStructure": [\n        {\n            "name": "token",\n            "displayName": "Access Token",\n            "description": "SciServer access token.",\n            "value": "",\n            "valueType": "string",\n            "readOnly": false\n        },\n        {\n            "name": "volume",\n            "displayName": "Volume",\n            "description": "Volume to use for upload.",\n            "value": "USERNAME/deepforge_data",\n            "valueType": "string",\n            "readOnly": false\n        }\n    ]\n}\n';});


define('text!deepforge/storage/backends/gme/metadata.json',[],function () { return '{\n    "name": "WebGME Blob Storage",\n    "configStructure": []\n}\n';});



var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));

/*globals define, requirejs */
define('deepforge/storage/index',['module', './backends/StorageBackend', 'text!deepforge/storage/backends/sciserver-files/metadata.json', 'text!deepforge/storage/backends/gme/metadata.json'], function (module, StorageBackend, sciserverFiles, gme) {
  var Storage = {};
  var StorageMetadata = {};
  StorageMetadata['sciserver-files'] = JSON.parse(sciserverFiles);
  StorageMetadata['gme'] = JSON.parse(gme);
  var STORAGE_BACKENDS = Object.keys(StorageMetadata);

  Storage.getComponentId = function () {
    return 'Storage';
  };

  Storage.getAvailableBackends = function () {
    var settings = {
      backends: STORAGE_BACKENDS
    }; // all by default

    if (require.isBrowser) {
      var ComponentSettings = requirejs('js/Utils/ComponentSettings');
      ComponentSettings.resolveWithWebGMEGlobal(settings, this.getComponentId());
    } else {
      // Running in NodeJS
      var path = require('path');

      var dirname = path.dirname(module.uri);
      var deploymentSettings = JSON.parse(requirejs('text!' + dirname + '/../../../config/components.json'));
      Object.assign(settings, deploymentSettings[this.getComponentId()]);
    }

    return settings.backends;
  };

  Storage.getBackend = function (id) {
    var metadata = this.getStorageMetadata(id);
    return new StorageBackend(id, metadata);
  };

  Storage.getStorageMetadata = function (id) {
    id = id.toLowerCase();

    if (!STORAGE_BACKENDS.includes(id)) {
      throw new Error("Storage backend not found: ".concat(id));
    }

    var metadata = StorageMetadata[id];
    metadata.id = id;
    return metadata;
  };

  Storage.getMetadata = function _callee(dataInfo, logger, configs) {
    var client;
    return _regenerator["default"].async(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            _context.next = 2;
            return _regenerator["default"].awrap(this.getClientForDataInfo(dataInfo, logger, configs));

          case 2:
            client = _context.sent;
            return _context.abrupt("return", client.getMetadata(dataInfo));

          case 4:
          case "end":
            return _context.stop();
        }
      }
    }, null, this);
  };

  Storage.getDownloadURL = function _callee2(dataInfo, logger, configs) {
    var client;
    return _regenerator["default"].async(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            _context2.next = 2;
            return _regenerator["default"].awrap(this.getClientForDataInfo(dataInfo, logger, configs));

          case 2:
            client = _context2.sent;
            return _context2.abrupt("return", client.getDownloadURL(dataInfo));

          case 4:
          case "end":
            return _context2.stop();
        }
      }
    }, null, this);
  };

  Storage.getFile = function _callee3(dataInfo, logger, configs) {
    var client;
    return _regenerator["default"].async(function _callee3$(_context3) {
      while (1) {
        switch (_context3.prev = _context3.next) {
          case 0:
            _context3.next = 2;
            return _regenerator["default"].awrap(this.getClientForDataInfo(dataInfo, logger, configs));

          case 2:
            client = _context3.sent;
            return _context3.abrupt("return", client.getFile(dataInfo));

          case 4:
          case "end":
            return _context3.stop();
        }
      }
    }, null, this);
  };

  Storage.deleteFile = function _callee4(dataInfo, logger, configs) {
    var client;
    return _regenerator["default"].async(function _callee4$(_context4) {
      while (1) {
        switch (_context4.prev = _context4.next) {
          case 0:
            _context4.next = 2;
            return _regenerator["default"].awrap(this.getClientForDataInfo(dataInfo, logger, configs));

          case 2:
            client = _context4.sent;
            return _context4.abrupt("return", client.deleteFile(dataInfo));

          case 4:
          case "end":
            return _context4.stop();
        }
      }
    }, null, this);
  };

  Storage.getCachePath = function _callee5(dataInfo, logger, configs) {
    var client;
    return _regenerator["default"].async(function _callee5$(_context5) {
      while (1) {
        switch (_context5.prev = _context5.next) {
          case 0:
            _context5.next = 2;
            return _regenerator["default"].awrap(this.getClientForDataInfo(dataInfo, logger, configs));

          case 2:
            client = _context5.sent;
            _context5.next = 5;
            return _regenerator["default"].awrap(client.getCachePath(dataInfo));

          case 5:
            return _context5.abrupt("return", _context5.sent);

          case 6:
          case "end":
            return _context5.stop();
        }
      }
    }, null, this);
  };

  Storage.getClientForDataInfo = function _callee6(dataInfo, logger) {
    var configs,
        config,
        backend,
        _args6 = arguments;
    return _regenerator["default"].async(function _callee6$(_context6) {
      while (1) {
        switch (_context6.prev = _context6.next) {
          case 0:
            configs = _args6.length > 2 && _args6[2] !== undefined ? _args6[2] : {};
            config = configs[dataInfo.backend];
            backend = this.getBackend(dataInfo.backend);
            _context6.next = 5;
            return _regenerator["default"].awrap(backend.getClient(logger, config));

          case 5:
            return _context6.abrupt("return", _context6.sent);

          case 6:
          case "end":
            return _context6.stop();
        }
      }
    }, null, this);
  };

  Storage.getClient = function _callee7(id, logger) {
    var config,
        backend,
        _args7 = arguments;
    return _regenerator["default"].async(function _callee7$(_context7) {
      while (1) {
        switch (_context7.prev = _context7.next) {
          case 0:
            config = _args7.length > 2 && _args7[2] !== undefined ? _args7[2] : {};
            backend = this.getBackend(id);
            _context7.next = 4;
            return _regenerator["default"].awrap(backend.getClient(logger, config));

          case 4:
            return _context7.abrupt("return", _context7.sent);

          case 5:
          case "end":
            return _context7.stop();
        }
      }
    }, null, this);
  };

  return Storage;
});


var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

var _typeof2 = _interopRequireDefault(require("@babel/runtime/helpers/typeof"));

/* globals define */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define('deepforge/Constants',[], function () {
      return factory();
    });
  } else if ((typeof module === "undefined" ? "undefined" : (0, _typeof2["default"])(module)) === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CONSTANTS = factory();
  }
})(void 0, function () {
  return {
    CONTAINED_LAYER_SET: 'addLayers',
    CONTAINED_LAYER_INDEX: 'index',
    LINE_OFFSET: 'lineOffset',
    DISPLAY_COLOR: 'displayColor',
    // DeepForge metadata creation in dist execution
    START_CMD: 'deepforge-cmd',
    IMAGE: {
      // all prefixed w/ 'IMG' for simple upload detection
      PREFIX: 'IMG',
      BASIC: 'IMG-B',
      CREATE: 'IMG-C',
      UPDATE: 'IMG-U',
      NAME: 'IMAGE-N' // No upload required

    },
    GRAPH_CREATE: 'GRAPH',
    PLOT_UPDATE: 'PLOT',
    GRAPH_PLOT: 'PLOT',
    GRAPH_CREATE_LINE: 'LINE',
    GRAPH_LABEL_AXIS: {
      X: 'X',
      Y: 'Y'
    },
    // Code Generation Constants
    CTOR_ARGS_ATTR: 'ctor_arg_order',
    // Operation types
    OP: {
      INPUT: 'Input',
      OUTPUT: 'Output'
    },
    // Heartbeat constants (ExecPulse router)
    PULSE: {
      DEAD: 0,
      ALIVE: 1,
      DOESNT_EXIST: 2
    },
    // Job stdout update
    STDOUT_UPDATE: 'stdout_update'
  };
});


/*globals define, debug*/

/*eslint-env node*/

/*eslint no-console: 0*/

/**
 * @author pmeijer / https://github.com/pmeijer
 */
define('client/logger',['debug'], function (_debug) {
  'use strict'; // Separate namespaces using ',' a leading '-' will disable the namespace.
  // Each part takes a regex.
  //      ex: localStorage.debug = '*,-socket\.io*,-engine\.io*'
  //      will log all but socket.io and engine.io

  function createLogger(name, options) {
    var log = typeof debug === 'undefined' ? _debug(name) : debug(name),
        level,
        levels = {
      silly: 0,
      input: 1,
      verbose: 2,
      prompt: 3,
      debug: 4,
      info: 5,
      data: 6,
      help: 7,
      warn: 8,
      error: 9
    };

    if (!options) {
      throw new Error('options required in logger');
    }

    if (options.hasOwnProperty('level') === false) {
      throw new Error('options.level required in logger');
    }

    level = levels[options.level];

    if (typeof level === 'undefined') {
      level = levels.info;
    }

    log.debug = function () {
      if (log.enabled && level <= levels.debug) {
        if (console.debug) {
          log.log = console.debug.bind(console);
        } else {
          log.log = console.log.bind(console);
        }

        log.apply(this, arguments);
      }
    };

    log.info = function () {
      if (log.enabled && level <= levels.info) {
        log.log = console.info.bind(console);
        log.apply(this, arguments);
      }
    };

    log.warn = function () {
      if (log.enabled && level <= levels.warn) {
        log.log = console.warn.bind(console);
        log.apply(this, arguments);
      }
    };

    log.error = function () {
      if (log.enabled && level <= levels.error) {
        log.log = console.error.bind(console);
        log.apply(this, arguments);
      } else {
        console.error.apply(console, arguments);
      }
    };

    log.fork = function (forkName, useForkName) {
      forkName = useForkName ? forkName : name + ':' + forkName;
      return createLogger(forkName, options);
    };

    log.forkWithOptions = function (_name, _options) {
      return createLogger(_name, _options);
    };

    return log;
  }

  function createWithGmeConfig(name, gmeConfig) {
    return createLogger(name, gmeConfig.client.log);
  }

  return {
    create: createLogger,
    createWithGmeConfig: createWithGmeConfig
  };
});


var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));

/* globals define, WebGMEGlobal */
define('deepforge/storage/backends/StorageClient',['client/logger'], function (Logger) {
  var StorageClient = function StorageClient(id, name, logger) {
    this.id = id;
    this.name = name;

    if (!logger) {
      var gmeConfig;

      if (require.isBrowser) {
        gmeConfig = WebGMEGlobal.gmeConfig;
      } else {
        gmeConfig = require.nodeRequire('../../../config');
      }

      logger = Logger.create("gme:storage:".concat(id), gmeConfig.client.log);
    }

    this.logger = logger.fork("storage:".concat(id));
  };

  StorageClient.prototype.getFile = function _callee() {
    return _regenerator["default"].async(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            throw new Error("File download not implemented for ".concat(this.name));

          case 1:
          case "end":
            return _context.stop();
        }
      }
    }, null, this);
  };

  StorageClient.prototype.putFile = function _callee2() {
    return _regenerator["default"].async(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            throw new Error("File upload not supported by ".concat(this.name));

          case 1:
          case "end":
            return _context2.stop();
        }
      }
    }, null, this);
  };

  StorageClient.prototype.deleteFile = function _callee3() {
    return _regenerator["default"].async(function _callee3$(_context3) {
      while (1) {
        switch (_context3.prev = _context3.next) {
          case 0:
            throw new Error("File deletion not supported by ".concat(this.name));

          case 1:
          case "end":
            return _context3.stop();
        }
      }
    }, null, this);
  };

  StorageClient.prototype.deleteDir = function ()
  /*dirname*/
  {
    throw new Error("Directory deletion not supported by ".concat(this.name));
  };

  StorageClient.prototype.getDownloadURL = function _callee4() {
    return _regenerator["default"].async(function _callee4$(_context4) {
      while (1) {
        switch (_context4.prev = _context4.next) {
          case 0:
            throw new Error("getDownloadURL not implemented for ".concat(this.name));

          case 1:
          case "end":
            return _context4.stop();
        }
      }
    }, null, this);
  };

  StorageClient.prototype.getMetadata = function _callee5() {
    return _regenerator["default"].async(function _callee5$(_context5) {
      while (1) {
        switch (_context5.prev = _context5.next) {
          case 0:
            throw new Error("getDownloadURL not implemented for ".concat(this.name));

          case 1:
          case "end":
            return _context5.stop();
        }
      }
    }, null, this);
  };

  StorageClient.prototype.copy = function _callee6(dataInfo, filename) {
    var content;
    return _regenerator["default"].async(function _callee6$(_context6) {
      while (1) {
        switch (_context6.prev = _context6.next) {
          case 0:
            _context6.next = 2;
            return _regenerator["default"].awrap(this.getFile(dataInfo));

          case 2:
            content = _context6.sent;
            return _context6.abrupt("return", this.putFile(filename, content));

          case 4:
          case "end":
            return _context6.stop();
        }
      }
    }, null, this);
  };

  StorageClient.prototype.createDataInfo = function (data) {
    return {
      backend: this.id,
      data: data
    };
  };

  return StorageClient;
});


define('deepforge/gmeConfig',[], function () {
  return JSON.parse('{"addOn":{"enable":false,"monitorTimeout":120000,"workerUrl":null,"basePaths":["/home/brian/projektek/deepforge/node_modules/webgme/node_modules/webgme-engine/src/addon/core"]},"authentication":{"enable":false,"authorizer":{"path":"/home/brian/projektek/deepforge/node_modules/webgme/node_modules/webgme-engine/src/server/middleware/auth/defaultauthorizer","options":{}},"allowGuests":true,"allowUserRegistration":true,"registeredUsersCanCreate":true,"inferredUsersCanCreate":false,"userManagementPage":"/home/brian/projektek/deepforge/node_modules/webgme-user-management-page/src/server/usermanagement.js","guestAccount":"guest","guestCanCreate":true,"adminAccount":null,"publicOrganizations":[],"logOutUrl":"/profile/login","logInUrl":"/profile/login","salts":10,"jwt":{"expiresIn":604800,"renewBeforeExpires":3600,"cookieId":"access_token","publicKey":"/home/brian/projektek/deepforge/node_modules/webgme/node_modules/webgme-engine/src/server/middleware/auth/EXAMPLE_PUBLIC_KEY","tokenGenerator":"/home/brian/projektek/deepforge/node_modules/webgme/node_modules/webgme-engine/src/server/middleware/auth/localtokengenerator.js","algorithm":"RS256","privateKey":"/home/brian/projektek/deepforge/node_modules/webgme/node_modules/webgme-engine/src/server/middleware/auth/EXAMPLE_PRIVATE_KEY"}},"bin":{"log":{"transports":[{"transportType":"Console","options":{"level":"info","colorize":true,"timestamp":true,"prettyPrint":true,"handleExceptions":true,"depth":2}}]}},"blob":{"compressionLevel":0,"type":"FS","fsDir":"./blob-local-storage","namespace":"","s3":{"accessKeyId":"123","secretAccessKey":"abc","region":"","s3ForcePathStyle":true,"endpoint":"http://localhost:4567","sslEnabled":false}},"client":{"appDir":"/home/brian/projektek/deepforge/node_modules/webgme/src/client","appVersion":"2.38.0","faviconPath":"img/favicon.ico","pageTitle":null,"log":{"level":"debug"},"defaultConnectionRouter":"basic3","errorReporting":{"enable":false,"DSN":"","ravenOptions":null},"allowUserDefinedSVG":true},"core":{"enableCustomConstraints":false,"inverseRelationsCacheSize":2000,"overlayShardSize":10000},"debug":false,"documentEditing":{"enable":true,"disconnectTimeout":20000},"executor":{"enable":true,"nonce":null,"workerRefreshInterval":5000,"clearOutputTimeout":60000,"clearOldDataAtStartUp":false,"labelJobs":"./labelJobs.json"},"mongo":{"uri":"mongodb://127.0.0.1:27017/deepforge","options":{"w":1,"autoReconnect":true,"keepAlive":1}},"plugin":{"allowBrowserExecution":true,"allowServerExecution":true,"basePaths":["/home/brian/projektek/deepforge/node_modules/webgme/node_modules/webgme-engine/src/plugin/coreplugins","/home/brian/projektek/deepforge/config/../src/plugins","/home/brian/projektek/deepforge/config/../node_modules/webgme-simple-nodes/src/plugins"],"displayAll":false,"serverResultTimeout":60000},"requirejsPaths":{"EllipseDecorator":"node_modules/webgme-easydag/src/decorators/EllipseDecorator","EasyDAG":"panels/EasyDAG/EasyDAGPanel","AutoViz":"panels/AutoViz/AutoVizPanel","BreadcrumbHeader":"panels/BreadcrumbHeader/BreadcrumbHeaderPanel","FloatingActionButton":"panels/FloatingActionButton/FloatingActionButtonPanel","CHFLayout":"node_modules/webgme-chflayout/src/layouts/CHFLayout","SimpleNodes":"node_modules/webgme-simple-nodes/src/plugins/SimpleNodes","panels":"./src/visualizers/panels","widgets":"./src/visualizers/widgets","panels/EasyDAG":"./node_modules/webgme-easydag/src/visualizers/panels/EasyDAG","widgets/EasyDAG":"./node_modules/webgme-easydag/src/visualizers/widgets/EasyDAG","panels/AutoViz":"./node_modules/webgme-autoviz/src/visualizers/panels/AutoViz","widgets/AutoViz":"./node_modules/webgme-autoviz/src/visualizers/widgets/AutoViz","panels/BreadcrumbHeader":"./node_modules/webgme-breadcrumbheader/src/visualizers/panels/BreadcrumbHeader","widgets/BreadcrumbHeader":"./node_modules/webgme-breadcrumbheader/","panels/FloatingActionButton":"./node_modules/webgme-fab/src/visualizers/panels/FloatingActionButton","widgets/FloatingActionButton":"./node_modules/webgme-fab/src/visualizers/widgets/FloatingActionButton","webgme-simple-nodes":"./node_modules/webgme-simple-nodes/src/common","webgme-chflayout":"./node_modules/webgme-chflayout/src/common","webgme-fab":"./node_modules/webgme-fab/src/common","webgme-breadcrumbheader":"./node_modules/webgme-breadcrumbheader/src/common","webgme-autoviz":"./node_modules/webgme-autoviz/src/common","webgme-easydag":"./node_modules/webgme-easydag/src/common","deepforge":"./src/common","ace":"./src/visualizers/widgets/TextEditor/lib/ace"},"rest":{"components":{"JobLogsAPI":{"src":"/home/brian/projektek/deepforge/config/../src/routers/JobLogsAPI/JobLogsAPI.js","mount":"execution/logs","options":{}},"JobOriginAPI":{"src":"/home/brian/projektek/deepforge/config/../src/routers/JobOriginAPI/JobOriginAPI.js","mount":"job/origins","options":{}},"ExecPulse":{"src":"/home/brian/projektek/deepforge/config/../src/routers/ExecPulse/ExecPulse.js","mount":"execution/pulse","options":{}}}},"seedProjects":{"enable":true,"allowDuplication":true,"defaultProject":"project","basePaths":["src/seeds/project"],"createAtStartup":[]},"server":{"port":8888,"handle":null,"timeout":0,"workerManager":{"path":"/home/brian/projektek/deepforge/node_modules/webgme/node_modules/webgme-engine/src/server/worker/serverworkermanager","options":{}},"maxWorkers":10,"maxQueuedWorkerRequests":-1,"workerDisconnectTimeout":2000,"log":{"transports":[{"transportType":"Console","options":{"level":"info","colorize":true,"timestamp":true,"prettyPrint":true,"handleExceptions":true,"depth":2}},{"transportType":"File","options":{"name":"info-file","filename":"./server.log","level":"info","json":false}},{"transportType":"File","options":{"name":"error-file","filename":"./server-error.log","level":"error","handleExceptions":true,"json":false}}]},"extlibExcludes":["config/config..*.js$"],"behindSecureProxy":false,"bodyParser":{"json":{}}},"socketIO":{"clientOptions":{"reconnection":true,"reconnectionDelay":500,"forceNew":true},"serverOptions":{},"adapter":{"type":"Memory","options":{}}},"storage":{"cache":2000,"freezeCache":false,"broadcastProjectEvents":false,"maxEmittedCoreObjects":-1,"loadBucketSize":100,"loadBucketTimer":10,"clientCacheSize":2000,"autoMerge":{"enable":true},"keyType":"plainSHA1","database":{"type":"mongo","options":{}},"disableHashChecks":false,"requireHashesToMatch":true},"visualization":{"decoratorPaths":["/home/brian/projektek/deepforge/node_modules/webgme/src/client/decorators","/home/brian/projektek/deepforge/config/../src/decorators","/home/brian/projektek/deepforge/config/../node_modules/webgme-easydag/src/decorators"],"svgDirs":["/home/brian/projektek/deepforge/node_modules/webgme/src/client/assets/DecoratorSVG"],"visualizerDescriptors":["/home/brian/projektek/deepforge/node_modules/webgme/src/client/js/Visualizers.json","/home/brian/projektek/deepforge/config/../src/visualizers/Visualizers.json"],"panelPaths":["/home/brian/projektek/deepforge/node_modules/webgme/src/client/js/Panels","/home/brian/projektek/deepforge/config/../node_modules/webgme-fab/src/visualizers/panels","/home/brian/projektek/deepforge/config/../node_modules/webgme-breadcrumbheader/src/visualizers/panels","/home/brian/projektek/deepforge/config/../node_modules/webgme-autoviz/src/visualizers/panels","/home/brian/projektek/deepforge/config/../node_modules/webgme-easydag/src/visualizers/panels","/home/brian/projektek/deepforge/config/../src/visualizers/panels"],"layout":{"basePaths":["/home/brian/projektek/deepforge/node_modules/webgme/src/client/js/Layouts","/home/brian/projektek/deepforge/config/../src/layouts","/home/brian/projektek/deepforge/config/../node_modules/webgme-chflayout/src/layouts"]},"extraCss":["deepforge/styles/global.css"]},"webhooks":{"enable":false,"manager":"memory","defaults":{}}}');
});


var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));

var _slicedToArray2 = _interopRequireDefault(require("@babel/runtime/helpers/slicedToArray"));

/* globals define */
define('deepforge/storage/backends/gme/Client',['../StorageClient', 'blob/BlobClient', 'deepforge/gmeConfig'], function (StorageClient, BlobClient, gmeConfig) {
  var GMEStorage = function GMEStorage()
  /*name, logger*/
  {
    StorageClient.apply(this, arguments);
    var params = {
      logger: this.logger.fork('BlobClient')
    };

    if (!require.isBrowser) {
      var _this$getServerURL = this.getServerURL(),
          _this$getServerURL2 = (0, _slicedToArray2["default"])(_this$getServerURL, 2),
          url = _this$getServerURL2[0],
          isHttps = _this$getServerURL2[1];

      params.server = url.split(':')[0];
      params.serverPort = +url.split(':').pop();
      params.httpsecure = isHttps;
    }

    this.blobClient = new BlobClient(params);
  };

  GMEStorage.prototype = Object.create(StorageClient.prototype);

  GMEStorage.prototype.getServerURL = function () {
    var port = gmeConfig.server.port;
    var url = process.env.DEEPFORGE_URL || "127.0.0.1:".concat(port);
    return [url.replace(/^https?:\/\//, ''), url.startsWith('https')];
  };

  GMEStorage.prototype.getFile = function _callee(dataInfo) {
    var data;
    return _regenerator["default"].async(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            data = dataInfo.data;
            _context.next = 3;
            return _regenerator["default"].awrap(this.blobClient.getObject(data));

          case 3:
            return _context.abrupt("return", _context.sent);

          case 4:
          case "end":
            return _context.stop();
        }
      }
    }, null, this);
  };

  GMEStorage.prototype.putFile = function _callee2(filename, content) {
    var hash;
    return _regenerator["default"].async(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            _context2.next = 2;
            return _regenerator["default"].awrap(this.blobClient.putFile(filename, content));

          case 2:
            hash = _context2.sent;
            return _context2.abrupt("return", this.createDataInfo(hash));

          case 4:
          case "end":
            return _context2.stop();
        }
      }
    }, null, this);
  };

  GMEStorage.prototype.deleteDir = GMEStorage.prototype.deleteFile = function _callee3() {
    return _regenerator["default"].async(function _callee3$(_context3) {
      while (1) {
        switch (_context3.prev = _context3.next) {
          case 0:
          case "end":
            return _context3.stop();
        }
      }
    });
  };

  GMEStorage.prototype.getMetadata = function _callee4(dataInfo) {
    var data;
    return _regenerator["default"].async(function _callee4$(_context4) {
      while (1) {
        switch (_context4.prev = _context4.next) {
          case 0:
            data = dataInfo.data;
            _context4.next = 3;
            return _regenerator["default"].awrap(this.blobClient.getMetadata(data));

          case 3:
            return _context4.abrupt("return", _context4.sent);

          case 4:
          case "end":
            return _context4.stop();
        }
      }
    }, null, this);
  };

  GMEStorage.prototype.getDownloadURL = function _callee5(dataInfo) {
    var data;
    return _regenerator["default"].async(function _callee5$(_context5) {
      while (1) {
        switch (_context5.prev = _context5.next) {
          case 0:
            data = dataInfo.data;
            return _context5.abrupt("return", this.blobClient.getDownloadURL(data));

          case 2:
          case "end":
            return _context5.stop();
        }
      }
    }, null, this);
  };

  GMEStorage.prototype.getCachePath = function _callee6(dataInfo) {
    var metadata, hash, dir, filename;
    return _regenerator["default"].async(function _callee6$(_context6) {
      while (1) {
        switch (_context6.prev = _context6.next) {
          case 0:
            _context6.next = 2;
            return _regenerator["default"].awrap(this.getMetadata(dataInfo));

          case 2:
            metadata = _context6.sent;
            hash = metadata.content;
            dir = hash.substring(0, 2);
            filename = hash.substring(2);
            return _context6.abrupt("return", "".concat(this.id, "/").concat(dir, "/").concat(filename));

          case 7:
          case "end":
            return _context6.stop();
        }
      }
    }, null, this);
  };

  return GMEStorage;
});


var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));

/* globals define */
define('deepforge/storage/backends/sciserver-files/Client',['../StorageClient'], function (StorageClient) {
  var fetch = require.isBrowser ? window.fetch : require.nodeRequire('node-fetch');
  var Headers = require.isBrowser ? window.Headers : fetch.Headers;
  var BASE_URL = 'https://apps.sciserver.org/fileservice/api/';

  var SciServerFiles = function SciServerFiles(id, name, logger) {
    var config = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
    StorageClient.apply(this, arguments);
    this.token = config.token;
    this.volume = (config.volume || '').replace(/^Storage\//, '');
  };

  SciServerFiles.prototype = Object.create(StorageClient.prototype);

  SciServerFiles.prototype.getFile = function _callee(dataInfo) {
    var _dataInfo$data, volume, filename, url, response;

    return _regenerator["default"].async(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            _dataInfo$data = dataInfo.data, volume = _dataInfo$data.volume, filename = _dataInfo$data.filename;
            url = "file/Storage/".concat(volume, "/").concat(filename);
            _context.next = 4;
            return _regenerator["default"].awrap(this.fetch(url));

          case 4:
            response = _context.sent;

            if (!require.isBrowser) {
              _context.next = 11;
              break;
            }

            _context.next = 8;
            return _regenerator["default"].awrap(response.arrayBuffer());

          case 8:
            return _context.abrupt("return", _context.sent);

          case 11:
            _context.t0 = Buffer;
            _context.next = 14;
            return _regenerator["default"].awrap(response.arrayBuffer());

          case 14:
            _context.t1 = _context.sent;
            return _context.abrupt("return", _context.t0.from.call(_context.t0, _context.t1));

          case 16:
          case "end":
            return _context.stop();
        }
      }
    }, null, this);
  };

  SciServerFiles.prototype.putFile = function _callee2(filename, content) {
    var opts, url, metadata;
    return _regenerator["default"].async(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            if (this.volume) {
              _context2.next = 2;
              break;
            }

            throw new Error('Cannot upload file to SciServer. No volume specified.');

          case 2:
            opts = {
              method: 'PUT',
              body: content
            };
            url = "file/Storage/".concat(this.volume, "/").concat(filename);
            _context2.next = 6;
            return _regenerator["default"].awrap(this.fetch(url, opts));

          case 6:
            metadata = {
              filename: filename,
              volume: this.volume,
              size: content.byteLength
            };
            return _context2.abrupt("return", this.createDataInfo(metadata));

          case 8:
          case "end":
            return _context2.stop();
        }
      }
    }, null, this);
  };

  SciServerFiles.prototype.deleteDir = function _callee3(dirname) {
    var url, opts;
    return _regenerator["default"].async(function _callee3$(_context3) {
      while (1) {
        switch (_context3.prev = _context3.next) {
          case 0:
            url = "data/Storage/".concat(this.volume, "/").concat(dirname);
            opts = {
              method: 'DELETE'
            };
            _context3.next = 4;
            return _regenerator["default"].awrap(this.fetch(url, opts));

          case 4:
            return _context3.abrupt("return", _context3.sent);

          case 5:
          case "end":
            return _context3.stop();
        }
      }
    }, null, this);
  };

  SciServerFiles.prototype.deleteFile = function _callee4(dataInfo) {
    var _dataInfo$data2, volume, filename, url, opts;

    return _regenerator["default"].async(function _callee4$(_context4) {
      while (1) {
        switch (_context4.prev = _context4.next) {
          case 0:
            _dataInfo$data2 = dataInfo.data, volume = _dataInfo$data2.volume, filename = _dataInfo$data2.filename;
            url = "data/Storage/".concat(volume, "/").concat(filename);
            opts = {
              method: 'DELETE'
            };
            _context4.next = 5;
            return _regenerator["default"].awrap(this.fetch(url, opts));

          case 5:
            return _context4.abrupt("return", _context4.sent);

          case 6:
          case "end":
            return _context4.stop();
        }
      }
    }, null, this);
  };

  SciServerFiles.prototype.getMetadata = function _callee5(dataInfo) {
    var metadata;
    return _regenerator["default"].async(function _callee5$(_context5) {
      while (1) {
        switch (_context5.prev = _context5.next) {
          case 0:
            metadata = {
              size: dataInfo.data.size
            };
            return _context5.abrupt("return", metadata);

          case 2:
          case "end":
            return _context5.stop();
        }
      }
    });
  };

  SciServerFiles.prototype.getDownloadURL = function _callee6(dataInfo) {
    var data;
    return _regenerator["default"].async(function _callee6$(_context6) {
      while (1) {
        switch (_context6.prev = _context6.next) {
          case 0:
            data = dataInfo.data;
            return _context6.abrupt("return", data.url);

          case 2:
          case "end":
            return _context6.stop();
        }
      }
    });
  };

  SciServerFiles.prototype._stat = function _callee7(volume, path) {
    var fullpath, url, headers, response;
    return _regenerator["default"].async(function _callee7$(_context7) {
      while (1) {
        switch (_context7.prev = _context7.next) {
          case 0:
            fullpath = volume + '/' + path;
            url = "1/metadata/sandbox/".concat(fullpath, "?list=True&path=").concat(fullpath);
            headers = new Headers();
            headers.append('Content-Type', 'application/xml');
            _context7.next = 6;
            return _regenerator["default"].awrap(this.fetch(url));

          case 6:
            response = _context7.sent;

            if (!(response.status === 404)) {
              _context7.next = 9;
              break;
            }

            return _context7.abrupt("return", null);

          case 9:
            _context7.next = 11;
            return _regenerator["default"].awrap(response.json());

          case 11:
            return _context7.abrupt("return", _context7.sent);

          case 12:
          case "end":
            return _context7.stop();
        }
      }
    }, null, this);
  };

  SciServerFiles.prototype.fetch = function _callee8(url) {
    var opts,
        response,
        status,
        contents,
        _args8 = arguments;
    return _regenerator["default"].async(function _callee8$(_context8) {
      while (1) {
        switch (_context8.prev = _context8.next) {
          case 0:
            opts = _args8.length > 1 && _args8[1] !== undefined ? _args8[1] : {};
            url = BASE_URL + url;
            opts.headers = opts.headers || new Headers();
            opts.headers.append('X-Auth-Token', this.token);
            _context8.next = 6;
            return _regenerator["default"].awrap(fetch(url, opts));

          case 6:
            response = _context8.sent;
            status = response.status;

            if (!(status === 400)) {
              _context8.next = 12;
              break;
            }

            throw new Error('Received "Bad Request" from SciServer. Is the token invalid?');

          case 12:
            if (!(status > 399)) {
              _context8.next = 17;
              break;
            }

            _context8.next = 15;
            return _regenerator["default"].awrap(response.json());

          case 15:
            contents = _context8.sent;
            throw new Error("SciServer Files request failed: ".concat(contents.error));

          case 17:
            return _context8.abrupt("return", response);

          case 18:
          case "end":
            return _context8.stop();
        }
      }
    }, null, this);
  };

  SciServerFiles.prototype.getCachePath = function _callee9(dataInfo) {
    var _dataInfo$data3, volume, filename;

    return _regenerator["default"].async(function _callee9$(_context9) {
      while (1) {
        switch (_context9.prev = _context9.next) {
          case 0:
            _dataInfo$data3 = dataInfo.data, volume = _dataInfo$data3.volume, filename = _dataInfo$data3.filename;
            return _context9.abrupt("return", "".concat(this.id, "/").concat(volume, "/").concat(filename));

          case 2:
          case "end":
            return _context9.stop();
        }
      }
    }, null, this);
  };

  return SciServerFiles;
});


/* globals define */
define('../utils/build-includes.js',['blob/BlobClient', 'deepforge/storage/index', 'deepforge/Constants', 'client/logger', 'deepforge/storage/backends/StorageBackend', 'deepforge/storage/backends/StorageClient', 'deepforge/storage/backends/gme/Client', 'text!deepforge/storage/backends/gme/metadata.json', 'deepforge/storage/backends/sciserver-files/Client', 'text!deepforge/storage/backends/sciserver-files/metadata.json', 'deepforge/storage/index'], function (BlobClient, Storage, Constants, Logger) {
  return {
    BlobClient: BlobClient,
    Storage: Storage,
    Constants: Constants,
    Logger: Logger
  };
});
/* globals define */
define([
    'blob/BlobClient',
    'deepforge/storage/index',
    'deepforge/Constants',
    'client/logger',
    'deepforge/storage/backends/StorageBackend',
    'deepforge/storage/backends/StorageClient',
    'deepforge/storage/backends/gme/Client',
    'text!deepforge/storage/backends/gme/metadata.json',
    'deepforge/storage/backends/sciserver-files/Client',
    'text!deepforge/storage/backends/sciserver-files/metadata.json',
    'deepforge/storage/index',
    
], function(
    BlobClient,
    Storage,
    Constants,
    Logger,
) {
    return {BlobClient, Storage, Constants, Logger};
});
