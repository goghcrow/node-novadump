"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var assert = require("assert");
var BigNumber = require("bignumber.js");

if (!Buffer.allocUnsafe) {
  Buffer.allocUnsafe = function (size) {
    return new Buffer(size);
  };
}

function encodeInt64(x) {
  if (!(x instanceof BigNumber)) {
    x = new BigNumber(x);
  }
  x = x.toString(16);
  var nega = false;
  if (x[0] === '-') {
    nega = true;
    x = x.slice(1);
  }
  var low = parseInt(x.slice(-8), 16) || 0;
  var high = parseInt(x.slice(-16, -8), 16) || 0;
  if (nega) {
    low = ~low + 1 >>> 0;
    high = ~high + !low >>> 0;
  }
  return { low: low, high: high };
}

function decodeInt64(_ref) {
  var low = _ref.low,
      high = _ref.high;

  var nega = high & 0x80000000;
  if (nega) {
    low = ~low + 1 >>> 0;
    high = ~high + !low >>> 0;
  }
  var result = (nega ? '-' : '') + high.toString(16) + ('00000000' + low.toString(16)).slice(-8);
  return new BigNumber(result, 16);
}

// The 'assertSize' method will remove itself from the callstack when an error
// occurs. This is done simply to keep the internal details of the
// implementation from bleeding out to users.
function assertSize(size) {
  var err = null;

  if (typeof size !== 'number') {
    err = new TypeError('"size" argument must be a number');
  } else if (size < 0) {
    err = new RangeError('"size" argument must not be negative');
  }

  if (err) {
    // https://www.bennadel.com/blog/2828-creating-custom-error-objects-in-node-js-with-error-capturestacktrace.htm
    // Capture the current stacktrace and store it in the property "this.stack". By
    // providing the implementationContext argument, we will remove the current
    // constructor (or the optional factory function) line-item from the stacktrace; this
    // is good because it will reduce the implementation noise in the stack property.
    // --
    // Rad More: https://code.google.com/p/v8-wiki/wiki/JavaScriptStackTraceApi#Stack_trace_collection_for_custom_exceptions
    // 这里会在调用栈中移除assertSize的栈帧
    Error.captureStackTrace(err, assertSize);
    throw err;
  }
}

/// A buffer class modeled after org.jboss.netty.buffer.ChannelBuffer
///
/// @code
/// +-------------------+------------------+------------------+
/// | prependable bytes |  readable bytes  |  writable bytes  |
/// |                   |     (CONTENT)    |                  |
/// +-------------------+------------------+------------------+
/// |                   |                  |                  |
/// 0      <=      readerIndex   <=   writerIndex    <=     size
/// @endcode
/// https://github.com/chenshuo/muduo/blob/master/muduo/net/Buffer.h

var CheapPrepend = 8;
var InitialSize = 1024;
var CRLF = "\r\n";

