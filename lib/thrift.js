"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var assert = require("assert");
var BigNumber = require("bignumber.js");

var TYPES = {
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
};

var METHODS = {
  CALL: 1,
  REPLY: 2,
  EXCEPTION: 3,
  ONEWAY: 4
};

var VERSION_1 = 0x80010000 | 0;

var TYPES_R = Object.keys(TYPES).reduce(function (base, key) {
  base[TYPES[key]] = key;
  return base;
}, {});

var METHODS_R = Object.keys(METHODS).reduce(function (base, key) {
  base[METHODS[key]] = key;
  return base;
}, {});

var Thrift = function () {
  function Thrift(buf) {
    var offset = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;

    _classCallCheck(this, Thrift);

    assert(buf instanceof Buffer);
    this.buf = buf;
    this.offset = offset;
  }

  _createClass(Thrift, [{
    key: "parse",
    value: function parse() {
      var originOffset = this.offset;

      var version = this.buf.readInt32BE(this.offset);
      this.offset += 4;

      if ((version & VERSION_1) === VERSION_1) {
        var type = version ^ VERSION_1;

        var nameLength = this.buf.readInt32BE(this.offset);
        this.offset += 4;
        var name = this.buf.toString('utf8', this.offset, this.offset + nameLength);
        this.offset += nameLength;

        var id = this.buf.readInt32BE(this.offset);
        this.offset += 4;

        var fields = this.parserValue(TYPES.STRUCT).fields;
        type = METHODS_R[type];
        return { type: type, name: name, id: id, fields: fields };
      } else {
        this.offset = originOffset;
        var header = this.parseStruct();
        var result = this.parse();
        result.header = header;
        return result;
      }
    }
  }, {
    key: "parserValue",
    value: function parserValue(type) {
      switch (type) {
        case TYPES.STOP:
          {
            return;
          }
        case TYPES.VOID:
          {
            return null;
          }
        case TYPES.BOOL:
          {
            var result = this.buf.readInt8(this.offset);
            this.offset += 1;
            return !!result;
          }
        case TYPES.BYTE:
          {
            var _result = this.buf.readInt8(this.offset);
            this.offset += 1;
            return _result;
          }
        case TYPES.I16:
          {
            var _result2 = this.buf.readInt16BE(this.offset);
            this.offset += 2;
            return _result2;
          }
        case TYPES.I32:
          {
            var _result3 = this.buf.readInt32BE(this.offset);
            this.offset += 4;
            return _result3;
          }
        case TYPES.I64:
          {
            return this.parseI64();
          }
        case TYPES.DOUBLE:
          {
            var _result4 = this.buf.readDoubleBE(this.offset);
            this.offset += 8;
            return _result4;
          }
        case TYPES.STRING:
          {
            var size = this.buf.readInt32BE(this.offset);
            this.offset += 4;
            var _result5 = this.buf.toString('utf8', this.offset, this.offset + size);
            this.offset += size;
            return _result5;
          }
        case TYPES.UTF16:
          {
            var _size = this.buf.readInt32BE(this.offset);
            this.offset += 4;
            var _result6 = this.buf.toString('utf16le', this.offset, this.offset + _size);
            this.offset += _size;
            return _result6;
          }
        case TYPES.STRUCT:
          {
            return this.parseStruct();
          }
        case TYPES.LIST:
          {
            return this.parseList();
          }
        case TYPES.MAP:
          {
            return this.parseMap();
          }
        default:
          throw new Error("Unknown type code " + type);
      }
    }
  }, {
    key: "parseI64",
    value: function parseI64() {
      var h = this.buf.readUInt32BE(this.offset);
      var l = this.buf.readUInt32BE(this.offset + 4);
      this.offset += 8;

      var nega = h & 0x80000000;
      if (nega) {
        l = ~l + 1 >>> 0;
        h = ~h + !l >>> 0;
      }
      var value = (nega ? '-' : '') + h.toString(16) + ('00000000' + l.toString(16)).slice(-8);
      return new BigNumber(value, 16);
    }
  }, {
    key: "parseStruct",
    value: function parseStruct() {
      var fields = [];
      for (;;) {
        var type = this.buf.readInt8(this.offset);
        this.offset += 1;
        if (!type) {
          break;
        }

        var id = this.buf.readInt16BE(this.offset);
        this.offset += 2;

        var value = this.parserValue(type);
        type = TYPES_R[type];
        fields.push({ id: id, type: type, value: value });
      }
      return { fields: fields };
    }
  }, {
    key: "parseList",
    value: function parseList() {
      var valueType = this.buf.readInt8(this.offset);
      this.offset += 1;

      var count = this.buf.readInt32BE(this.offset);
      this.offset += 4;

      var data = [];
      for (var i = 0; i < count; i++) {
        var value = this.parserValue(valueType);
        data.push(value);
      }
      valueType = TYPES_R[valueType];
      return { valueType: valueType, data: data };
    }
  }, {
    key: "parseMap",
    value: function parseMap() {
      var keyType = this.buf.readInt8(this.offset);
      this.offset += 1;

      var valueType = this.buf.readInt8(this.offset);
      this.offset += 1;

      var count = this.buf.readInt32BE(this.offset);
      this.offset += 4;

      var data = [];
      for (var i = 0; i < count; i++) {
        var key = this.parserValue(keyType);
        var value = this.parserValue(valueType);
        data.push({ key: key, value: value });
      }

      keyType = TYPES_R[keyType];
      valueType = TYPES_R[valueType];
      return { keyType: keyType, valueType: valueType, data: data };
    }
  }]);

  return Thrift;
}();

var decode = function decode(buf) {
  var offset = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;

  var thrift = new Thrift(buf, offset);
  return thrift.parse();
};

// const hex = "80010001000000156765744d657267656446726f6d536f757263654964000000000a00010000000000f49f800a000200000000980337f10800030000000100"
// const buf = new Buffer(hex, "hex")
// console.log(JSON.stringify(decode(buf)))

module.exports.thrift = { decode: decode };