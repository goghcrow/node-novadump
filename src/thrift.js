const assert = require("assert")
const BigNumber = require("bignumber.js")

const TYPES = {
  STOP: 0,
  VOID: 1,
  BOOL: 2,
  BYTE: 3,
  I08: 3,
  DOUBLE: 4,
  I16: 6,
  I32: 8,
  I64: 10,
  UTF7: 11,
  BINARY: 11,
  STRING: 11,
  STRUCT: 12,
  MAP: 13,
  SET: 14,
  LIST: 15,
  UTF8: 16,
  UTF16: 17
}

const METHODS = {
  CALL: 1,
  REPLY: 2,
  EXCEPTION: 3,
  ONEWAY: 4
}

const VERSION_1 = 0x80010000 | 0

const TYPES_R = Object.keys(TYPES).reduce((base, key) => {
  base[TYPES[key]] = key
  return base
}, {})

const METHODS_R = Object.keys(METHODS).reduce((base, key) => {
  base[METHODS[key]] = key
  return base
}, {})


class Thrift {
  constructor(buf, offset = 0) {
    this.buf = buf
    this.offset = offset
  }

  parse() {
    let originOffset = this.offset
    
    let version = this.buf.readInt32BE(this.offset)
    this.offset += 4

    if ((version & VERSION_1) === VERSION_1) {
      let type = version ^ VERSION_1

      let nameLength = this.buf.readInt32BE(this.offset)
      this.offset += 4
      let name = this.buf.toString('utf8', this.offset, this.offset + nameLength)
      this.offset += nameLength

      let id = this.buf.readInt32BE(this.offset)
      this.offset += 4

      let fields = this.parserValue(TYPES.STRUCT).fields
      type = METHODS_R[type]
      return { type, name, id, fields }
    } else {
      this.offset = originOffset
      let header = this.parseStruct()
      let result = this.parse()
      result.header = header
      return result
    }
  }

  parserValue(type) {
    switch (type) {
      case TYPES.STOP: {
        return
      }
      case TYPES.VOID: {
        return null
      }
      case TYPES.BOOL: {
        let result = this.buf.readInt8(this.offset)
        this.offset += 1
        return !!result
      }
      case TYPES.BYTE: {
        let result = this.buf.readInt8(this.offset)
        this.offset += 1
        return result
      }
      case TYPES.I16: {
        let result = this.buf.readInt16BE(this.offset)
        this.offset += 2
        return result
      }
      case TYPES.I32: {
        let result = this.buf.readInt32BE(this.offset)
        this.offset += 4
        return result
      }
      case TYPES.I64: {
        return this.parseI64()
      }
      case TYPES.DOUBLE: {
        let result = this.buf.readDoubleBE(this.offset)
        this.offset += 8
        return result
      }
      case TYPES.STRING: {
        let size = this.buf.readInt32BE(this.offset)
        this.offset += 4
        let result = this.buf.toString('utf8', this.offset, this.offset + size)
        this.offset += size
        return result
      }
      case TYPES.UTF16: {
        let size = this.buf.readInt32BE(this.offset)
        this.offset += 4
        let result = this.buf.toString('utf16le', this.offset, this.offset + size)
        this.offset += size
        return result
      }
      case TYPES.STRUCT: {
        return this.parseStruct()
      }
      case TYPES.LIST: {
        return this.parseList()
      }
      case TYPES.MAP: {
        return this.parseMap()
      }
      default: throw new Error(`Unknown type code ${type}`)
    }
  }

  parseI64() {
    let h = this.buf.readUInt32BE(this.offset)
    let l = this.buf.readUInt32BE(this.offset + 4)
    this.offset += 8

    let nega = h & 0x80000000;
    if (nega) {
      l = ~l + 1 >>> 0;
      h = ~h + !l >>> 0;
    }
    let value = (nega ? '-' : '') + h.toString(16) + ('00000000' + l.toString(16)).slice(-8)
    return new BigNumber(value, 16)
  }

  parseStruct() {
    let fields = []
    for (; ;) {
      let type = this.buf.readInt8(this.offset)
      this.offset += 1
      if (!type) {
        break
      }

      let id = this.buf.readInt16BE(this.offset)
      this.offset += 2

      let value = this.parserValue(type)
      type = TYPES_R[type]
      fields.push({ id, type, value })
    }
    return { fields }
  }

  parseList() {
    let valueType = this.buf.readInt8(this.offset)
    this.offset += 1

    let count = this.buf.readInt32BE(this.offset)
    this.offset += 4

    let data = [];
    for (let i = 0; i < count; i++) {
      let value = this.parserValue(valueType)
      data.push(value)
    }
    valueType = TYPES_R[valueType]
    return { valueType, data }
  }

  parseMap() {
    let keyType = this.buf.readInt8(this.offset)
    this.offset += 1

    let valueType = this.buf.readInt8(this.offset)
    this.offset += 1

    let count = this.buf.readInt32BE(this.offset)
    this.offset += 4

    let data = []
    for (let i = 0; i < count; i++) {
      let key = this.parserValue(keyType)
      let value = this.parserValue(valueType)
      data.push({ key, value })
    }

    keyType = TYPES_R[keyType]
    valueType = TYPES_R[valueType]
    return { keyType, valueType, data }
  }
}

const decode = (buf, offset = 0) => {
  assert(buf instanceof Buffer)
  let len = buf.byteLength || buf.length
  if (len - offset <= 0) {
    return null
  }

  try {
    let thrift = new Thrift(buf, offset)
    return thrift.parse()
  } catch (error) {
    console.error("thrift decode error", error, buf.toString("hex"), offset)
    return null
  }
}

// const hex = "80010001000000156765744d657267656446726f6d536f757263654964000000000a00010000000000f49f800a000200000000980337f10800030000000100"
// const buf = new Buffer(hex, "hex")
// console.log(JSON.stringify(decode(buf)))

module.exports = { decode }