module.exports = function () {
  function MuduoBuffer() {
    var initialSize = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : InitialSize;

    _classCallCheck(this, MuduoBuffer);

    assertSize(initialSize);
    this._readIndex = CheapPrepend;
    this._writeIndex = CheapPrepend;
    this._buffer = Buffer.allocUnsafe(CheapPrepend + initialSize);
  }

  _createClass(MuduoBuffer, [{
    key: "readableBytes",
    value: function readableBytes() {
      return this._writeIndex - this._readIndex;
    }
  }, {
    key: "writableBytes",
    value: function writableBytes() {
      return (this._buffer.byteLength || this._buffer.length) - this._writeIndex;
    }
  }, {
    key: "prependableBytes",
    value: function prependableBytes() {
      return this._readIndex;
    }
  }, {
    key: "findCRLF",
    value: function findCRLF() {
      // TODO
    }
  }, {
    key: "findEOL",
    value: function findEOL() {}
    // TODO


    // skip

  }, {
    key: "retrieve",
    value: function retrieve(len) {
      assertSize(len);
      assert(len <= this.readableBytes());
      if (len < this.readableBytes()) {
        this._readIndex += len;
      } else {
        this.retrieveAll();
      }
    }

    // skip to

  }, {
    key: "retrieveUntil",
    value: function retrieveUntil(end) {
      assertSize(end);
      assert(this._readIndex <= end);
      assert(end <= this._writeIndex);
      this.retrieve(end - this._readIndex);
    }
  }, {
    key: "retrieveInt64",
    value: function retrieveInt64() {
      this.retrieve(8);
    }
  }, {
    key: "retrieveUInt64",
    value: function retrieveUInt64() {
      this.retrieve(8);
    }
  }, {
    key: "retrieveInt32",
    value: function retrieveInt32() {
      this.retrieve(4);
    }
  }, {
    key: "retrieveUInt32",
    value: function retrieveUInt32() {
      this.retrieve(4);
    }
  }, {
    key: "retrieveInt16",
    value: function retrieveInt16() {
      this.retrieve(2);
    }
  }, {
    key: "retrieveUInt16",
    value: function retrieveUInt16() {
      this.retrieve(2);
    }
  }, {
    key: "retrieveInt8",
    value: function retrieveInt8() {
      this.retrieve(1);
    }
  }, {
    key: "retrieveUInt8",
    value: function retrieveUInt8() {
      this.retrieve(1);
    }

    // skipall, reset

  }, {
    key: "retrieveAll",
    value: function retrieveAll() {
      this._readIndex = CheapPrepend;
      this._writeIndex = CheapPrepend;
    }
  }, {
    key: "retrieveAllAsString",
    value: function retrieveAllAsString() {
      return this.retrieveAsString(this.readableBytes());
    }

    // read len string

  }, {
    key: "retrieveAsString",
    value: function retrieveAsString(len) {
      var result = this.peekAsString(len);
      this.retrieve(len);
      return result;
    }
  }, {
    key: "append",
    value: function append(data /*: string|Buffer*/) {
      var len = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : void 0;

      if (data instanceof Buffer) {
        if (len === void 0) {
          len = data.byteLength || data.length;
        } else {
          assert(len <= (data.byteLength || data.length));
        }
        this.ensureWritableBytes(len);
        data.copy(this._buffer, this._writeIndex, 0, len);
      } else {
        if (len === void 0) {
          len = data.length;
        } else {
          assert(len <= data.length);
        }
        this.ensureWritableBytes(len);
        this._buffer.write(data, this._writeIndex, len);
      }
      this.hasWritten(len);
    }
  }, {
    key: "ensureWritableBytes",
    value: function ensureWritableBytes(len) {
      assertSize(len);
      if (this.writableBytes() < len) {
        this._makeSpace(len);
      }
      assert(this.writableBytes() >= len);
    }
  }, {
    key: "hasWritten",
    value: function hasWritten(len) {
      assertSize(len);
      assert(len <= this.writableBytes());
      this._writeIndex += len;
    }
  }, {
    key: "unwrite",
    value: function unwrite(len) {
      assertSize(len);
      assert(len <= this.readableBytes());
      this._writeIndex -= len;
    }
  }, {
    key: "appendInt64",
    value: function appendInt64(x) {
      this.ensureWritableBytes(8);

      var _encodeInt = encodeInt64(x),
          low = _encodeInt.low,
          high = _encodeInt.high;

      this._buffer.writeUInt32BE(high, this._writeIndex);
      this._buffer.writeUInt32BE(low, this._writeIndex + 4);
      this.hasWritten(8);
      return this;
    }
  }, {
    key: "appendUInt64",
    value: function appendUInt64(x) {
      return this.appendInt64(x);
    }
  }, {
    key: "appendInt32",
    value: function appendInt32(x) {
      return this._write("Int32BE", 4, x);
    }
  }, {
    key: "appendUInt32",
    value: function appendUInt32(x) {
      return this._write("UInt32BE", 4, x);
    }
  }, {
    key: "appendInt16",
    value: function appendInt16(x) {
      return this._write("Int16BE", 2, x);
    }
  }, {
    key: "appendUInt16",
    value: function appendUInt16(x) {
      return this._write("UInt16BE", 2, x);
    }
  }, {
    key: "appendInt8",
    value: function appendInt8(x) {
      return this._write("Int8", 1, x);
    }
  }, {
    key: "appendUInt8",
    value: function appendUInt8(x) {
      return this._write("UInt8", 1, x);
    }

    /**
     * @param {Number} len 
     * @return {Buffer}
     */

  }, {
    key: "read",
    value: function read(len) {
      var result = this.peek(len);
      this.retrieve(len);
      return result;
    }

    /// Require: buf->readableBytes() >= sizeof(int32_t)

  }, {
    key: "readInt64",
    value: function readInt64() {
      var result = this.peekInt64();
      this.retrieveInt64();
      return result;
    }
  }, {
    key: "readUInt64",
    value: function readUInt64() {
      var result = this.peekUInt64();
      this.retrieveUInt64();
      return result;
    }

    /// Require: buf->readableBytes() >= sizeof(int32_t)

  }, {
    key: "readInt32",
    value: function readInt32() {
      var result = this.peekInt32();
      this.retrieveInt32();
      return result;
    }
  }, {
    key: "readUInt32",
    value: function readUInt32() {
      var result = this.peekUInt32();
      this.retrieveUInt32();
      return result;
    }
  }, {
    key: "readInt16",
    value: function readInt16() {
      var result = this.peekInt16();
      this.retrieveInt16();
      return result;
    }
  }, {
    key: "readUInt16",
    value: function readUInt16() {
      var result = this.peekUInt16();
      this.retrieveUInt16();
      return result;
    }
  }, {
    key: "readInt8",
    value: function readInt8() {
      var result = this.peekInt8();
      this.retrieveInt8();
      return result;
    }
  }, {
    key: "readUInt8",
    value: function readUInt8() {
      var result = this.peekUInt8();
      this.retrieveUInt8();
      return result;
    }

    /**
     * @param {Number} len 
     * @return {Buffer}  
     */

  }, {
    key: "peek",
    value: function peek(len) {
      var offset = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;

      assertSize(len);
      assertSize(offset);
      assert(len + offset <= this.readableBytes());
      return this._buffer.slice(this._readIndex + offset, this._readIndex + offset + len);
    }
  }, {
    key: "peekAsString",
    value: function peekAsString(len) {
      var offset = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;

      assertSize(len);
      assertSize(offset);
      assert(len + offset <= this.readableBytes());
      return this._buffer.toString("utf8", this._readIndex + offset, this._readIndex + offset + len);
    }

    /// Require: buf->readableBytes() >= sizeof(int64_t)

  }, {
    key: "peekInt64",
    value: function peekInt64() {
      var offset = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;

      assert(this.readableBytes() >= 8 + offset);
      var high = this._buffer.readUInt32BE(this._readIndex + offset);
      var low = this._buffer.readUInt32BE(this._readIndex + offset + 4);
      return decodeInt64({ low: low, high: high });
    }
  }, {
    key: "peekUInt64",
    value: function peekUInt64() {
      var offset = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;

      return this.peekInt64(offset);
    }

    /// Require: buf->readableBytes() >= sizeof(int32_t)

  }, {
    key: "peekInt32",
    value: function peekInt32() {
      var offset = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;

      return this._peek("Int32BE", 4, offset);
    }
  }, {
    key: "peekUInt32",
    value: function peekUInt32() {
      var offset = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;

      return this._peek("UInt32BE", 4, offset);
    }
  }, {
    key: "peekInt16",
    value: function peekInt16() {
      var offset = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;

      return this._peek("Int16BE", 2, offset);
    }
  }, {
    key: "peekUInt16",
    value: function peekUInt16() {
      var offset = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;

      return this._peek("UInt16BE", 2, offset);
    }
  }, {
    key: "peekInt8",
    value: function peekInt8() {
      var offset = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;

      return this._peek("Int8", 1, offset);
    }
  }, {
    key: "peekUInt8",
    value: function peekUInt8() {
      var offset = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;

      return this._peek("UInt8", 1, offset);
    }
  }, {
    key: "prependInt64",
    value: function prependInt64(x) {
      assert(8 <= this.prependableBytes());
      this._readIndex -= 8;

      var _encodeInt2 = encodeInt64(x),
          low = _encodeInt2.low,
          high = _encodeInt2.high;

      this._buffer.writeUInt32BE(high, this._readIndex);
      this._buffer.writeUInt32BE(low, this._readIndex + 4);
    }
  }, {
    key: "prependUInt64",
    value: function prependUInt64(x) {
      return this.prependInt64(x);
    }
  }, {
    key: "prependInt32",
    value: function prependInt32(x) {
      return this._prepend("Int32BE", 4, x);
    }
  }, {
    key: "prependUInt32",
    value: function prependUInt32(x) {
      return this._prepend("UInt32BE", 4, x);
    }
  }, {
    key: "prependInt16",
    value: function prependInt16(x) {
      return this._prepend("Int16BE", 2, x);
    }
  }, {
    key: "prependUInt16",
    value: function prependUInt16(x) {
      return this._prepend("UInt16BE", 2, x);
    }
  }, {
    key: "prependInt8",
    value: function prependInt8(x) {
      return this._prepend("Int8", 1, x);
    }
  }, {
    key: "prependUInt8",
    value: function prependUInt8(x) {
      return this._prepend("UInt8", 1, x);
    }
  }, {
    key: "prependString",
    value: function prependString(str) {
      var len = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : void 0;

      assert(typeof str === "string");
      if (len === void 0) {
        len = str.length;
      }
      assert(len <= this.prependableBytes());
      this._readIndex -= len;
      this._buffer.write(str, this._readIndex, len);
    }
  }, {
    key: "shrink",
    value: function shrink(reserve) {
      assertSize(reserve);
      this._swap(CheapPrepend + this.readableBytes() + reserve);
    }
  }, {
    key: "internalCapacity",
    value: function internalCapacity() {
      return this._buffer.byteLength || this._buffer.length;
    }
  }, {
    key: "toString",
    value: function toString() {
      var _buffer$slice;

      return (_buffer$slice = this._buffer.slice(this._readIndex, this._writeIndex)).toString.apply(_buffer$slice, arguments);
    }

    /// private:
    /// _readIndex
    /// _writeIndex

  }, {
    key: "_write",
    value: function _write(type, len, data) {
      this.ensureWritableBytes(len);
      this._buffer["write" + type](data, this._writeIndex);
      this.hasWritten(len);
      return this;
    }
  }, {
    key: "_peek",
    value: function _peek(type, len) {
      var offset = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;

      assertSize(len);
      assertSize(offset);
      assert(this.readableBytes() >= len + offset);
      return this._buffer["read" + type](this._readIndex + offset);
    }
  }, {
    key: "_prepend",
    value: function _prepend(type, len, data) {
      assertSize(len);
      assert(len <= this.prependableBytes());
      this._readIndex -= len;

      if (type === "") {
        this._buffer.write(data, this._readIndex, len);
      } else {
        this._buffer["write" + type](data, this._readIndex);
      }
    }
  }, {
    key: "_makeSpace",
    value: function _makeSpace(len) {
      assertSize(len);
      var readable = this.readableBytes();

      if (this.writableBytes() + this.prependableBytes() < len + CheapPrepend) {
        this._swap(this._writeIndex + len);
      } else {
        // move readable data to the front, make space inside buffer
        this._buffer.copy(this._buffer, CheapPrepend, this._readIndex, this._writeIndex);
        this._readIndex = CheapPrepend;
        this._writeIndex = CheapPrepend + readable;
      }

      assert(readable === this.readableBytes());
    }
  }, {
    key: "_swap",
    value: function _swap(size) {
      var readable = this.readableBytes();
      assertSize(size);
      assert(size >= readable);
      var other = Buffer.allocUnsafe(size);
      this._buffer.copy(other, CheapPrepend, this._readIndex, this._writeIndex);
      this._readIndex = CheapPrepend;
      this._writeIndex = CheapPrepend + readable;
      this._buffer = other;
    }
  }, {
    key: "byteLength",
    get: function get() {
      return this._writeIndex - this._readIndex;
    }
  }, {
    key: "length",
    get: function get() {
      return this._writeIndex - this._readIndex;
    }
  }]);

  return MuduoBuffer;
}();