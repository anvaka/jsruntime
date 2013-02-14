/*!
 * Chrome JS runtime inspector plugin v0.1
 * Copyright 2013 Andrei Kashcha <https://github.com/anvaka/>
 * Based on Spotlight.js v1.0.0-pre <http://github.com/bestiejs/spotlight.js/>
 * Copyright 2011-2012 John-David Dalton <http://allyoucanleet.com/>
 * Based on Waldo <http://github.com/angus-c/waldo/>,
 * Copyright 2011-2012 Angus Croll <http://javascriptweblog.wordpress.com/>
 * All librareis are available under MIT license <http://mths.be/mit>
 */
function findAll(searchType, query, isStrict) {
  'use strict';

  /* Used as the starting point(s) for the object crawler */
  var defaultRoots = [{ 'object': window, 'path': 'window' }];

  /** Used to crawl all properties regardless of enumerability */
  var getAllKeys = Object.getOwnPropertyNames;

  /** Used in case an object doesn't have its own method */
  var hasOwnProperty = {}.hasOwnProperty;

  /** Used to resolve a value's internal [[Class]] */
  var toString = {}.toString;

  /** Some sites may override console.log, dir and error */
  var consoleLog = Object.getPrototypeOf(console).log.bind(console);
  var consoleDir = Object.getPrototypeOf(console).dir.bind(console);
  var consoleError = Object.getPrototypeOf(console).error.bind(console);


  /** Filter functions used by `crawl()` */
  var filters = {
    'custom': function(value, key, object) {
      // the `this` binding is set by `crawl()`
      return value.call(this, object[key], key, object);
    },
    'kind': function(value, key, object) {
      var kind = [value, value = object[key]][0];
      return kind == '*' || (isFunction(kind)
        ? value instanceof kind
        : typeof value == kind || getKindOf(value).toLowerCase() == kind.toLowerCase()
      );
    },
    'name': isStrict ? function (value, key, object) {
        return value == key;
      } : function (value, key, object) {
        return value.test(key);
      },
    'value': function(value, key, object) {
      return object[key] === value;
    }
  };

  /*--------------------------------------------------------------------------*/

  /**
   * Returns the first array value for which `callback` returns true.
   *
   * @private
   * @param {Array} array The array to search.
   * @param {Function} callback A function executed per array value .
   * @returns {Mixed} The filtered value.
   */
  function filterOne(array, callback) {
    var length = array.length;
    while (length--) {
      if (callback(array[length])) {
        return array[length];
      }
    }
  }

  /**
   * Iterates over an object's own properties, executing the `callback` for each.
   * Callbacks may terminate the loop by explicitly returning `false`.
   *
   * @private
   * @param {Object} object The object to iterate over.
   * @param {Function} callback A function executed per own property.
   */
  function forOwn() {
    var forShadowed,
        skipSeen,
        forArgs = true,
        shadowed = ['constructor', 'hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable', 'toLocaleString', 'toString', 'valueOf'];

    // lazy define
    forOwn = function(object, callback) {
      var ctor,
          iterator,
          key,
          length,
          skipCtor,
          value,
          done = !object,
          index = -1,
          keys = [],
          seen = {};

      object = Object(object);

      // if possible search all properties
      try {
        keys = getAllKeys(object);
      } catch(e) { }

      if ((length = keys.length)) {
        while (++index < length) {
          key = keys[index];
          try {
            value = object[key];
          } catch(e) {
            continue;
          }
          if (callback(value, key, object) === false) {
            break;
          }
        }
        return;
      }
      
      // else search only enumerable properties
      try {
        // avoid problems with iterators
        // https://github.com/ringo/ringojs/issues/157
        for (key in object) {
          break;
        }
      } catch(e) {
        return;
      }

      for (key in object) {
        // iterators will assign an array to `key`
        if (iterator) {
          value = key[1];
          key = key[0];
        }
        else {
          value = object[key];
        }

        if (done =
            (iterator || hasKey(object, key)) &&
            callback(value, key, object) === false) {
          break;
        }
      }
      if (!done && forArgs && isArguments(object)) {
        for (index = 0, length = object.length; index < length; index++) {
          if (done =
              callback(object[index], String(index), object) === false) {
            break;
          }
        }
      }
      if (!done && forShadowed) {
        // Because IE < 9 can't set the `[[Enumerable]]` attribute of an existing
        // property and the `constructor` property of a prototype defaults to
        // non-enumerable, we manually skip the `constructor` property when we
        // think we are iterating over a `prototype` object.
        ctor = object.constructor;
        skipCtor = ctor && ctor.prototype && ctor.prototype.constructor === ctor;
        for (index = 0; key = shadowed[index]; index++) {
          if (!(skipCtor && key == 'constructor') &&
              hasKey(object, key) &&
              callback(object[key], key, object) === false) {
            break;
          }
        }
      }
    };
    forOwn.apply(null, arguments);
  }

  /**
   * Mimics ES 5.1's `Object.prototype.toString` behavior by returning the
   * value's [[Class]], "Null" or "Undefined" as well as other non-spec'ed results
   * like "Constructor" and "Global" .
   *
   * @private
   * @param {Mixed} value The value to check.
   * @returns {String} Returns a string representing the kind of `value`.
   */
  function getKindOf(value) {
    var result;

    if (value == null) {
      result = value === null ? 'Null' : 'Undefined';
    }
    else if (value == window) {
      result = 'Global';
    }
    else if (isFunction(value) && isHostType(value, 'prototype')) {
      // a function is assumed of kind "Constructor" if it has its own
      // enumerable prototype properties or doesn't have a [[Class]] of Object
      try {
        if (toString.call(value.prototype) == '[object Object]') {
          for (var key in value.prototype) {
            result = 'Constructor';
            break;
          }
        } else {
          result = 'Constructor';
        }
      } catch(e) { }
    }
    return result || (toString.call(value).match(/^\[object (.*?)\]$/) || 0)[1] ||
      (result = typeof value, result.charAt(0).toUpperCase() + result.slice(1))
  }

  /**
   * Checks if an object has the specified key as a direct property.
   *
   * @private
   * @param {Object} object The object to check.
   * @param {String} key The key to check for.
   * @returns {Boolean} Returns `true` if key is a direct property, else `false`.
   */
  function hasKey(object, key) {
    return object != null && hasOwnProperty.call(Object(object), key);
  }

  /**
   * Checks if a value is an `arguments` object.
   *
   * @private
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true` if the value is an `arguments` object, else `false`.
   */
  function isArguments() {
    // lazy define
    isArguments = function(value) {
      return toString.call(value) == '[object Arguments]';
    };
    if (!isArguments(arguments)) {
      isArguments = function(value) {
        return !!value && hasKey(value, 'callee');
      };
    }
    return isArguments(arguments[0]);
  }

  /**
   * Checks if the specified `value` is a function.
   *
   * @private
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true` if `value` is a function, else `false`.
   */
  function isFunction(value) {
    return toString.call(value) == '[object Function]';
  }

  /**
   * Host objects can return type values that are different from their actual
   * data type. The objects we are concerned with usually return non-primitive
   * types of object, function, or unknown.
   *
   * @private
   * @param {Mixed} object The owner of the property.
   * @param {String} property The property to check.
   * @returns {Boolean} Returns `true` if the property value is a non-primitive, else `false`.
   */
  function isHostType(object, property) {
    var type = object != null ? typeof object[property] : 'number';
    return !/^(?:boolean|number|string|undefined)$/.test(type) &&
      (type == 'object' ? !!object[property] : true);
  }

  /**
   * Checks if the specified `value` is an Object object.
   *
   * @private
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true` if `value` is an object, else `false`.
   */
  function isObject(value) {
    var ctor,
        result = !!value && toString.call(value) == '[object Object]';

    // some objects like `window.java` may kill script execution when checking
    // for their constructor, so we filter by [[Class]] first
    if (result) {
      // IE < 9 presents nodes like Object objects:
      // IE < 8 are missing the node's constructor property
      // IE 8 node constructors are typeof "object"
      try {
        // some properties throw errors when accessed
        ctor = value.constructor;
      } catch(e) { }
      // check if the constructor is `Object` as `Object instanceof Object` is `true`
      result = isFunction(ctor);// && ctor instanceof ctor;
    }
    return result;
  }

  /*--------------------------------------------------------------------------*/

  /**
   * Performs argument type checks and calls `crawl()` with specified arguments.
   *
   * @private
   * @param {String} name The name of the filter function passed.
   * @param {String} expected The data type expected of the given value.
   * @param {Mixed} value A generic argument passed to the callback.
   * @param {Object} [options={}] The options object passed.
   * @returns {Array|Null} If in debug mode return the value of the invoked function or `null` if errored.
   */
  function checkCall(name, expected, value, options) {
    var result = (!expected || RegExp('^(?:' + expected + ')$', 'i').test(getKindOf(value)))
      ? crawl(name, value, options)
      : console.error('`' + value + '` must be a ' + expected.split('|').join(' or '));
  }

  /**
   * Crawls environment objects logging all properties that pass the callback filter.
   *
   * @private
   * @param {Function|String} callback A function executed per object encountered.
   * @param {Mixed} callbackArg An argument passed to the callback.
   * @param {Object} [options={}] The options object.
   * @returns {Array} An array of arguments passed to each `console.log()` call.
   */
  function crawl(callback, callbackArg, options) {
    callback = filters[callback] || callback;
    options || (options = {});

    var data,
        index,
        pool,
        pooled,
        queue,
        separator,
        roots = defaultRoots.slice(),
        object = options.object || roots[0].object,
        path = options.path,
        result = [];

    console.time('Completed in');
    // resolve undefined path
    if (path == null) {
      path = (
        filterOne(roots, function(data) {
          return object == data.object;
        }) ||
        { 'path': '<object>' }
      ).path;
    }
    // resolve object roots
    if (options.object) {
      roots = [{ 'object': object, 'path': path }];
    }
    // crawl all root objects
    while ((data = roots.pop())) {
      index = 0;
      object = data.object;
      path = data.path;
      data = { 'object': object, 'path': path, 'pool': [object] };
      queue = [];

      // a non-recursive solution to avoid call stack limits
      // http://www.jslab.dk/articles/non.recursive.preorder.traversal.part4
      do {
        object = data.object;
        path = data.path;
        separator = path ? '.' : '';

        forOwn(object, function(value, key) {
          // inspect objects
          if (isObject(value) || isFunction(value)) {
            // clone current pool per prop on the current `object` to avoid
            // sibling properties from polluting each others object pools
            pool = data.pool.slice();

            // check if already pooled (prevents infinite loops when handling circular references)
            pooled = filterOne(pool, function(data) {
              return value == data.object;
            });
            // add to the "call" queue
            if (!pooled) {
              pool.push({ 'object': value, 'path': path + separator + key, 'pool': pool });
              queue[queue.length] = pool[pool.length - 1];
            }
          }
          // if filter passed, log it
          // (IE may throw errors coercing properties like `window.external` or `window.navigator`)
          try {
            if (callback.call(data, callbackArg, key, object)) {
              result.push([
                path + separator + key + ' -> ',
                value
              ]);
              consoleLog(result[result.length - 1][0]);
              consoleDir(value);
              consoleLog(' ');
            }
          } catch(e) { }
        });
      } while ((data = queue[index++]));
    }
    console.timeEnd('Completed in');
    consoleLog('Matches found: ' + result.length);
    return result;
  }

  /*--------------------------------------------------------------------------*/

  /**
   * Crawls environment objects logging all object properties whose values
   * are of a specified constructor instance, [[Class]], or type.
   *
   * @memberOf spotlight
   * @param {Function|String} kind The constructor, [[Class]], or type to check against.
   * @param {Object} [options={}] The options object.
   * @example
   *
   * // by constructor
   * spotlight.byKind(jQuery);
   *
   * // or by [[Class]]
   * spotlight.byKind('RegExp');
   *
   * // or by type
   * spotlight.byKind('undefined');
   *
   * // or special kind "constructor"
   * spotlight.byKind('constructor');
   */
  function byKind(kind, options) {
    return checkCall('kind', 'function|string', kind, options);
  }

  /**
   * Crawls environment objects logging all object properties of the specified name.
   *
   * @memberOf spotlight
   * @param {String} name The property name to search for.
   * @param {Object} [options={}] The options object.
   * @example
   *
   * // basic
   * // > window.length -> (number) 0
   * spotlight.byName('length');
   *
   * // or with options
   * // (finds all "map" properties on jQuery)
   * // > $.map -> (function) function(a,b,c){...}
   * // > $.fn.map -> (function) function(a){...}
   * spotlight.byName('map', { 'object': jQuery, 'path': '$' });
   */
  function byName(name, options) {
    return checkCall('name', 'string|RegExp', name, options);
  }

  /**
   * Crawls environment objects logging all object properties whose values are
   * a strict match for the specified value.
   *
   * @memberOf spotlight
   * @param {Mixed} value The value to search for.
   * @param {Object} [options={}] The options object.
   * @example
   *
   * // basic
   * // > window.pageXOffset -> (number) 0
   * // > window.screenX -> (number) 0
   * // > window.length -> (number) 0
   * spotlight.byValue(0);
   */
  function byValue(value, options) {
    return checkCall('value', null, value, options);
  }

  /**
   * Crawls environment objects executing `callback`, passing the current
   * `value`, `key`, and `object` as arguments, against each object encountered
   * and logs properties for which `callback` returns true.
   *
   * @memberOf spotlight
   * @param {Function} callback A function executed per object.
   * @param {Object} [options={}] The options object.
   * @example
   *
   * // filter by property names containing "oo"
   * spotlight.custom(function(value, key) { return key.indexOf('oo') > -1; });
   *
   * // or filter by falsey values
   * spotlight.custom(function(value) { return !value; });
   */
  function custom(callback, options) {
    return checkCall('custom', 'function', callback, options);
  }

  /*--------------------------------------------------------------------------*/

  switch (searchType) {
    case 'byKind': byKind(query); break; 
    case 'byName': 
      byName(isStrict ? query : new RegExp(query, 'i'));
      break;
    case 'byValue':
      if (!isStrict && typeof query === 'string') {
        query = new RegExp(query, 'i');
        filters['value'] = function(value, key, object) {
          return value.test(object[key]);
        }
      }
      byValue(query);
      break;
    case 'custom': custom(query); break;
    default: consoleError('Invalid search request - unknown search type');
  };
}