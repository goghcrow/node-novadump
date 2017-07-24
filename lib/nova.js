'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var assert = require("assert");
var net = require('net');
var BigNumber = require('bignumber.js');
var MuduoBuffer = require("./muduoBuffer");

// const thriftEncode = require('./encode')

var multipliers = [0x1000000, 0x10000, 0x100, 1];
var ip2long = function ip2long(ip) {
  return ip.split('.').reduce(function (sum, a, i) {
    return sum + a * multipliers[i];
  }, 0);
};
var long2ip = function long2ip(long) {
  return multipliers.map(function (multiplier) {
    return Math.floor(long % (multiplier * 0x100) / multiplier);
  }).join('.');
};

function jsJSON(any) {
  if (typeof any === 'string' || any instanceof String) {
    try {
      JSON.parse(any);
      return true;
    } catch (error) {}
  }
  return false;
}

var MAX_NOVA_HDR_SIZE = 0x7fff;
var NOVA_MAGIC = 0xdabc;
var NOVA_HDR_COMMON_LEN = 37;
var NOVA_VERSION = 1;

var novaSeq = function (i) {
  return function () {
    return ++i === Number.MAX_SAFE_INTEGER ? i = 1 : i;
  };
}(0);

/**
 * 
 * @param {MuduoBuffer} buf 
 */
function isNovaPacket(buf) {
  assert(buf instanceof MuduoBuffer);
  if (buf.readableBytes() < NOVA_HDR_COMMON_LEN) {
    return void 0;
  }

  // offset msgSize & magic
  // let headerSize = buf.peekInt16(6)
  // if (buf.readableBytes() < headerSize) {
  //   return void 0
  // }

  // offset msg size
  var novaMagic = buf.peekUInt16(4);
  return novaMagic === NOVA_MAGIC;
}

var NovaCodecError = function (_Error) {
  _inherits(NovaCodecError, _Error);

  function NovaCodecError(message) {
    _classCallCheck(this, NovaCodecError);

    return _possibleConstructorReturn(this, (NovaCodecError.__proto__ || Object.getPrototypeOf(NovaCodecError)).call(this, message));
  }

  return NovaCodecError;
}(Error);

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

function novaEncode(_ref) {
  var ip = _ref.ip,
      port = _ref.port,
      service = _ref.service,
      method = _ref.method,
      _ref$attach = _ref.attach,
      attach = _ref$attach === undefined ? {} : _ref$attach,
      _ref$seq = _ref.seq,
      seq = _ref$seq === undefined ? null : _ref$seq,
      thriftBuffer = _ref.thriftBuffer;

  if (!thriftBuffer instanceof Buffer) {
    throw new NovaCodecError('invalid thrift buffer');
  }

  if (!net.isIP(ip)) {
    throw new NovaCodecError("invalid ip:" + JSON.stringify(ip));
  }
  ip = ip2long(ip);

  if (!jsJSON(attach)) {
    try {
      attach = JSON.stringify(attach);
    } catch (error) {
      console.error("json encode nova attach fail", error, attach);
      attach = '{}';
    }
  }

  var headerSize = NOVA_HDR_COMMON_LEN + service.length + method.length + attach.length;
  if (headerSize > MAX_NOVA_HDR_SIZE) {
    throw new NovaCodecError('too large nova packet hdr: ' + headerSize);
  }

  var bodySize = thriftBuffer.length;
  var msgSize = headerSize + bodySize;

  var hdrBuf = Buffer.allocUnsafe(headerSize);

  var offset = 0;

  // write message size
  hdrBuf.writeInt32BE(msgSize, offset);
  offset += 4;

  // write magic
  hdrBuf.writeUInt16BE(NOVA_MAGIC, offset);
  offset += 2;

  // write header size
  hdrBuf.writeInt16BE(headerSize, offset);
  offset += 2;

  // write version
  hdrBuf.writeInt8(NOVA_VERSION, offset);
  offset += 1;

  // write ip
  hdrBuf.writeUInt32BE(ip, offset);
  offset += 4;

  // write port
  hdrBuf.writeUInt32BE(port, offset);
  offset += 4;

  // write service
  hdrBuf.writeInt32BE(service.length, offset);
  offset += 4;
  hdrBuf.write(service, offset);
  offset += service.length;

  // write method
  hdrBuf.writeInt32BE(method.length, offset);
  offset += 4;
  hdrBuf.write(method, offset);
  offset += method.length;

  // write seq
  if (-seq !== +seq || seq === null) {
    seq = novaSeq();
  }
  seq = new BigNumber(seq).toString(16);
  var l = parseInt(seq.slice(-8), 16) || 0;
  var h = parseInt(seq.slice(-16, -8), 16) || 0;
  hdrBuf.writeUInt32BE(h, offset);
  offset += 4;
  hdrBuf.writeUInt32BE(l, offset);
  offset += 4;

  // wtire attach
  hdrBuf.writeInt32BE(attach.length, offset);
  offset += 4;
  hdrBuf.write(attach, offset);
  offset += attach.length;

  return Buffer.concat([hdrBuf, thriftBuffer]);
}

