const BigNumber = require('bignumber.js')
const net = require('net')
const MuduoBuffer = require("./muduoBuffer")

// const thriftEncode = require('./encode')

const multipliers = [0x1000000, 0x10000, 0x100, 1]
const ip2long = ip => ip.split('.').reduce((sum, a, i) => sum + a * multipliers[i], 0)
const long2ip = long => multipliers.map((multiplier) => Math.floor((long % (multiplier * 0x100)) / multiplier)).join('.')

function jsJSON(any) {
  if (typeof any === 'string' || any instanceof String) {
    try {
      JSON.parse(any)
      return true
    } catch (error) { }
  }
  return false
}


const MAX_NOVA_HDR_SIZE = 0x7fff
const NOVA_MAGIC = 0xdabc
const NOVA_HDR_COMMON_LEN = 37
const NOVA_VERSION = 1

const novaSeq = ((i) => () => ++i === Number.MAX_SAFE_INTEGER ? i = 1 : i)(0)

/**
 * 
 * @param {MuduoBuffer} buf 
 */
function isNovaPacket(buf) {
  assert(buf instanceof MuduoBuffer)
  if (buf.readableBytes() < NOVA_HDR_COMMON_LEN) {
    return void 0
  }

  // offset msgSize & magic
  // let headerSize = buf.peekInt16(6)
  // if (buf.readableBytes() < headerSize) {
  //   return void 0
  // }

  // offset msg size
  let novaMagic = buf.peekUInt16(4)
  return novaMagic === NOVA_MAGIC
}

class NovaCodecError extends Error {
  constructor(message) {
    super(message)
  }
}

/**
  * typedef struct swNova_Header {
  *    int32_t     msg_size;
  *    uint16_t    magic;
  *    int16_t     head_size;
  *    int8_t      version;
  *    uint32_t    ip;
  *    uint32_t    port;
  *    int32_t     service_len;
  *    char        *service_name;
  *    int32_t     method_len;
  *    char        *method_name;
  *    int64_t     seq_no;
  *    int32_t     attach_len;
  *    char        *attach;
  * } swNova_Header;
  */

function novaEncode({ ip, port, service, method, attach = {}, seq = null, thriftBuffer }) {
  if (!thriftBuffer instanceof Buffer) {
    throw new NovaCodecError(`invalid thrift buffer`)
  }

  if (!net.isIP(ip)) {
    throw new NovaCodecError("invalid ip:" + JSON.stringify(ip))
  }
  ip = ip2long(ip)

  if (!jsJSON(attach)) {
    try {
      attach = JSON.stringify(attach)
    } catch (error) {
      console.error("json encode nova attach fail", error, attach)
      attach = '{}'
    }
  }

  let headerSize = NOVA_HDR_COMMON_LEN + service.length + method.length + attach.length
  if (headerSize > MAX_NOVA_HDR_SIZE) {
    throw new NovaCodecError(`too large nova packet hdr: ${headerSize}`)
  }

  let bodySize = thriftBuffer.length
  let msgSize = headerSize + bodySize

  const hdrBuf = Buffer.allocUnsafe(headerSize)

  let offset = 0

  // write message size
  hdrBuf.writeInt32BE(msgSize, offset)
  offset += 4

  // write magic
  hdrBuf.writeUInt16BE(NOVA_MAGIC, offset)
  offset += 2

  // write header size
  hdrBuf.writeInt16BE(headerSize, offset)
  offset += 2

  // write version
  hdrBuf.writeInt8(NOVA_VERSION, offset)
  offset += 1

  // write ip
  hdrBuf.writeUInt32BE(ip, offset)
  offset += 4

  // write port
  hdrBuf.writeUInt32BE(port, offset)
  offset += 4

  // write service
  hdrBuf.writeInt32BE(service.length, offset)
  offset += 4
  hdrBuf.write(service, offset)
  offset += service.length

  // write method
  hdrBuf.writeInt32BE(method.length, offset)
  offset += 4
  hdrBuf.write(method, offset)
  offset += method.length

  // write seq
  if (-seq !== +seq || seq === null) {
    seq = novaSeq()
  }
  seq = new BigNumber(seq).toString(16)
  let l = parseInt(seq.slice(-8), 16) || 0
  let h = parseInt(seq.slice(-16, -8), 16) || 0
  hdrBuf.writeUInt32BE(h, offset)
  offset += 4
  hdrBuf.writeUInt32BE(l, offset)
  offset += 4

  // wtire attach
  hdrBuf.writeInt32BE(attach.length, offset)
  offset += 4
  hdrBuf.write(attach, offset)
  offset += attach.length

  return Buffer.concat([hdrBuf, thriftBuffer])
}


