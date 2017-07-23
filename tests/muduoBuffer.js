const assert = require("assert")
const BigNumber = require("bignumber.js")
const MuduoBuffer = require("../src/muduoBuffer")

const dd = console.log
const exit = process.exit
const CheapPrepend = 8;


(function () {
  let buf = new MuduoBuffer(5)
  buf.append("12345")
  assert(buf.writableBytes() === 0)
  assert(buf.internalCapacity() === 13)
  buf.retrieve(2)

  assert(buf._readIndex === 10)
  assert(buf._writeIndex === 13)
  assert(buf.internalCapacity() === 13)

  buf.shrink(0)

  assert(buf._readIndex === 8)
  assert(buf._writeIndex === 11)
  assert(buf.internalCapacity() === 11)
}());

(function () {

  const cap = 10
  let buf = new MuduoBuffer(cap)

  assert(buf.readableBytes() === 0)
  assert(buf.writableBytes() === cap)
  assert(buf.prependableBytes() === CheapPrepend)
  assert(buf.internalCapacity() === CheapPrepend + cap)

  buf.prependString("HELLO")

  assert(buf.readableBytes() === 5)
  assert(buf.writableBytes() === cap)
  assert(buf.prependableBytes() === 3)
  assert(buf.internalCapacity() === CheapPrepend + cap)

  buf.retrieve(1)

  assert(buf.readableBytes() === 4)
  assert(buf.writableBytes() === cap)
  assert(buf.prependableBytes() === 4)
  assert(buf.internalCapacity() === CheapPrepend + cap)

  assert(buf.toString() === "ELLO")
  buf.append("WORLD")
  assert(buf.toString() === "ELLOWORLD")

  assert(buf.readableBytes() === 4 + 5)
  assert(buf.writableBytes() === cap - 5)
  assert(buf.prependableBytes() === 4)
  assert(buf.internalCapacity() === CheapPrepend + cap)

  buf.append(Buffer.from("123"))
  assert(buf.toString() === "ELLOWORLD123")

  assert(buf.readableBytes() === 4 + 5 + 3)
  assert(buf.writableBytes() === cap - 5 - 3)
  assert(buf.prependableBytes() === 4)
  assert(buf.internalCapacity() === CheapPrepend + cap)


  // dd(buf._readIndex, buf._writeIndex, buf._buffer.byteLength)
  buf.retrieve(6)
  // dd(buf._readIndex, buf._writeIndex, buf._buffer.byteLength)
  buf.append("0000")
  assert(buf.readableBytes() === cap)
  assert(buf.writableBytes() === 0)
  assert(buf.prependableBytes() === 8)
  assert(buf.internalCapacity() === CheapPrepend + cap)


  buf.append("X")
  assert(buf.toString() === "RLD1230000X")
  assert(buf.internalCapacity() === 19)


  buf.ensureWritableBytes(5)
  assert(buf.internalCapacity() === 24)

  buf.hasWritten(1)
  buf.unwrite(2)
  assert(buf.toString() === "RLD1230000")

  buf.shrink(0)
  assert(buf.internalCapacity() === 18)

}());


(function () {
  const buf = new MuduoBuffer(0)

  buf.appendInt8(127)
  assert(buf._writeIndex === 9)
  assert(buf.peekInt8() === 127)
  assert(buf._writeIndex === 9)
  assert(buf.readInt8() === 127)
  assert(buf._writeIndex === 8)

  buf.appendUInt8(255)
  assert(buf.peekUInt8() === buf.readUInt8())
  assert(buf.readableBytes() === 0)

  buf.prependUInt8(255)
  assert(buf._readIndex === 7)
  assert(buf.peekUInt8() === buf.readUInt8())
  assert(buf.readableBytes() === 0)

  buf.prependUInt8(255)
  assert(buf.peekUInt8() === buf.readUInt8())
  assert(buf.readableBytes() === 0)

  buf.appendInt16(0xFFFF >> 1)
  assert(buf.peekInt16() === buf.readInt16())
  assert(buf.readableBytes() === 0)

  buf.appendUInt16(0xFFFF)
  assert(buf.peekUInt16() === buf.readUInt16())
  assert(buf.readableBytes() === 0)

  buf.prependInt16(0xFFFF >> 1)
  assert(buf._readIndex === 6)
  assert(buf.peekInt16() === buf.readInt16())
  assert(buf.readableBytes() === 0)

  buf.prependUInt16(0xFFFF)
  assert(buf.peekUInt16() === buf.readUInt16())
  assert(buf.readableBytes() === 0)

  buf.appendInt32(0xFFFFFFFF >> 1)
  assert(buf.peekInt32() === buf.readInt32())
  assert(buf.readableBytes() === 0)

  buf.appendUInt32(0xFFFFFFFF)
  assert(buf.peekUInt32() === buf.readUInt32())
  assert(buf.readableBytes() === 0)

  buf.prependInt32(0xFFFFFFFF >> 1)
  assert(buf._readIndex === 4)
  assert(buf.peekInt32() === buf.readInt32())
  assert(buf.readableBytes() === 0)

  buf.prependUInt32(0xFFFFFFFF)
  assert(buf.peekUInt32() === buf.readUInt32())
  assert(buf.readableBytes() === 0)

  let int64 = "-" + Number.MAX_SAFE_INTEGER.toString() + "0"
  // dd(int64)
  buf.appendInt64(int64)
  // dd(buf.peekInt64().toString())
  assert(buf.peekInt64().toString() === buf.readInt64().toString())
  assert(buf.readableBytes() === 0)

  let uint64 = Number.MAX_SAFE_INTEGER.toString() + "0"
  // dd(uint64)
  buf.appendUInt64(uint64)
  // dd(buf.peekUInt64().toString())
  assert(buf.peekUInt64().toString() === buf.readUInt64().toString())
  assert(buf.readableBytes() === 0)

  buf.prependInt64(int64)
  assert(buf._readIndex === 0)
  assert(buf.peekInt64().toString() === buf.readInt64().toString())
  assert(buf.readableBytes() === 0)

  buf.prependUInt64(uint64)
  assert(buf._readIndex === 0)
  assert(buf.peekUInt64().toString() === buf.readUInt64().toString())
  assert(buf.readableBytes() === 0)
}());

(function () {
  let buf = new MuduoBuffer(5)
  buf.appendInt32(123)
  buf.appendUInt64(42)
  assert(buf.peekUInt64(4).toNumber() === 42)
}());


(function () {
  let buf = new MuduoBuffer(5)
  buf.append(new Buffer("HELLO"))
  assert(buf.retrieveAsString(5) === "HELLO")

  buf.append(new Buffer("HELLO"))
  assert(buf.byteLength === 5)
  assert(buf.peekAsString(5) === "HELLO")
  assert(buf.peekAsString(4, 1) === "ELLO")

  assert(buf.peek(4, 1).toString() === "ELLO")
  assert(buf.read(5).toString() === "HELLO")
  assert(buf.byteLength === 0)
}());