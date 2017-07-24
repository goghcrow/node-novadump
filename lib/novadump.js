#!/usr/bin/env node
"use strict";

var nova = require("./nova");
var pcap = require("pcap");
var pcapSession = pcap.createSession("", "tcp");
var tcpTracker = new pcap.TCPTracker();
var BigNumber = require("bignumber.js");
var MuduoBuffer = require("./muduoBuffer");

pcapSession.on("packet", function (raw_packet) {
  var packet = pcap.decode.packet(raw_packet);
  tcpTracker.track_packet(packet);
});

tcpTracker.on("session", function (session) {
  // console.log("Start of TCP session between " + session.src_name + " and " + session.dst_name)

  var isNovaSession = void 0;
  var sendBuf = new MuduoBuffer();
  var recvBuf = new MuduoBuffer();

  session.on("data send", function () {
    var detected = void 0;
    return function (session, data) {
      if (detected === false) {
        return;
      }
      sendBuf.append(data);

      // console.log(session.src_name + " -> " + session.dst_name + " data send " + session.send_bytes_payload + " + " + data.length + " bytes")
      if (detected === void 0) {
        detected = nova.detect(sendBuf);
      }

      if (detected === void 0) {
        return;
      } else if (detected === false) {
        sendBuf = void 0;
        return;
      } else if (detected === true) {
        isNovaSession = true;
        var msgSize = sendBuf.peekInt32();
        if (sendBuf.readableBytes() >= msgSize) {
          var novaBuf = sendBuf.read(msgSize);

          var _nova$decode = nova.decode(novaBuf),
              ip = _nova$decode.ip,
              port = _nova$decode.port,
              service = _nova$decode.service,
              method = _nova$decode.method,
              seq = _nova$decode.seq,
              attach = _nova$decode.attach,
              thriftBuffer = _nova$decode.thriftBuffer;

          console.log("send " + service + ":" + method);
        }
      }
    };
  }());

  session.on("data recv", function () {
    var detected = void 0;
    return function (session, data) {
      if (detected === false) {
        return;
      }
      recvBuf.append(data);

      // console.log(session.dst_name + " -> " + session.src_name + " data recv " + session.recv_bytes_payload + " + " + data.length + " bytes")    
      if (detected === void 0) {
        detected = nova.detect(recvBuf);
      }

      if (detected === void 0) {
        return;
      } else if (detected === false) {
        recvBuf = void 0;
        return;
      } else if (detected === true) {
        isNovaSession = true;
        var msgSize = recvBuf.peekInt32();
        if (recvBuf.readableBytes() >= msgSize) {
          var novaBuf = recvBuf.read(msgSize);

          var _nova$decode2 = nova.decode(novaBuf),
              ip = _nova$decode2.ip,
              port = _nova$decode2.port,
              service = _nova$decode2.service,
              method = _nova$decode2.method,
              seq = _nova$decode2.seq,
              attach = _nova$decode2.attach,
              thriftBuffer = _nova$decode2.thriftBuffer;

          console.log("recv " + service + ":" + method);
        }
      }
    };
  }());

  session.on("end", function (session) {
    if (isNovaSession === true) {
      console.log("End of TCP session between " + session.src_name + " and " + session.dst_name);
      // console.log("Set stats for session: ", session.session_stats())
      sendBuf = void 0;
      recvBuf = void 0;
    }
  });
});

/*
"syn retry";
"reset";
"start";
"retransmit";
"data send";
"data recv";
"end";
*/