#!/usr/bin/env node

const nova = require("./nova")
const pcap = require("pcap")
const pcapSession = pcap.createSession("", "tcp")
const tcpTracker = new pcap.TCPTracker()
const BigNumber = require("bignumber.js")
const MuduoBuffer = require("./muduoBuffer")


pcapSession.on("packet", function (raw_packet) {
  const packet = pcap.decode.packet(raw_packet)
  tcpTracker.track_packet(packet)
})


tcpTracker.on("session", function (session) {
  // console.log("Start of TCP session between " + session.src_name + " and " + session.dst_name)

  // let sessionId = session.src_name + ':' + session.dst_name
  let isNovaSession = void 0
  let sendBuf = new MuduoBuffer()
  let recvBuf = new MuduoBuffer()

  session.on("data send", function (session, data) {
    // console.log(session.src_name + " -> " + session.dst_name + " data send " + session.send_bytes_payload + " + " + data.length + " bytes")

    if (isNovaSession === void 0) {
      sendBuf.append(data)
      isNovaSession = nova.detect(sendBuf)
    }

    if (isNovaSession === void 0) {
      return
    } else if (isNovaSession === false) {
      sendBuf = void 0
      return
    } else if (isNovaSession === true) {
      sendBuf.append(data)
      let msgSize = sendBuf.peekInt32()

      if (sendBuf.readableBytes() >= msgSize) {
        let novaBuf = sendBuf.read(msgSize)
        let { ip, port, service, method, seq, attach, thriftBuffer } = nova.decode(novaBuf)
        console.log(`send ${service}:${method}`)
      }
    }
  })

  session.on("data recv", function (session, data) {
    // console.log(session.dst_name + " -> " + session.src_name + " data recv " + session.recv_bytes_payload + " + " + data.length + " bytes")    
    if (isNovaSession === void 0) {
      recvBuf.append(data)
      isNovaSession = nova.detect(recvBuf)
    }

    if (isNovaSession === void 0) {
      return
    } else if (isNovaSession === false) {
      recvBuf = void 0
      return
    } else if (isNovaSession === true) {
      recvBuf.append(data)
      let msgSize = recvBuf.peekInt32()
      if (recvBuf.readableBytes() >= msgSize) {
        let novaBuf = recvBuf.read(msgSize)
        let { ip, port, service, method, seq, attach, thriftBuffer } = nova.decode(novaBuf)
        console.log(`recv ${service}:${method}`)
      }
    }
  })

  session.on("end", function (session) {
    if (isNovaSession === false) {
      return
    }

    console.log("End of TCP session between " + session.src_name + " and " + session.dst_name)
    console.log("Set stats for session: ", session.session_stats())
    sendBuf = void 0
    recvBuf = void 0
  })
})

/*
"syn retry";
"reset";
"start";
"retransmit";
"data send";
"data recv";
"end";
*/