/**
 * @param {Buffer} buf 
 * @param {Number} offset
 * @return {Object} { msgSize, headerSize, ip, port, service, method, seq, attach, offset }
 */
function novaDecodeHeader(buf) {
  var offset = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;

  if (buf.length - offset <= NOVA_HDR_COMMON_LEN) {
    throw new NovaCodecError('length is less than nova header common length. length=' + buf.length);
  }

  // read message size
  var msgSize = buf.readInt32BE(offset);
  if (msgSize <= NOVA_HDR_COMMON_LEN) {
    throw new NovaCodecError('msg size is less than nova header common length. msg_size=' + msgSize);
  }
  offset += 4;

  // read nova magic
  var novaMagic = buf.readUInt16BE(offset);
  if (novaMagic !== NOVA_MAGIC) {
    throw new NovaCodecError("invalid nova packet: bad magic");
  }
  offset += 2;

  // read header size
  var headerSize = buf.readInt16BE(offset);
  if (headerSize > msgSize) {
    throw new NovaCodecError('nova header size is larger than nova message size');
  }
  offset += 2;

  // read version
  var version = buf.readInt8(offset);
  offset += 1;
  if (version !== NOVA_VERSION) {}
  // version 暂时没用, 不同实现不一致, 忽略
  // console.error("invalid nova version", version)
  // throw new NovaCodecError(`unsupport nova packet version`)


  // read ip
  var ip = buf.readUInt32BE(offset);
  offset += 4;
  ip = long2ip(ip);

  // read port
  var port = buf.readUInt32BE(offset);
  offset += 4;

  // read service
  var serviceLen = buf.readInt32BE(offset);
  offset += 4;
  var service = buf.toString('utf8', offset, offset + serviceLen);
  offset += serviceLen;
  if (offset > headerSize) {
    throw new NovaCodecError("invalid nova packet");
  }

  // read method
  var methodLen = buf.readInt32BE(offset);
  offset += 4;
  var method = buf.toString('utf8', offset, offset + methodLen);
  offset += methodLen;
  if (offset > headerSize) {
    throw new NovaCodecError("invalid nova packet");
  }

  // read seq
  var h = buf.readUInt32BE(offset);
  offset += 4;
  var l = buf.readUInt32BE(offset);
  offset += 4;
  var nega = h & 0x80000000;
  if (nega) {
    throw new NovaCodecError("invalid nova packet");
  }
  var seq = h.toString(16) + ('00000000' + l.toString(16)).slice(-8);
  seq = new BigNumber(seq, 16).toString();

  // read attach
  var attachLen = buf.readInt32BE(offset);
  offset += 4;
  var attach = buf.toString('utf8', offset, offset + attachLen);
  offset += attachLen;
  if (offset > headerSize) {
    throw new NovaCodecError("invalid nova packet");
  }
  try {
    attach = JSON.parse(attach);
  } catch (error) {
    if (attach) {
      console.error("json decode nova attach error", attach, error);
    }
    attach = {};
  }

  return { msgSize: msgSize, headerSize: headerSize, ip: ip, port: port, service: service, method: method, seq: seq, attach: attach, thriftOffset: offset };
}

function novaDecode(buf) {
  var offset = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;

  var _novaDecodeHeader = novaDecodeHeader(buf, offset),
      msgSize = _novaDecodeHeader.msgSize,
      headerSize = _novaDecodeHeader.headerSize,
      ip = _novaDecodeHeader.ip,
      port = _novaDecodeHeader.port,
      service = _novaDecodeHeader.service,
      method = _novaDecodeHeader.method,
      seq = _novaDecodeHeader.seq,
      attach = _novaDecodeHeader.attach,
      thriftOffset = _novaDecodeHeader.thriftOffset;

  var bodySize = msgSize - headerSize;
  var thriftBuffer = buf.slice(thriftOffset, thriftOffset + bodySize);
  return { ip: ip, port: port, service: service, method: method, seq: seq, attach: attach, thriftBuffer: thriftBuffer };
}

module.exports = {
  detect: isNovaPacket,
  encode: novaEncode,
  decode: novaDecode
};