/**
 * @param {Buffer} buf 
 * @param {Number} offset
 * @return {Object} { msgSize, headerSize, ip, port, service, method, seq, attach, offset }
 */
function novaDecodeHeader(buf, offset = 0) {
  if (buf.length - offset <= NOVA_HDR_COMMON_LEN) {
    throw new NovaCodecError(`length is less than nova header common length. length=${buf.length}`)
  }

  // read message size
  let msgSize = buf.readInt32BE(offset)
  if (msgSize <= NOVA_HDR_COMMON_LEN) {
    throw new NovaCodecError(`msg size is less than nova header common length. msg_size=${msgSize}`)
  }
  offset += 4

  // read nova magic
  let novaMagic = buf.readUInt16BE(offset)
  if (novaMagic !== NOVA_MAGIC) {
    throw new NovaCodecError("invalid nova packet: bad magic")
  }
  offset += 2

  // read header size
  let headerSize = buf.readInt16BE(offset)
  if (headerSize > msgSize) {
    throw new NovaCodecError(`nova header size is larger than nova message size`)
  }
  offset += 2

  // read version
  let version = buf.readInt8(offset)
  offset += 1
  if (version !== NOVA_VERSION) {
    throw new NovaCodecError(`unsupport nova packet version`)
  }

  // read ip
  let ip = buf.readUInt32BE(offset)
  offset += 4
  ip = long2ip(ip)

  // read port
  let port = buf.readUInt32BE(offset)
  offset += 4

  // read service
  let serviceLen = buf.readInt32BE(offset)
  offset += 4
  let service = buf.toString('utf8', offset, offset + serviceLen)
  offset += serviceLen
  if (offset > headerSize) {
    throw new NovaCodecError("invalid nova packet")
  }

  // read method
  let methodLen = buf.readInt32BE(offset)
  offset += 4
  let method = buf.toString('utf8', offset, offset + methodLen)
  offset += methodLen
  if (offset > headerSize) {
    throw new NovaCodecError("invalid nova packet")
  }

  // read seq
  let h = buf.readUInt32BE(offset)
  offset += 4
  let l = buf.readUInt32BE(offset)
  offset += 4
  let nega = h & 0x80000000
  if (nega) {
    throw new NovaCodecError("invalid nova packet")
  }
  let seq = h.toString(16) + ('00000000' + l.toString(16)).slice(-8)
  seq = new BigNumber(seq, 16).toString()

  // read attach
  let attachLen = buf.readInt32BE(offset)
  offset += 4
  let attach = buf.toString('utf8', offset, offset + attachLen)
  offset += attachLen
  if (offset > headerSize) {
    throw new NovaCodecError("invalid nova packet")
  }
  try {
    attach = JSON.parse(attach)
  } catch (error) {
    console.error("json decode nova attach error", error)
    attach = {}
  }

  return { msgSize, headerSize, ip, port, service, method, seq, attach, thriftOffset: offset }
}

function novaDecode(buf, offset = 0) {
  let { msgSize, headerSize, ip, port, service, method, seq, attach, thriftOffset } = novaDecodeHeader(buf, offset)
  let bodySize = msgSize - headerSize
  let thriftBuffer = buf.slice(thriftOffset, thriftOffset + bodySize)
  return { ip, port, service, method, seq, attach, thriftBuffer }
}

module.exports = {
  detect: isNovaPacket,
  encode: novaEncode,
  decode: novaDecode
}