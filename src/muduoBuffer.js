const assert = require("assert")
const BigNumber = require("bignumber.js")

if (!Buffer.allocUnsafe) {
  Buffer.allocUnsafe = function(size) {
    return new Buffer(size)
  }
}

function encodeInt64(x) {
  if (!(x instanceof BigNumber)) {
    x = new BigNumber(x)
  }
  x = x.toString(16)
  let nega = false
  if (x[0] === '-') {
    nega = true
    x = x.slice(1)
  }
  let low = parseInt(x.slice(-8), 16) || 0
  let high = parseInt(x.slice(-16, -8), 16) || 0
  if (nega) {
    low = ~low + 1 >>> 0
    high = ~high + !low >>> 0
  }
  return { low, high }
}

function decodeInt64({ low, high }) {
  let nega = high & 0x80000000
  if (nega) {
    low = ~low + 1 >>> 0
    high = ~high + !low >>> 0
  }
  let result = (nega ? '-' : '') + high.toString(16) + ('00000000' + low.toString(16)).slice(-8)
  return new BigNumber(result, 16)
}

// The 'assertSize' method will remove itself from the callstack when an error
// occurs. This is done simply to keep the internal details of the
// implementation from bleeding out to users.
function assertSize(size) {
  let err = null

  if (typeof size !== 'number') {
    err = new TypeError('"size" argument must be a number');
  } else if (size < 0) {
    err = new RangeError('"size" argument must not be negative')
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
    Error.captureStackTrace(err, assertSize)
    throw err
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

const CheapPrepend = 8
const InitialSize = 1024
const CRLF = "\r\n"

module.exports = class MuduoBuffer {

  constructor(initialSize = InitialSize) {
    assertSize(initialSize)
    this._readIndex = CheapPrepend
    this._writeIndex = CheapPrepend
    this._buffer = Buffer.allocUnsafe(CheapPrepend + initialSize)
  }

  get byteLength() {
    return this._writeIndex - this._readIndex
  }

  readableBytes() {
    return this._writeIndex - this._readIndex
  }

  writableBytes() {
    return this._buffer.byteLength - this._writeIndex
  }

  prependableBytes() {
    return this._readIndex
  }

  findCRLF() {
    // TODO
  }

  findEOL() {
    // TODO
  }

  // skip
  retrieve(len) {
    assertSize(len)
    assert(len <= this.readableBytes())
    if (len < this.readableBytes()) {
      this._readIndex += len
    } else {
      this.retrieveAll()
    }
  }

  // skip to
  retrieveUntil(end) {
    assertSize(end)
    assert(this._readIndex <= end)
    assert(end <= this._writeIndex)
    this.retrieve(end - this._readIndex)
  }

  retrieveInt64() {
    this.retrieve(8)
  }

  retrieveUInt64() {
    this.retrieve(8)
  }

  retrieveInt32() {
    this.retrieve(4)
  }

  retrieveUInt32() {
    this.retrieve(4)
  }

  retrieveInt16() {
    this.retrieve(2)
  }

  retrieveUInt16() {
    this.retrieve(2)
  }

  retrieveInt8() {
    this.retrieve(1)
  }

  retrieveUInt8() {
    this.retrieve(1)
  }

  // skipall, reset
  retrieveAll() {
    this._readIndex = CheapPrepend
    this._writeIndex = CheapPrepend
  }

  retrieveAllAsString() {
    return this.retrieveAsString(this.readableBytes())
  }

  // read len string
  retrieveAsString(len) {
    let result = this.peekAsString(len)
    this.retrieve(len)
    return result
  }

  append(data /*: string|Buffer*/, len = void 0) {
    if (data instanceof Buffer) {
      if (len === void 0) {
        len = data.byteLength
      } else {
        assert(len <= data.byteLength)
      }
      this.ensureWritableBytes(len)
      data.copy(this._buffer, this._writeIndex, 0, len)
    } else {
      if (len === void 0) {
        len = data.length
      } else {
        assert(len <= data.length)
      }
      this.ensureWritableBytes(len)
      this._buffer.write(data, this._writeIndex, len)
    }
    this.hasWritten(len)
  }

  ensureWritableBytes(len) {
    assertSize(len)
    if (this.writableBytes() < len) {
      this._makeSpace(len)
    }
    assert(this.writableBytes() >= len)
  }

  hasWritten(len) {
    assertSize(len)
    assert(len <= this.writableBytes())
    this._writeIndex += len
  }

  unwrite(len) {
    assertSize(len)
    assert(len <= this.readableBytes())
    this._writeIndex -= len
  }

  appendInt64(x) {
    this.ensureWritableBytes(8)
    let { low, high } = encodeInt64(x)
    this._buffer.writeUInt32BE(high, this._writeIndex)
    this._buffer.writeUInt32BE(low, this._writeIndex + 4)
    this.hasWritten(8)
    return this
  }

  appendUInt64(x) {
    return this.appendInt64(x)
  }

  appendInt32(x) {
    return this._write("Int32BE", 4, x)
  }

  appendUInt32(x) {
    return this._write("UInt32BE", 4, x)
  }

  appendInt16(x) {
    return this._write("Int16BE", 2, x)
  }

  appendUInt16(x) {
    return this._write("UInt16BE", 2, x)
  }

  appendInt8(x) {
    return this._write("Int8", 1, x)
  }

  appendUInt8(x) {
    return this._write("UInt8", 1, x)
  }

  /**
   * @param {Number} len 
   * @return {Buffer}
   */
  read(len) {
    let result = this.peek(len)
    this.retrieve(len)
    return result
  }

  /// Require: buf->readableBytes() >= sizeof(int32_t)
  readInt64() {
    let result = this.peekInt64()
    this.retrieveInt64()
    return result
  }

  readUInt64() {
    let result = this.peekUInt64()
    this.retrieveUInt64()
    return result
  }

  /// Require: buf->readableBytes() >= sizeof(int32_t)
  readInt32() {
    let result = this.peekInt32()
    this.retrieveInt32()
    return result
  }

  readUInt32() {
    let result = this.peekUInt32()
    this.retrieveUInt32()
    return result
  }

  readInt16() {
    let result = this.peekInt16()
    this.retrieveInt16()
    return result
  }

  readUInt16() {
    let result = this.peekUInt16()
    this.retrieveUInt16()
    return result
  }

  readInt8() {
    let result = this.peekInt8()
    this.retrieveInt8()
    return result
  }

  readUInt8() {
    let result = this.peekUInt8()
    this.retrieveUInt8()
    return result
  }

  /**
   * @param {Number} len 
   * @return {Buffer}  
   */
  peek(len, offset = 0) {
    assertSize(len)
    assertSize(offset)
    assert(len + offset <= this.readableBytes())
    return this._buffer.slice(this._readIndex + offset, this._readIndex + offset + len)
  }

  peekAsString(len, offset = 0) {
    assertSize(len)
    assertSize(offset)
    assert(len + offset <= this.readableBytes())
    return this._buffer.toString("utf8", this._readIndex + offset, this._readIndex + offset + len)
  }

  /// Require: buf->readableBytes() >= sizeof(int64_t)
  peekInt64(offset = 0) {
    assert(this.readableBytes() >= 8 + offset)
    let high = this._buffer.readUInt32BE(this._readIndex + offset)
    let low = this._buffer.readUInt32BE(this._readIndex + offset + 4)
    return decodeInt64({ low, high })
  }

  peekUInt64(offset = 0) {
    return this.peekInt64(offset)
  }

  /// Require: buf->readableBytes() >= sizeof(int32_t)
  peekInt32(offset = 0) {
    return this._peek("Int32BE", 4, offset)
  }

  peekUInt32(offset = 0) {
    return this._peek("UInt32BE", 4, offset)
  }

  peekInt16(offset = 0) {
    return this._peek("Int16BE", 2, offset)
  }

  peekUInt16(offset = 0) {
    return this._peek("UInt16BE", 2, offset)
  }

  peekInt8(offset = 0) {
    return this._peek("Int8", 1, offset)
  }

  peekUInt8(offset = 0) {
    return this._peek("UInt8", 1, offset)
  }

  prependInt64(x) {
    assert(8 <= this.prependableBytes())
    this._readIndex -= 8
    let { low, high } = encodeInt64(x)
    this._buffer.writeUInt32BE(high, this._readIndex)
    this._buffer.writeUInt32BE(low, this._readIndex + 4)
  }

  prependUInt64(x) {
    return this.prependInt64(x)
  }

  prependInt32(x) {
    return this._prepend("Int32BE", 4, x)
  }

  prependUInt32(x) {
    return this._prepend("UInt32BE", 4, x)
  }

  prependInt16(x) {
    return this._prepend("Int16BE", 2, x)
  }

  prependUInt16(x) {
    return this._prepend("UInt16BE", 2, x)
  }

  prependInt8(x) {
    return this._prepend("Int8", 1, x)
  }

  prependUInt8(x) {
    return this._prepend("UInt8", 1, x)
  }

  prependString(str, len = void 0) {
    assert(typeof str === "string")
    if (len === void 0) {
      len = str.length
    }
    assert(len <= this.prependableBytes())
    this._readIndex -= len
    this._buffer.write(str, this._readIndex, len)
  }

  shrink(reserve) {
    assertSize(reserve)
    this._swap(CheapPrepend + this.readableBytes() + reserve)
  }

  internalCapacity() {
    return this._buffer.byteLength
  }

  toString(...args) {
    return this._buffer.slice(this._readIndex, this._writeIndex).toString(...args)
  }

  /// private:
  /// _readIndex
  /// _writeIndex

  _write(type, len, data) {
    this.ensureWritableBytes(len)
    this._buffer["write" + type](data, this._writeIndex)
    this.hasWritten(len)
    return this
  }

  _peek(type, len, offset = 0) {
    assertSize(len)
    assertSize(offset)
    assert(this.readableBytes() >= len + offset)
    return this._buffer["read" + type](this._readIndex + offset)
  }

  _prepend(type, len, data) {
    assertSize(len)
    assert(len <= this.prependableBytes())
    this._readIndex -= len

    if (type === "") {
      this._buffer.write(data, this._readIndex, len)
    } else {
      this._buffer["write" + type](data, this._readIndex)
    }
  }

  _makeSpace(len) {
    assertSize(len)
    let readable = this.readableBytes()

    if ((this.writableBytes() + this.prependableBytes()) < (len + CheapPrepend)) {
      this._swap(this._writeIndex + len)
    } else {
      // move readable data to the front, make space inside buffer
      this._buffer.copy(this._buffer, CheapPrepend, this._readIndex, this._writeIndex)
      this._readIndex = CheapPrepend
      this._writeIndex = CheapPrepend + readable
    }

    assert(readable === this.readableBytes())
  }

  _swap(size) {
    let readable = this.readableBytes()
    assertSize(size)
    assert(size >= readable)
    let other = Buffer.allocUnsafe(size)
    this._buffer.copy(other, CheapPrepend, this._readIndex, this._writeIndex)
    this._readIndex = CheapPrepend
    this._writeIndex = CheapPrepend + readable
    this._buffer = other
  }

}